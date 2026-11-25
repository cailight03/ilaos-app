import "server-only";
import { supabaseAdmin } from "./supabase";
import { listCostHistory, recordCostSnapshotSafely } from "./cost-history";
import { attachCosts, buildCostBook, type CostedOrder } from "./profitability";
import type { ExpenseLike } from "./expense-types";
import type { ExpenseType } from "./expense-types";
import type { ReportOrder } from "./sales-report";

export type ProfitInputs = {
  orders: CostedOrder[];
  expenses: ExpenseLike[];
  /** False until at least one cost has been recorded, so every sale is still uncosted. */
  hasCostHistory: boolean;
};

type ExpenseRow = {
  amount: number | string;
  expense_type: ExpenseType;
  expense_date: string;
  category_id: string;
  expense_categories: { name: string } | { name: string }[] | null;
};

/**
 * Active (not archived) expenses of every type. Titles, notes and receipts are left out: the report
 * only needs amount, type, category and date. Each expense is one row, so none is counted twice.
 */
async function listProfitExpenses(): Promise<ExpenseLike[]> {
  const rows: ExpenseRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin()
      .from("expenses")
      .select("amount, expense_type, expense_date, category_id, expense_categories(name)")
      .eq("is_archived", false)
      .order("expense_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`profit expenses: ${error.message}`);
    rows.push(...(data as unknown as ExpenseRow[]));
    if (!data || data.length < 1000) break;
  }
  return rows.map((r) => {
    const cat = Array.isArray(r.expense_categories) ? r.expense_categories[0] : r.expense_categories;
    const name = cat?.name ?? "Uncategorized";
    return {
      amount: Number(r.amount),
      expenseType: r.expense_type,
      categoryId: r.category_id,
      categoryName: name,
      expenseDate: r.expense_date,
      title: name,
      description: null,
    };
  });
}

export async function loadProfitInputs(reportOrders: ReportOrder[], actor: string): Promise<ProfitInputs> {
  // Brings the cost history up to date (e.g. after a recipe edit) before anything is read.
  await recordCostSnapshotSafely(actor, "Profitability report opened");
  const [history, expenses] = await Promise.all([listCostHistory(), listProfitExpenses()]);
  return {
    orders: attachCosts(reportOrders, buildCostBook(history)),
    expenses,
    hasCostHistory: history.length > 0,
  };
}
