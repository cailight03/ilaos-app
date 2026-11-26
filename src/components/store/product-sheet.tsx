"use client";

import { useState } from "react";
import {
  formatPeso,
  type Product,
} from "@/src/lib/store/products";
import {
  addToBag,
  normalizeSelections,
  unitPriceFor,
  type Selections,
} from "@/src/lib/store/bag";
import { BakeryImage } from "./bakery-image";
import { BottomSheet } from "./bottom-sheet";
import { QuantityStepper } from "./quantity-stepper";

export function ProductSheet({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(1);
  const [selections, setSelections] = useState<Selections>(() =>
    normalizeSelections(product, {}),
  );
  const total = unitPriceFor(product, selections) * qty;

  return (
    <BottomSheet title={product.name} onClose={onClose} hideTitle>
      {(close) => (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 sm:pt-5">
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-chip">
              <BakeryImage
                src={product.image}
                alt={product.name}
                sizes="(min-width: 640px) 512px, 100vw"
              />
            </div>
            <div className="mt-4 flex items-start justify-between gap-4">
              <h3 className="text-2xl font-bold leading-tight">{product.name}</h3>
              <span className="text-2xl font-bold">{formatPeso(product.price)}</span>
            </div>
            <p className="mt-1.5 text-base leading-snug text-ink-muted">
              {product.description}
            </p>

            {product.options?.map((group) => (
              <fieldset key={group.id} className="mt-5">
                <legend className="mb-2 text-sm font-semibold text-ink-muted">
                  {group.label}
                </legend>
                <div className="flex rounded-full bg-chip p-1">
                  {group.choices.map((c) => {
                    const active = selections[group.id] === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          setSelections((s) => ({ ...s, [group.id]: c.id }))
                        }
                        className={`flex-1 rounded-full py-2 text-base font-semibold transition ${
                          active ? "bg-white text-royal" : "text-ink-muted"
                        }`}
                      >
                        {c.label}
                        {c.priceDelta ? ` (+${formatPeso(c.priceDelta)})` : ""}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            <div className="mt-5 flex items-center justify-between">
              <span className="text-base font-semibold">Quantity</span>
              <QuantityStepper value={qty} onChange={setQty} label={product.name} />
            </div>
          </div>

          <div className="shrink-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
            <button
              type="button"
              onClick={() => {
                addToBag(product, selections, qty);
                close();
              }}
              className="flex w-full items-center justify-between rounded-full bg-royal px-6 py-4 text-lg font-semibold text-white transition hover:bg-royal-dark active:scale-[0.98]"
            >
              <span>Add to Bag</span>
              <span>{formatPeso(total)}</span>
            </button>
          </div>
        </>
      )}
    </BottomSheet>
  );
}
