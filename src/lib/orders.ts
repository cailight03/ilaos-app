import "server-only";
import {
  parseBakeDate,
  parseCoupon,
  parseDiscount,
  parseItems,
  type OrderItem,
} from "./order-parsing";

export type { OrderItem };

export const PRODUCTS = [
  "Plain Sourdough",
  "Jalapeno Cheddar",
  "Wheat Multi-seed",
  "Rosemary Focaccia",
  "Tomato Pesto Focaccia",
] as const;

export type ProductName = (typeof PRODUCTS)[number];

export type Order = {
  rowNumber: number; // 1-based sheet row, for tracing back to the sheet
  name: string;
  invoiceId: string;
  bakeDate: string | null; // ISO yyyy-mm-dd
  paymentMethod: string;
  paid: boolean; // "Payment Status" column; blank or missing = unpaid
  items: OrderItem[];
  total: number;
  coupon: string | null; // "Coupon used:" code, if any
  discount: number; // explicit "Discount:" amount (positive), 0 if none listed
  archived: boolean; // "Order Status" column is "Archived": left out of every sales and profit figure
  refund: number; // "Refund Amount" column, 0 if blank. Deducted from revenue.
  email?: string; // "Email for Invoice" column, if the sheet has one
  mobile?: string; // "Mobile Number" column, if the sheet has one
};

// Matched by header prefix so column reordering or long header text won't break parsing.
const COLUMN_HEADERS = {
  name: "Name",
  bakeDate: "Fixed pick up date",
  products: "Available Products",
  total: "Total",
  invoiceId: "Invoice ID",
  paymentMethod: "Mode of Payment",
} as const;

type ColumnKey = keyof typeof COLUMN_HEADERS;

export const PAYMENT_STATUS_HEADER = "Payment Status";
export const PAID_VALUE = "Paid";
export const UNPAID_VALUE = "Unpaid";

export const ORDER_STATUS_HEADER = "Order Status";
export const ARCHIVED_VALUE = "Archived";
export const ACTIVE_VALUE = "Active";
export const REFUND_HEADER = "Refund Amount";

/** Index of an app-managed column matched by its exact header, or -1 if the sheet doesn't have it yet. */
export function findExactColumn(header: string[] | undefined, name: string): number {
  return (header ?? []).findIndex((h) => h?.trim().toLowerCase() === name.toLowerCase());
}

/** Index of the app-managed payment column, or -1 if the sheet doesn't have it yet. */
export function findPaymentColumn(header: string[] | undefined): number {
  return (header ?? []).findIndex(
    (h) => h?.trim().toLowerCase() === PAYMENT_STATUS_HEADER.toLowerCase(),
  );
}

/** Same blank-row rule parseOrders uses. */
export function isOrderRow(row: string[], header: string[]): boolean {
  const col = mapColumns(header);
  return !!(row[col.name]?.trim() || row[col.products]?.trim());
}

function mapColumns(header: string[]): Record<ColumnKey, number> {
  const result = {} as Record<ColumnKey, number>;
  for (const key of Object.keys(COLUMN_HEADERS) as ColumnKey[]) {
    const idx = header.findIndex((h) =>
      h?.trim().toLowerCase().startsWith(COLUMN_HEADERS[key].toLowerCase()),
    );
    if (idx === -1) {
      throw new Error(`Sheet is missing expected column: "${COLUMN_HEADERS[key]}"`);
    }
    result[key] = idx;
  }
  return result;
}

function parseMoney(raw: string | undefined): number {
  const n = Number((raw ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function findOptionalColumn(header: string[], prefix: string): number {
  return header.findIndex((h) => h?.trim().toLowerCase().startsWith(prefix.toLowerCase()));
}

export function parseOrders(rows: string[][]): Order[] {
  if (rows.length === 0) return [];
  const col = mapColumns(rows[0]);
  const paymentCol = findPaymentColumn(rows[0]);
  const statusCol = findExactColumn(rows[0], ORDER_STATUS_HEADER);
  const refundCol = findExactColumn(rows[0], REFUND_HEADER);
  const emailCol = findOptionalColumn(rows[0], "Email");
  const mobileCol = findOptionalColumn(rows[0], "Mobile");
  const orders: Order[] = [];

  rows.slice(1).forEach((row, i) => {
    const name = row[col.name]?.trim() ?? "";
    const productsRaw = row[col.products]?.trim() ?? "";
    // Skip blank rows
    if (!name && !productsRaw) return;

    const total = parseMoney(row[col.total]);
    // A refund can't be negative or exceed what the customer paid.
    const refund = refundCol === -1 ? 0 : Math.min(Math.max(parseMoney(row[refundCol]), 0), Math.max(total, 0));

    orders.push({
      rowNumber: i + 2,
      name,
      invoiceId: row[col.invoiceId]?.trim() ?? "",
      bakeDate: parseBakeDate(row[col.bakeDate]),
      paymentMethod: row[col.paymentMethod]?.trim() ?? "",
      paid: paymentCol !== -1 && row[paymentCol]?.trim().toLowerCase() === "paid",
      items: parseItems(productsRaw),
      total,
      coupon: parseCoupon(productsRaw),
      discount: parseDiscount(productsRaw),
      archived: statusCol !== -1 && row[statusCol]?.trim().toLowerCase() === ARCHIVED_VALUE.toLowerCase(),
      refund,
      email: emailCol === -1 ? undefined : row[emailCol]?.trim(),
      mobile: mobileCol === -1 ? undefined : row[mobileCol]?.trim(),
    });
  });

  return orders;
}
