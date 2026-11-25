import type { Order } from "./orders.ts";
import { netTotal, scopeOrders } from "./order-scope.ts";

export type SortKey = "newest" | "oldest" | "name" | "highest" | "lowest";

export type OrderFilters = {
  query: string;
  bakeDate: string; // ISO yyyy-mm-dd, "" = all dates
  product: string; // sheet product name, "" = all products
  sort: SortKey;
  showArchived: boolean;
};

export const DEFAULT_FILTERS: OrderFilters = {
  query: "",
  bakeDate: "",
  product: "",
  sort: "newest",
  showArchived: false,
};

export const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  name: "Customer A–Z",
  highest: "Highest amount",
  lowest: "Lowest amount",
};

const DISPLAY_NAMES: Record<string, string> = {
  "Jalapeno Cheddar": "Jalapeño Cheddar",
  "Wheat Multi-seed": "Wheat Multiseed",
};

export const productLabel = (name: string) => DISPLAY_NAMES[name] ?? name;

export const orderItemCount = (o: Order) => o.items.reduce((n, i) => n + i.quantity, 0);

export const itemsSubtotal = (o: Order) =>
  o.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

/** A coupon code or an explicit discount line was used on this order. */
export const isDiscounted = (o: Order) => o.coupon !== null || o.discount > 0;

/** Short id for display, e.g. "# INV-000662" -> "INV-000662". */
export const displayOrderId = (o: Order) => o.invoiceId.replace(/^#\s*/, "");

export function bakeDatesOf(orders: readonly Order[]): string[] {
  return [...new Set(orders.map((o) => o.bakeDate).filter((d): d is string => !!d))].sort();
}

/** Invoice IDs shared by more than one sheet row. Those rows are different orders and are never merged. */
export function duplicateInvoiceIds(orders: readonly Order[]): string[] {
  const counts = new Map<string, number>();
  for (const o of orders) {
    if (o.invoiceId) counts.set(o.invoiceId, (counts.get(o.invoiceId) ?? 0) + 1);
  }
  return [...counts].filter(([, n]) => n > 1).map(([id]) => id);
}

export function filterAndSortOrders(
  orders: readonly Order[],
  filters: OrderFilters,
): Order[] {
  const q = filters.query.trim().toLowerCase();

  const result = orders.filter((o) => {
    if (o.archived && !filters.showArchived) return false;
    if (filters.bakeDate && o.bakeDate !== filters.bakeDate) return false;
    if (filters.product && !o.items.some((i) => i.product === filters.product)) return false;
    if (q && !o.name.toLowerCase().includes(q) && !o.invoiceId.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });

  // Sheet rows are appended as orders arrive, so a higher row number is a newer order.
  const byNewest = (a: Order, b: Order) => b.rowNumber - a.rowNumber;
  const sorters: Record<SortKey, (a: Order, b: Order) => number> = {
    newest: byNewest,
    oldest: (a, b) => a.rowNumber - b.rowNumber,
    name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || byNewest(a, b),
    highest: (a, b) => b.total - a.total || byNewest(a, b),
    lowest: (a, b) => a.total - b.total || byNewest(a, b),
  };
  return result.sort(sorters[filters.sort]);
}

export function summarizeOrders(orders: readonly Order[]) {
  // Same counting rule as the dashboard and reports: archived and repeated rows are not sales.
  const { orders: counted } = scopeOrders(orders);
  return {
    totalOrders: counted.length,
    totalItems: counted.reduce((n, o) => n + orderItemCount(o), 0),
    totalSales: counted.reduce((sum, o) => sum + netTotal(o), 0),
  };
}

export function formatBakeDate(iso: string | null): string {
  if (!iso) return "No bake date";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
export const formatPeso = (n: number) => peso.format(n);
