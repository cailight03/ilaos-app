"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getProduct, type Product } from "./products";

const STORAGE_KEY = "ilaos-bag-v1";
export const MAX_QTY = 20;

export type Selections = Record<string, string>;

type StoredLine = { productId: string; selections: Selections; qty: number };

export type BagLine = {
  key: string;
  product: Product;
  selections: Selections;
  /** e.g. "Sliced" */
  optionLabel: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

const EMPTY: StoredLine[] = [];
const listeners = new Set<() => void>();
let cache: StoredLine[] | null = null;

function sanitize(raw: unknown): StoredLine[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredLine[] = [];
  for (const r of raw) {
    if (!r || typeof r.productId !== "string") continue;
    const qty = Math.min(MAX_QTY, Math.floor(Number(r.qty)));
    if (!getProduct(r.productId) || !(qty >= 1)) continue;
    out.push({
      productId: r.productId,
      selections:
        r.selections && typeof r.selections === "object" ? r.selections : {},
      qty,
    });
  }
  return out;
}

function read(): StoredLine[] {
  if (cache === null) {
    try {
      cache = sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
    } catch {
      cache = [];
    }
  }
  return cache;
}

function write(next: StoredLine[]) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode); the bag still works in memory.
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Fills missing/invalid selections with each option group's first choice. */
export function normalizeSelections(
  product: Product,
  selections: Selections,
): Selections {
  const out: Selections = {};
  for (const group of product.options ?? []) {
    const chosen = group.choices.find((c) => c.id === selections[group.id]);
    out[group.id] = (chosen ?? group.choices[0]).id;
  }
  return out;
}

export function unitPriceFor(product: Product, selections: Selections): number {
  let price = product.price;
  for (const group of product.options ?? []) {
    price +=
      group.choices.find((c) => c.id === selections[group.id])?.priceDelta ?? 0;
  }
  return price;
}

function lineKey(productId: string, selections: Selections) {
  return [
    productId,
    ...Object.keys(selections)
      .sort()
      .map((k) => `${k}:${selections[k]}`),
  ].join("|");
}

function keyOf(l: StoredLine) {
  return lineKey(l.productId, l.selections);
}

export function addToBag(product: Product, selections: Selections, qty: number) {
  const sel = normalizeSelections(product, selections);
  const key = lineKey(product.id, sel);
  const lines = read();
  const existing = lines.find((l) => keyOf(l) === key);
  if (existing) {
    write(
      lines.map((l) =>
        l === existing ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l,
      ),
    );
  } else {
    write([
      ...lines,
      { productId: product.id, selections: sel, qty: Math.min(MAX_QTY, qty) },
    ]);
  }
}

export function setLineQty(key: string, qty: number) {
  const lines = read();
  if (qty < 1) return write(lines.filter((l) => keyOf(l) !== key));
  write(
    lines.map((l) =>
      keyOf(l) === key ? { ...l, qty: Math.min(MAX_QTY, qty) } : l,
    ),
  );
}

export function removeLine(key: string) {
  setLineQty(key, 0);
}

export function clearBag() {
  write(EMPTY);
}

export function useBag() {
  const stored = useSyncExternalStore(subscribe, read, () => EMPTY);

  return useMemo(() => {
    const lines: BagLine[] = stored.flatMap((l) => {
      const product = getProduct(l.productId);
      if (!product) return [];
      const selections = normalizeSelections(product, l.selections);
      const unitPrice = unitPriceFor(product, selections);
      const optionLabel = (product.options ?? [])
        .map((g) => g.choices.find((c) => c.id === selections[g.id])?.label)
        .filter(Boolean)
        .join(", ");
      return [
        {
          key: lineKey(product.id, selections),
          product,
          selections,
          optionLabel,
          qty: l.qty,
          unitPrice,
          lineTotal: unitPrice * l.qty,
        },
      ];
    });
    return {
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      total: lines.reduce((n, l) => n + l.lineTotal, 0),
    };
  }, [stored]);
}
