"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { logAudit } from "@/src/lib/audit-log";
import { isExpenseType, isIsoDate, MAX_RECEIPT_BYTES } from "@/src/lib/expense-types";
import {
  ExpenseError,
  createExpenseCategory,
  getReceiptUrl,
  saveExpense,
  setExpenseArchived,
  updateExpenseCategory,
  type ExpenseInput,
} from "@/src/lib/expenses";
import { DuplicateNameError, NotFoundError } from "@/src/lib/ingredients";
import { parseAmount } from "@/src/lib/ingredient-cost";
import { getUserForModule } from "@/src/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ReceiptResult = { ok: true; url: string; name: string; type: string | null } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AMOUNT = 9_999_999_999;
const DENIED = "You don't have permission to do that.";
const PATH = "/admin/costing/expenses";

// Every action re-checks module access against the database. The audit entry is written after a
// successful change, once the response is on its way.
async function run(action: string, work: (actor: string) => Promise<ActionResult | void>): Promise<ActionResult> {
  const user = await getUserForModule("costing_expenses");
  if (!user) return { ok: false, error: DENIED };
  try {
    const result = await work(user.email);
    if (result && !result.ok) return result;
    revalidatePath(PATH);
    after(() => logAudit(user.email, action, "Expenses"));
    return { ok: true };
  } catch (err) {
    if (err instanceof ExpenseError || err instanceof DuplicateNameError || err instanceof NotFoundError) {
      return { ok: false, error: err.message };
    }
    console.error("[expenses]", err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

function parseExpense(form: FormData): ExpenseInput | string {
  const title = text(form.get("title"));
  if (!title) return "Enter an expense title.";
  if (title.length > 120) return "Title is too long (120 characters max).";
  const categoryId = text(form.get("categoryId"));
  if (!UUID_RE.test(categoryId)) return "Choose a category.";
  const amount = parseAmount(text(form.get("amount")));
  if (Number.isNaN(amount)) return "Enter the amount.";
  if (amount <= 0) return "Amount must be greater than zero.";
  if (amount > MAX_AMOUNT) return "That amount is too large.";
  const expenseDate = text(form.get("expenseDate"));
  if (!isIsoDate(expenseDate)) return "Choose the expense date.";
  const description = text(form.get("description"));
  if (description.length > 1000) return "Description is too long (1,000 characters max).";
  return {
    title,
    categoryId,
    amount: Number(amount.toFixed(2)),
    expenseDate,
    description: description || null,
  };
}

/** FormData fields: id (blank when adding), title, categoryId, amount, expenseDate, description, receipt (file), clearReceipt ("1"). */
export async function saveExpenseAction(form: FormData): Promise<ActionResult> {
  const id = text(form.get("id"));
  if (id && !UUID_RE.test(id)) return { ok: false, error: "Invalid expense." };
  const input = parseExpense(form);
  if (typeof input === "string") return { ok: false, error: input };

  const file = form.get("receipt");
  const receipt = file instanceof File && file.size > 0 ? file : null;
  if (receipt && receipt.size > MAX_RECEIPT_BYTES) return { ok: false, error: "Receipt is too large (5 MB max)." };

  return run(id ? "edit" : "add", async (actor) => {
    await saveExpense({ id: id || null, input, receipt, clearReceipt: form.get("clearReceipt") === "1" }, actor);
  });
}

export async function setExpenseArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  if (!UUID_RE.test(String(id))) return { ok: false, error: "Invalid expense." };
  if (typeof archived !== "boolean") return { ok: false, error: "Invalid request." };
  return run(archived ? "archive" : "restore", (actor) => setExpenseArchived(id, archived, actor));
}

export async function getReceiptUrlAction(id: string): Promise<ReceiptResult> {
  if (!(await getUserForModule("costing_expenses"))) return { ok: false, error: DENIED };
  if (!UUID_RE.test(String(id))) return { ok: false, error: "Invalid expense." };
  try {
    return { ok: true, ...(await getReceiptUrl(id)) };
  } catch (err) {
    if (err instanceof ExpenseError || err instanceof NotFoundError) return { ok: false, error: err.message };
    console.error("[expenses]", err);
    return { ok: false, error: "Couldn't open the receipt." };
  }
}

export async function createExpenseCategoryAction(name: string, type?: string): Promise<ActionResult> {
  const clean = String(name ?? "").trim();
  if (!clean) return { ok: false, error: "Enter a category name." };
  if (clean.length > 60) return { ok: false, error: "Category name is too long (60 characters max)." };
  if (!isExpenseType(type)) return { ok: false, error: "Choose a category type." };
  return run("add category", () => createExpenseCategory(clean, type));
}

export async function renameExpenseCategoryAction(id: string, name: string): Promise<ActionResult> {
  if (!UUID_RE.test(String(id))) return { ok: false, error: "Invalid category." };
  const clean = String(name ?? "").trim();
  if (!clean) return { ok: false, error: "Enter a category name." };
  if (clean.length > 60) return { ok: false, error: "Category name is too long (60 characters max)." };
  return run("rename category", () => updateExpenseCategory(id, { name: clean }));
}

export async function setExpenseCategoryActiveAction(id: string, active: boolean): Promise<ActionResult> {
  if (!UUID_RE.test(String(id))) return { ok: false, error: "Invalid category." };
  if (typeof active !== "boolean") return { ok: false, error: "Invalid request." };
  return run(active ? "restore category" : "archive category", () => updateExpenseCategory(id, { isActive: active }));
}
