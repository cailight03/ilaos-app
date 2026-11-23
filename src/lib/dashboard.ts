import "server-only";
import { PRODUCTS, type Order } from "./orders";

export type DashboardStats = {
  bakeDate: string | null; // active filter (ISO) or null for all dates
  availableBakeDates: string[]; // ISO, ascending
  totalOrders: number;
  totalSales: number;
  productBreakdown: Record<string, number>;
  warnings: {
    duplicateInvoiceIds: string[]; // counted as-is; not removed
    unrecognizedProducts: string[];
    ordersWithoutBakeDate: number;
  };
};

export function computeDashboardStats(
  allOrders: Order[],
  bakeDate: string | null,
): DashboardStats {
  const availableBakeDates = [
    ...new Set(allOrders.map((o) => o.bakeDate).filter((d): d is string => !!d)),
  ].sort();

  const orders = bakeDate
    ? allOrders.filter((o) => o.bakeDate === bakeDate)
    : allOrders;

  const productBreakdown: Record<string, number> = Object.fromEntries(
    PRODUCTS.map((p) => [p, 0]),
  );
  const unrecognized = new Set<string>();

  for (const order of orders) {
    for (const item of order.items) {
      if (item.product in productBreakdown) {
        productBreakdown[item.product] += item.quantity;
      } else {
        unrecognized.add(item.product);
      }
    }
  }

  const idCounts = new Map<string, number>();
  for (const o of orders) {
    if (o.invoiceId) idCounts.set(o.invoiceId, (idCounts.get(o.invoiceId) ?? 0) + 1);
  }

  return {
    bakeDate,
    availableBakeDates,
    totalOrders: orders.length,
    totalSales: orders.reduce((sum, o) => sum + o.total, 0),
    productBreakdown,
    warnings: {
      duplicateInvoiceIds: [...idCounts].filter(([, n]) => n > 1).map(([id]) => id),
      unrecognizedProducts: [...unrecognized],
      ordersWithoutBakeDate: orders.filter((o) => !o.bakeDate).length,
    },
  };
}
