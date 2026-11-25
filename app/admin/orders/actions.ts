"use server";

import { after } from "next/server";
import { logAudit } from "@/src/lib/audit-log";
import { SheetsError } from "@/src/lib/google-sheets";
import {
  InvalidRefundError,
  StaleOrderError,
  writeOrderArchived,
  writeOrderPaid,
  writeOrderRefund,
  type SetPaidResult,
} from "@/src/lib/payments";
import { getUserForModule } from "@/src/lib/session";

export type OrderEditResult = { ok: true } | { ok: false; error: string };

async function editOrder(
  action: string,
  rowNumber: number,
  work: () => Promise<void>,
): Promise<OrderEditResult> {
  const user = await getUserForModule("orders");
  if (!user) return { ok: false, error: "You don't have access to orders." };
  if (!Number.isInteger(rowNumber) || rowNumber < 2) return { ok: false, error: "Invalid order." };
  try {
    await work();
    after(() => logAudit(user.email, action, "Orders"));
    return { ok: true };
  } catch (err) {
    if (err instanceof StaleOrderError || err instanceof InvalidRefundError || err instanceof SheetsError) {
      return { ok: false, error: err.message };
    }
    console.error("[orders/edit]", err);
    return { ok: false, error: "Couldn't save. Try again." };
  }
}

export async function setOrderArchived(rowNumber: number, invoiceId: string, archived: boolean): Promise<OrderEditResult> {
  if (typeof archived !== "boolean") return { ok: false, error: "Invalid request." };
  return editOrder(archived ? "archive order" : "restore order", rowNumber, () =>
    writeOrderArchived(rowNumber, String(invoiceId ?? ""), archived),
  );
}

/** 0 clears the refund. */
export async function setOrderRefund(rowNumber: number, invoiceId: string, refund: number): Promise<OrderEditResult> {
  const amount = Number(refund);
  if (!Number.isFinite(amount) || amount < 0 || amount > 9_999_999) return { ok: false, error: "Enter a valid refund amount." };
  return editOrder("set refund", rowNumber, () =>
    writeOrderRefund(rowNumber, String(invoiceId ?? ""), Number(amount.toFixed(2))),
  );
}

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
