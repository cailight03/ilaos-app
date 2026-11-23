import "server-only";
import { getSheetRows } from "./google-sheets";
import { parseOrders, type Order } from "./orders";
import { ensurePaymentColumn } from "./payments";

export async function fetchOrders(): Promise<Order[]> {
  // The first load adds the Payment Status column and marks existing orders Paid.
  const sheet = await ensurePaymentColumn(await getSheetRows());
  return parseOrders(sheet.rows);
}
