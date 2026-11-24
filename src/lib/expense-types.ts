export const EXPENSE_TYPES = ["operating", "material", "capital"] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export const EXPENSE_TYPE_LABEL: Record<ExpenseType, string> = {
  operating: "Operating",
  material: "Materials",
  capital: "Capital",
};

export const EXPENSE_TYPE_HINT: Record<ExpenseType, string> = {
  operating: "Day-to-day running costs, deducted from profit.",
  material: "Ingredients and packaging. Already counted in Product Costing, so never deducted twice.",
  capital: "Equipment and other long-lived purchases, kept apart from operating expenses.",
};

export const isExpenseType = (v: unknown): v is ExpenseType =>
  typeof v === "string" && (EXPENSE_TYPES as readonly string[]).includes(v);

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export const RECEIPT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export type ExpenseLike = {
  amount: number;
  expenseType: ExpenseType;
  categoryId: string;
  categoryName: string;
  expenseDate: string; // ISO yyyy-mm-dd
  title: string;
  description: string | null;
};

const cents = (n: number) => Math.round(n * 100);
const sum = (rows: readonly { amount: number }[]) => rows.reduce((t, r) => t + cents(r.amount), 0) / 100;

export type ExpenseTotals = { total: number; operating: number; material: number; capital: number };

export function summarize(rows: readonly ExpenseLike[]): ExpenseTotals {
  const of = (t: ExpenseType) => sum(rows.filter((r) => r.expenseType === t));
  return { total: sum(rows), operating: of("operating"), material: of("material"), capital: of("capital") };
}

/**
 * The only figure future profit calculations may deduct as an expense. Material purchases are
 * excluded because their consumption is already counted in Product Costing; capital purchases
 * are excluded because they are not running costs.
 */
export function operatingExpenseTotal(rows: readonly ExpenseLike[]): number {
  return sum(rows.filter((r) => r.expenseType === "operating"));
}

export type CategoryBreakdown = {
  categoryId: string;
  name: string;
  type: ExpenseType;
  total: number;
  count: number;
  share: number; // 0..1 of the overall total
};

export function breakdownByCategory(rows: readonly ExpenseLike[]): CategoryBreakdown[] {
  const grand = cents(sum(rows));
  const map = new Map<string, { name: string; type: ExpenseType; cents: number; count: number }>();
  for (const r of rows) {
    const e = map.get(r.categoryId) ?? { name: r.categoryName, type: r.expenseType, cents: 0, count: 0 };
    e.cents += cents(r.amount);
    e.count += 1;
    map.set(r.categoryId, e);
  }
  return [...map.entries()]
    .map(([categoryId, e]) => ({
      categoryId,
      name: e.name,
      type: e.type,
      total: e.cents / 100,
      count: e.count,
      share: grand > 0 ? e.cents / grand : 0,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

export type ExpenseFilter = { query: string; from: string; to: string; categoryId: string };

/** Search matches title or description. Dates are inclusive ISO strings; empty means unbounded. */
export function filterExpenses<T extends ExpenseLike>(rows: readonly T[], f: ExpenseFilter): T[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.from && r.expenseDate < f.from) return false;
    if (f.to && r.expenseDate > f.to) return false;
    if (f.categoryId && f.categoryId !== "all" && r.categoryId !== f.categoryId) return false;
    return !q || r.title.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q);
  });
}

const pad = (n: number) => String(n).padStart(2, "0");

/** First and last day of the month `offset` months from the month of `todayIso`. */
export function monthRange(todayIso: string, offset = 0): { from: string; to: string } {
  const [y, m] = todayIso.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + offset, 1));
  const last = new Date(Date.UTC(y, m + offset, 0));
  const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return { from: iso(first), to: iso(last) };
}

export const isIsoDate = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
