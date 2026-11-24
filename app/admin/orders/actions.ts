"use server";

import { after } from "next/server";
import { logAudit } from "@/src/lib/audit-log";
import { SheetsError } from "@/src/lib/google-sheets";
import { StaleOrderError, writeOrderPaid, type SetPaidResult } from "@/src/lib/payments";
import { getUserForModule } from "@/src/lib/session";

export async function setOrderPaid(
  rowNumber: number,
  invoiceId: string,
  paid: boolean,
): Promise<SetPaidResult> {
  const user = await getUserForModule("orders");
  if (!user) {
    return { ok: false, error: "You don't have access to orders." };
  }
  if (!Number.isInteger(rowNumber) || rowNumber < 2 || typeof paid !== "boolean") {
    return { ok: false, error: "Invalid order." };
  }

  try {
    await writeOrderPaid(rowNumber, String(invoiceId ?? ""), paid);
    after(() => logAudit(user.email, paid ? "mark paid" : "mark unpaid", "Orders"));
    return { ok: true, paid };
  } catch (err) {
    if (err instanceof StaleOrderError) return { ok: false, error: err.message };
    if (err instanceof SheetsError) return { ok: false, error: err.message };
    console.error("[orders/setOrderPaid]", err);
    return { ok: false, error: "Couldn't save. Try again." };
  }
}
