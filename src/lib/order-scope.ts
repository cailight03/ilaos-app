import type { OrderItem } from "./order-parsing.ts";

/** The fields that decide whether a sheet row counts as a sale. */
export type ScopeOrder = {
  rowNumber: number;
  name: string;
  invoiceId: string;
  bakeDate: string | null;
  total: number;
  items: readonly OrderItem[];
  archived: boolean;
  refund: number;
};

export type OrderScope<T> = {
  /** The orders that count as sales. Every sales and profit figure in the app is built from these. */
  orders: T[];
  archived: number;
  duplicatesRemoved: number;
  /** Invoice IDs still shared by rows that differ (kept, since they may be different orders). */
  conflictingInvoiceIds: string[];
};

const money = (n: number) => (Number.isFinite(n) ? n : 0);

/** Revenue of one order: the recorded Total (already net of discount) minus any refund. */
export const netTotal = (o: Pick<ScopeOrder, "total" | "refund">) =>
  money(o.total) - Math.min(Math.max(money(o.refund), 0), Math.max(money(o.total), 0));

function signature(o: ScopeOrder): string {
  const items = o.items.map((i) => `${i.product}|${i.unitPrice}|${i.quantity}`).join(";");
  return [o.bakeDate ?? "", o.total, o.name.trim().toLowerCase(), items].join("#");
}

/**
 * Applies the single counting rule used by the Orders summary, the Dashboard, the Sales Report
 * and Profitability, so they always agree:
 *  1. Archived orders are left out.
 *  2. Rows with the same invoice ID and identical content (date, total, customer, items) are one
 *     order submitted twice. Only the first row counts.
 *  3. Rows that share an invoice ID but differ are kept and reported as conflicts.
 * Rows without an invoice ID are never merged.
 */
export function scopeOrders<T extends ScopeOrder>(all: readonly T[]): OrderScope<T> {
  const live = all.filter((o) => !o.archived);
  const seen = new Map<string, Set<string>>(); // invoice id -> signatures already counted
  const kept: T[] = [];
  let duplicatesRemoved = 0;

  for (const o of [...live].sort((a, b) => a.rowNumber - b.rowNumber)) {
    if (!o.invoiceId) {
      kept.push(o);
      continue;
    }
    const sig = signature(o);
    const sigs = seen.get(o.invoiceId) ?? seen.set(o.invoiceId, new Set()).get(o.invoiceId)!;
    if (sigs.has(sig)) {
      duplicatesRemoved++;
      continue;
    }
    sigs.add(sig);
    kept.push(o);
  }

  return {
    orders: kept,
    archived: all.length - live.length,
    duplicatesRemoved,
    conflictingInvoiceIds: [...seen].filter(([, s]) => s.size > 1).map(([id]) => id),
  };
}
