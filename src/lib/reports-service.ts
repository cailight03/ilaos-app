import "server-only";
import { createHash } from "node:crypto";
import { getSheetRows } from "./google-sheets";
import { parseOrders } from "./orders";
import { customerIdentity, type ReportOrder } from "./sales-report";

/**
 * Loads orders for the Sales Report with a single read-only sheet request. Emails and phone
 * numbers are reduced to a one-way hash here, so they never reach the browser.
 * Unlike fetchOrders, this never writes to the sheet.
 */
export async function fetchReportOrders(): Promise<ReportOrder[]> {
  const { rows } = await getSheetRows();
  return parseOrders(rows).map((o) => {
    const id = customerIdentity(o);
    return {
      rowNumber: o.rowNumber,
      bakeDate: o.bakeDate,
      total: o.total,
      items: o.items,
      customerKey: id ? createHash("sha256").update(id).digest("hex").slice(0, 16) : null,
    };
  });
}
