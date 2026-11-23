"use server";

import { SheetsError } from "@/src/lib/google-sheets";
import { StaleOrderError, writeOrderPaid, type SetPaidResult } from "@/src/lib/payments";
import { hasSession } from "@/src/lib/session";

export async function setOrderPaid(
  rowNumber: number,
  invoiceId: string,
  paid: boolean,
): Promise<SetPaidResult> {
  if (!(await hasSession())) return { ok: false, error: "Session expired. Please sign in again." };
  if (!Number.isInteger(rowNumber) || rowNumber < 2 || typeof paid !== "boolean") {
    return { ok: false, error: "Invalid order." };
  }

  try {
    await writeOrderPaid(rowNumber, String(invoiceId ?? ""), paid);
    return { ok: true, paid };
  } catch (err) {
    if (err instanceof StaleOrderError) return { ok: false, error: err.message };
    if (err instanceof SheetsError) return { ok: false, error: err.message };
    console.error("[orders/setOrderPaid]", err);
    return { ok: false, error: "Couldn't save. Try again." };
  }
}
