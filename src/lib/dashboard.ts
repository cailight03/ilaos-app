import "server-only";
import { PRODUCTS, type Order } from "./orders";
import { netTotal, scopeOrders } from "./order-scope";

export type DashboardStats = {
  bakeDate: string | null; // active filter (ISO) or null for all dates
  availableBakeDates: string[]; // ISO, ascending
  totalOrders: number;
  totalSales: number;
  productBreakdown: Record<string, number>;
  warnings: {
    duplicateInvoiceIds: string[]; // same ID but different content; counted as separate orders
    unrecognizedProducts: string[];
    ordersWithoutBakeDate: number;
  };
};

export function computeDashboardStats(
  rawOrders: Order[],
  bakeDate: string | null,
): DashboardStats {
  // Archived orders and repeated rows are not sales (same rule as Reports and Profitability).
  const { orders: allOrders, conflictingInvoiceIds } = scopeOrders(rawOrders);
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

  return {
    bakeDate,
    availableBakeDates,
    totalOrders: orders.length,
    totalSales: orders.reduce((sum, o) => sum + netTotal(o), 0),
    productBreakdown,
    warnings: {
      duplicateInvoiceIds: conflictingInvoiceIds.filter((id) => orders.some((o) => o.invoiceId === id)),
      unrecognizedProducts: [...unrecognized],
      ordersWithoutBakeDate: orders.filter((o) => !o.bakeDate).length,
    },
  };
}
