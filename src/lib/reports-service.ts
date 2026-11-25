import "server-only";
import { createHash } from "node:crypto";
import { getSheetRows } from "./google-sheets";
import { parseOrders } from "./orders";
import { scopeOrders } from "./order-scope";
import { customerIdentity, type ReportOrder } from "./sales-report";

export type ReportScope = {
  archived: number;
  duplicatesRemoved: number;
  conflictingInvoices: number;
};

/**
 * Loads orders for the Sales Report with a single read-only sheet request. Emails and phone
 * numbers are reduced to a one-way hash here, so they never reach the browser.
 * Unlike fetchOrders, this never writes to the sheet.
 *
 * Archived orders and repeated rows are removed here (see scopeOrders), so Sales and
 * Profitability are always built from the same orders.
 */
export async function fetchReportOrders(): Promise<{ orders: ReportOrder[]; scope: ReportScope }> {
  const { rows } = await getSheetRows();
  const scope = scopeOrders(parseOrders(rows));
  return {
    orders: scope.orders.map((o) => {
      const id = customerIdentity(o);
      return {
        rowNumber: o.rowNumber,
        bakeDate: o.bakeDate,
        total: o.total,
        refund: o.refund,
        items: o.items,
        customerKey: id ? createHash("sha256").update(id).digest("hex").slice(0, 16) : null,
      };
    }),
    scope: {
      archived: scope.archived,
      duplicatesRemoved: scope.duplicatesRemoved,
      conflictingInvoices: scope.conflictingInvoiceIds.length,
    },
  };
}
