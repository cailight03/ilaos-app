import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { DuplicateNameError, NotFoundError } from "./ingredients";
import {
  MAX_RECEIPT_BYTES,
  RECEIPT_TYPES,
  type ExpenseType,
} from "./expense-types";

const BUCKET = "expense-receipts";
const LIST_LIMIT = 5000;

/** A problem the user can fix; its message is shown as-is. */
export class ExpenseError extends Error {}

export type ExpenseCategory = {
  id: string;
  name: string;
  expenseType: ExpenseType;
  isDefault: boolean;
  isActive: boolean;
};

export type Expense = {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  expenseType: ExpenseType;
  amount: number;
  expenseDate: string;
  description: string | null;
  receiptName: string | null;
  receiptType: string | null;
  hasReceipt: boolean;
  createdBy: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseInput = {
  title: string;
  categoryId: string;
  amount: number;
  expenseDate: string;
  description: string | null;
};

const COLUMNS =
  "id, title, category_id, expense_type, amount, expense_date, description, " +
  "receipt_path, receipt_name, receipt_type, created_by, is_archived, created_at, updated_at, " +
  "expense_categories(name)";

type Row = {
  id: string;
  title: string;
  category_id: string;
  expense_type: ExpenseType;
  amount: number | string;
  expense_date: string;
  description: string | null;
  receipt_path: string | null;
  receipt_name: string | null;
  receipt_type: string | null;
  created_by: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  expense_categories: { name: string } | { name: string }[] | null;
};

function toExpense(r: Row): Expense {
  const cat = Array.isArray(r.expense_categories) ? r.expense_categories[0] : r.expense_categories;
  return {
    id: r.id,
    title: r.title,
    categoryId: r.category_id,
    categoryName: cat?.name ?? "Uncategorized",
    expenseType: r.expense_type,
    amount: Number(r.amount),
    expenseDate: r.expense_date,
    description: r.description,
    receiptName: r.receipt_name,
    receiptType: r.receipt_type,
    hasReceipt: !!r.receipt_path,
    createdBy: r.created_by,
    isArchived: r.is_archived,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// Categories

function failCategory(error: { message: string; code?: string }): never {
  if (error.code === "23505") throw new DuplicateNameError("category");
  if (error.message.includes("CATEGORY_TYPE_LOCKED")) {
    throw new ExpenseError("This category already has expenses, so its type can't change.");
  }
  throw new Error(`expense category: ${error.message}`);
}

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  const { data, error } = await supabaseAdmin()
    .from("expense_categories")
    .select("id, name, expense_type, is_default, is_active")
    .order("name");
  if (error) failCategory(error);
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    expenseType: c.expense_type,
    isDefault: c.is_default,
    isActive: c.is_active,
  }));
}

export async function createExpenseCategory(name: string, type: ExpenseType): Promise<void> {
  const { error } = await supabaseAdmin().from("expense_categories").insert({ name, expense_type: type });
  if (error) failCategory(error);
}

export async function updateExpenseCategory(
  id: string,
  patch: { name?: string; isActive?: boolean; expenseType?: ExpenseType },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;
  if (patch.expenseType !== undefined) update.expense_type = patch.expenseType;
  const { data, error } = await supabaseAdmin().from("expense_categories").update(update).eq("id", id).select("id");
  if (error) failCategory(error);
  if (!data?.length) throw new NotFoundError();
}

// Expenses

export async function listExpenses(): Promise<Expense[]> {
  const { data, error } = await supabaseAdmin()
    .from("expenses")
    .select(COLUMNS)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new Error(`expenses: ${error.message}`);
  return (data as unknown as Row[]).map(toExpense);
}

function sniffReceiptType(b: Uint8Array): string | null {
  const at = (i: number, s: string) => [...s].every((c, k) => b[i + k] === c.charCodeAt(0));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && at(1, "PNG")) return "image/png";
  if (at(0, "RIFF") && at(8, "WEBP")) return "image/webp";
  if (at(0, "%PDF")) return "application/pdf";
  return null;
}

type Receipt = { path: string; name: string; type: string };

async function uploadReceipt(expenseId: string, file: File): Promise<Receipt> {
  if (file.size === 0) throw new ExpenseError("That receipt file is empty.");
  if (file.size > MAX_RECEIPT_BYTES) throw new ExpenseError("Receipt is too large (5 MB max).");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffReceiptType(bytes);
  if (!type || !(type in RECEIPT_TYPES)) throw new ExpenseError("Receipt must be a JPEG, PNG, WebP or PDF file.");
  const path = `expenses/${expenseId}/${randomUUID()}.${RECEIPT_TYPES[type]}`;
  const { error } = await supabaseAdmin().storage.from(BUCKET).upload(path, bytes, { contentType: type });
  if (error) throw new Error(`receipt upload: ${error.message}`);
  return { path, name: file.name.slice(0, 200) || `receipt.${RECEIPT_TYPES[type]}`, type };
}

async function removeReceipt(path: string | null | undefined): Promise<void> {
  if (!path) return;
  const { error } = await supabaseAdmin().storage.from(BUCKET).remove([path]);
  if (error) console.error("[expenses] receipt cleanup failed", error.message);
}

export type SaveExpense = {
  id: string | null;
  input: ExpenseInput;
  receipt: File | null;
  clearReceipt: boolean;
};

/** Creates or updates an expense; returns its id. */
export async function saveExpense(req: SaveExpense, actor: string): Promise<string> {
  const db = supabaseAdmin();
  const { input } = req;

  const { data: cat, error: catErr } = await db
    .from("expense_categories")
    .select("id, expense_type, is_active")
    .eq("id", input.categoryId)
    .maybeSingle();
  if (catErr) failCategory(catErr);
  if (!cat) throw new ExpenseError("Choose a valid category.");

  let existing: { category_id: string; expense_type: ExpenseType; receipt_path: string | null; is_archived: boolean } | null = null;
  if (req.id) {
    const { data, error } = await db
      .from("expenses")
      .select("category_id, expense_type, receipt_path, is_archived")
      .eq("id", req.id)
      .maybeSingle();
    if (error) throw new Error(`expenses: ${error.message}`);
    if (!data) throw new NotFoundError();
    if (data.is_archived) throw new ExpenseError("Restore this expense before editing it.");
    existing = data;
  }

  if (!cat.is_active && existing?.category_id !== cat.id) {
    throw new ExpenseError("That category is archived. Choose an active one.");
  }

  const id = req.id ?? randomUUID();
  // History stays stable: a type is only re-copied from the category when the category changes.
  const expenseType = existing && existing.category_id === cat.id ? existing.expense_type : cat.expense_type;
  const columns = {
    title: input.title,
    category_id: input.categoryId,
    expense_type: expenseType,
    amount: input.amount,
    expense_date: input.expenseDate,
    description: input.description,
  };

  let uploaded: Receipt | null = null;
  if (req.receipt) uploaded = await uploadReceipt(id, req.receipt);

  const receiptColumns = uploaded
    ? { receipt_path: uploaded.path, receipt_name: uploaded.name, receipt_type: uploaded.type }
    : req.clearReceipt
      ? { receipt_path: null, receipt_name: null, receipt_type: null }
      : {};

  try {
    if (req.id) {
      const { data, error } = await db
        .from("expenses")
        .update({ ...columns, ...receiptColumns, updated_by: actor })
        .eq("id", id)
        .select("id");
      if (error) throw new Error(`expenses: ${error.message}`);
      if (!data?.length) throw new NotFoundError();
    } else {
      const { error } = await db
        .from("expenses")
        .insert({ id, ...columns, ...receiptColumns, created_by: actor, updated_by: actor });
      if (error) throw new Error(`expenses: ${error.message}`);
    }
  } catch (err) {
    await removeReceipt(uploaded?.path);
    throw err;
  }

  if (existing && (uploaded || req.clearReceipt)) await removeReceipt(existing.receipt_path);
  return id;
}

export async function setExpenseArchived(id: string, archived: boolean, actor: string): Promise<void> {
  const { data, error } = await supabaseAdmin()
    .from("expenses")
    .update({
      is_archived: archived,
      archived_at: archived ? new Date().toISOString() : null,
      archived_by: archived ? actor : null,
      updated_by: actor,
    })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`expenses: ${error.message}`);
  if (!data?.length) throw new NotFoundError();
}

/** Short-lived link to a receipt in the private bucket. Callers must check module access first. */
export async function getReceiptUrl(id: string): Promise<{ url: string; name: string; type: string | null }> {
  const { data, error } = await supabaseAdmin()
    .from("expenses")
    .select("receipt_path, receipt_name, receipt_type")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`expenses: ${error.message}`);
  if (!data) throw new NotFoundError();
  if (!data.receipt_path) throw new ExpenseError("This expense has no receipt.");
  const signed = await supabaseAdmin().storage.from(BUCKET).createSignedUrl(data.receipt_path, 120);
  if (signed.error || !signed.data) throw new Error(`receipt link: ${signed.error?.message}`);
  return { url: signed.data.signedUrl, name: data.receipt_name ?? "receipt", type: data.receipt_type };
}
