import "server-only";
import {
  getSheetRows,
  updateSheetCells,
  type SheetData,
} from "./google-sheets";
import {
  ACTIVE_VALUE,
  ARCHIVED_VALUE,
  ORDER_STATUS_HEADER,
  PAID_VALUE,
  PAYMENT_STATUS_HEADER,
  REFUND_HEADER,
  UNPAID_VALUE,
  findExactColumn,
  findPaymentColumn,
  isOrderRow,
  parseOrders,
} from "./orders";

/** 0 -> A, 25 -> Z, 26 -> AA */
export function columnLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const a1 = (title: string, cell: string) => `'${title.replace(/'/g, "''")}'!${cell}`;

/**
 * Makes sure the sheet has a "Payment Status" column. The first time, it is added after the
 * last column and every existing order is marked Paid. New rows (e.g. from the form) leave it
 * blank, which the app reads as Unpaid. Returns the sheet data including the column.
 */
export async function ensurePaymentColumn(sheet: SheetData): Promise<SheetData> {
  const header = sheet.rows[0];
  if (!header || findPaymentColumn(header) !== -1) return sheet;

  const col = header.length;
  const letter = columnLetter(col);
  const updates = [{ range: a1(sheet.sheetTitle, `${letter}1`), values: [[PAYMENT_STATUS_HEADER]] }];
  const rows = sheet.rows.map((r) => [...r]);
  rows[0][col] = PAYMENT_STATUS_HEADER;

  rows.slice(1).forEach((row, i) => {
    if (!isOrderRow(row, header)) return;
    updates.push({ range: a1(sheet.sheetTitle, `${letter}${i + 2}`), values: [[PAID_VALUE]] });
    row[col] = PAID_VALUE;
  });

  await updateSheetCells(updates);
  return { ...sheet, rows };
}

export type SetPaidResult = { ok: true; paid: boolean } | { ok: false; error: string };

/** Writes the status for one order row, after checking the row still belongs to that order. */
export async function writeOrderPaid(
  rowNumber: number,
  invoiceId: string,
  paid: boolean,
): Promise<void> {
  const sheet = await ensurePaymentColumn(await getSheetRows());
  const header = sheet.rows[0];
  const row = sheet.rows[rowNumber - 1];
  if (!header || !row || !isOrderRow(row, header)) {
    throw new StaleOrderError();
  }

  // Rows can shift if someone sorts or deletes in the sheet, so confirm it's the same order.
  const idCol = header.findIndex((h) => h?.trim().toLowerCase().startsWith("invoice id"));
  if (idCol !== -1 && (row[idCol]?.trim() ?? "") !== invoiceId) {
    throw new StaleOrderError();
  }

  const letter = columnLetter(findPaymentColumn(header));
  await updateSheetCells([
    { range: a1(sheet.sheetTitle, `${letter}${rowNumber}`), values: [[paid ? PAID_VALUE : UNPAID_VALUE]] },
  ]);
}

export class StaleOrderError extends Error {
  constructor() {
    super("This order changed in the sheet. Refresh and try again.");
  }
}

export class InvalidRefundError extends Error {}

/** Adds an app-managed column (header only) after the last column if the sheet doesn't have it yet. */
async function ensureColumn(sheet: SheetData, name: string): Promise<SheetData> {
  const header = sheet.rows[0];
  if (!header || findExactColumn(header, name) !== -1) return sheet;
  const col = header.length;
  await updateSheetCells([{ range: a1(sheet.sheetTitle, `${columnLetter(col)}1`), values: [[name]] }]);
  const rows = sheet.rows.map((r) => [...r]);
  rows[0][col] = name;
  return { ...sheet, rows };
}

/** Writes one app-managed cell, after checking the row still belongs to that order. */
async function writeOrderField(
  rowNumber: number,
  invoiceId: string,
  column: string,
  value: string,
  validate?: (total: number) => void,
): Promise<void> {
  let sheet = await ensurePaymentColumn(await getSheetRows());
  sheet = await ensureColumn(sheet, column);
  const header = sheet.rows[0];
  const row = sheet.rows[rowNumber - 1];
  if (!header || !row || !isOrderRow(row, header)) throw new StaleOrderError();

  const idCol = header.findIndex((h) => h?.trim().toLowerCase().startsWith("invoice id"));
  if (idCol !== -1 && (row[idCol]?.trim() ?? "") !== invoiceId) throw new StaleOrderError();

  if (validate) validate(parseOrders([header, row])[0]?.total ?? 0);

  const letter = columnLetter(findExactColumn(header, column));
  await updateSheetCells([{ range: a1(sheet.sheetTitle, `${letter}${rowNumber}`), values: [[value]] }]);
}

/** Archiving never deletes the row: it only marks it so it stops counting as a sale. */
export const writeOrderArchived = (rowNumber: number, invoiceId: string, archived: boolean) =>
  writeOrderField(rowNumber, invoiceId, ORDER_STATUS_HEADER, archived ? ARCHIVED_VALUE : ACTIVE_VALUE);

export const writeOrderRefund = (rowNumber: number, invoiceId: string, refund: number) =>
  writeOrderField(rowNumber, invoiceId, REFUND_HEADER, refund > 0 ? String(refund) : "", (total) => {
    if (refund > total) throw new InvalidRefundError("A refund can't be more than the order total.");
  });
