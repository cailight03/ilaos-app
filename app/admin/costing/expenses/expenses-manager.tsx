"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  ExternalLink,
  Info,
  Paperclip,
  Pencil,
  Plus,
  Receipt,
  Search,
  ShoppingBasket,
  Tags,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import {
  createExpenseCategoryAction,
  getReceiptUrlAction,
  renameExpenseCategoryAction,
  saveExpenseAction,
  setExpenseArchivedAction,
  setExpenseCategoryActiveAction,
  type ActionResult,
} from "./actions";
import {
  EXPENSE_TYPES,
  EXPENSE_TYPE_HINT,
  EXPENSE_TYPE_LABEL,
  MAX_RECEIPT_BYTES,
  RECEIPT_TYPES,
  breakdownByCategory,
  filterExpenses,
  monthRange,
  summarize,
  type ExpenseType,
} from "@/src/lib/expense-types";
import { formatPeso, parseAmount } from "@/src/lib/ingredient-cost";
import type { Expense, ExpenseCategory } from "@/src/lib/expenses";
import { SheetModal } from "../../_components/sheet-modal";
import { DatePicker } from "../../_components/date-picker";
import { CategoriesDialog } from "../_components/categories-dialog";

type Editor = {
  id: string | null;
  title: string;
  categoryId: string;
  amount: string;
  expenseDate: string;
  description: string;
  existingReceipt: string | null;
  clearReceipt: boolean;
};

type Range = "month" | "last" | "all" | "custom";

const fieldClass =
  "h-11 w-full min-w-0 rounded-xl border border-separator bg-card px-3.5 text-[17px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";

const dateFmt = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });
const dateTimeFmt = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
const manilaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
const fmtDate = (iso: string) => dateFmt.format(new Date(`${iso}T12:00:00+08:00`));

const TYPE_OPTIONS = EXPENSE_TYPES.map((t) => ({ value: t, label: EXPENSE_TYPE_LABEL[t] }));

export function ExpensesManager({
  expenses,
  categories,
}: {
  expenses: Expense[];
  categories: ExpenseCategory[];
}) {
  const [today] = useState(manilaToday);
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<Range>("month");
  const [custom, setCustom] = useState(() => monthRange(manilaToday()));
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [detail, setDetail] = useState<Expense | null>(null);
  const [confirm, setConfirm] = useState<Expense | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const { from, to } = useMemo(() => {
    if (range === "month") return monthRange(today);
    if (range === "last") return monthRange(today, -1);
    if (range === "custom") return custom;
    return { from: "", to: "" };
  }, [range, custom, today]);

  const inStatus = useMemo(
    () => expenses.filter((e) => e.isArchived === (status === "archived")),
    [expenses, status],
  );
  // Totals and the breakdown follow the date range and search but ignore the category filter,
  // so the breakdown always shows every category for the period.
  const inPeriod = useMemo(
    () => filterExpenses(inStatus, { query, from, to, categoryId: "all" }),
    [inStatus, query, from, to],
  );
  const visible = useMemo(
    () => (categoryFilter === "all" ? inPeriod : inPeriod.filter((e) => e.categoryId === categoryFilter)),
    [inPeriod, categoryFilter],
  );
  const totals = useMemo(() => summarize(inPeriod), [inPeriod]);
  const breakdown = useMemo(() => breakdownByCategory(inPeriod), [inPeriod]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const run = (work: () => Promise<ActionResult>, success: string, onOk: () => void) => {
    setDialogError(null);
    startTransition(async () => {
      const result = await work();
      if (result.ok) {
        onOk();
        setToast({ ok: true, text: success });
      } else {
        setDialogError(result.error);
        setToast({ ok: false, text: result.error });
      }
    });
  };

  const activeCategories = categories.filter((c) => c.isActive);

  const openAdd = () => {
    setDialogError(null);
    setFile(null);
    setEditor({
      id: null,
      title: "",
      categoryId: activeCategories[0]?.id ?? "",
      amount: "",
      expenseDate: today,
      description: "",
      existingReceipt: null,
      clearReceipt: false,
    });
  };

  const openEdit = (e: Expense) => {
    setDialogError(null);
    setFile(null);
    setDetail(null);
    setEditor({
      id: e.id,
      title: e.title,
      categoryId: e.categoryId,
      amount: String(e.amount),
      expenseDate: e.expenseDate,
      description: e.description ?? "",
      existingReceipt: e.hasReceipt ? (e.receiptName ?? "Receipt") : null,
      clearReceipt: false,
    });
  };

  const closeEditor = () => {
    setEditor(null);
    setFile(null);
  };

  const pickFile = (f: File | null) => {
    if (!f) return setFile(null);
    if (!(f.type in RECEIPT_TYPES)) {
      setDialogError("Receipt must be a JPEG, PNG, WebP or PDF file.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    if (f.size > MAX_RECEIPT_BYTES) {
      setDialogError("Receipt is too large (5 MB max).");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setDialogError(null);
    setFile(f);
  };

  const save = () => {
    if (!editor) return;
    const amount = parseAmount(editor.amount);
    const problem = !editor.title.trim()
      ? "Enter an expense title."
      : !editor.categoryId
        ? "Choose a category."
        : Number.isNaN(amount)
          ? "Enter the amount."
          : amount <= 0
            ? "Amount must be greater than zero."
            : !editor.expenseDate
              ? "Choose the expense date."
              : null;
    if (problem) return setDialogError(problem);

    const fd = new FormData();
    fd.set("id", editor.id ?? "");
    fd.set("title", editor.title);
    fd.set("categoryId", editor.categoryId);
    fd.set("amount", String(amount));
    fd.set("expenseDate", editor.expenseDate);
    fd.set("description", editor.description);
    if (file) fd.set("receipt", file);
    if (editor.clearReceipt) fd.set("clearReceipt", "1");
    run(() => saveExpenseAction(fd), editor.id ? "Expense updated." : "Expense added.", closeEditor);
  };

  const archive = () => {
    if (!confirm) return;
    run(() => setExpenseArchivedAction(confirm.id, true), "Expense archived.", () => {
      setConfirm(null);
      setDetail(null);
    });
  };

  const restore = (e: Expense) =>
    run(() => setExpenseArchivedAction(e.id, false), "Expense restored.", () => setDetail(null));

  const openReceipt = (e: Expense) => {
    // Open the tab synchronously so mobile browsers don't block it after the async call.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    startTransition(async () => {
      const r = await getReceiptUrlAction(e.id);
      if (r.ok && tab) {
        tab.location.href = r.url;
      } else {
        tab?.close();
        setToast({ ok: false, text: r.ok ? "Allow pop-ups to view the receipt." : r.error });
      }
    });
  };

  const typeBadge = (t: ExpenseType) => <Badge tone={t === "operating" ? "brand" : "muted"}>{EXPENSE_TYPE_LABEL[t]}</Badge>;

  const selectedCategory = editor ? categoryById.get(editor.categoryId) : undefined;
  const editorCategories = editor ? categories.filter((c) => c.isActive || c.id === editor.categoryId) : [];

  const periodLabel =
    range === "all" ? "all time" : range === "month" ? "this month" : range === "last" ? "last month" : "the selected dates";

  return (
    <div className="flex animate-ios-in flex-col gap-5">
      <section aria-label="Summary" className="flex flex-col gap-2 md:gap-3">
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <SummaryCard label="Total" value={totals.total} Icon={Wallet} />
          <SummaryCard label="Operating" value={totals.operating} Icon={Receipt} />
          <SummaryCard label="Materials" value={totals.material} Icon={ShoppingBasket} />
        </div>
        <p className="flex items-start gap-2 text-[13px] text-label2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Materials (ingredients and packaging) are already counted in Product Costing, so they aren&apos;t deducted
            again as operating expenses. Capital purchases such as equipment ({formatPeso(totals.capital)} {periodLabel}) are
            tracked separately.
          </span>
        </p>
      </section>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-label2" aria-hidden />
          <label htmlFor="expense-search" className="sr-only">Search expenses</label>
          <input
            id="expense-search"
            type="search"
            placeholder="Search title or description"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${fieldClass} pl-11`}
          />
        </div>
        <div className="flex gap-2">
          <label htmlFor="range-filter" className="sr-only">Date range</label>
          <select
            id="range-filter"
            value={range}
            onChange={(e) => setRange(e.target.value as Range)}
            className={`${fieldClass} min-w-0 flex-1 lg:w-40 lg:flex-none`}
          >
            <option value="month">This month</option>
            <option value="last">Last month</option>
            <option value="all">All time</option>
            <option value="custom">Custom range</option>
          </select>
          <label htmlFor="category-filter" className="sr-only">Filter by category</label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={`${fieldClass} min-w-0 flex-1 lg:w-48 lg:flex-none`}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.isActive ? "" : " (archived)"}
              </option>
            ))}
          </select>
          <label htmlFor="status-filter" className="sr-only">Filter by status</label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className={`${fieldClass} min-w-0 flex-1 lg:w-32 lg:flex-none`}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setDialogError(null);
              setShowCategories(true);
            }}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-fill px-4 text-[17px] font-medium transition active:opacity-70"
          >
            <Tags className="size-5" aria-hidden />
            Categories
          </button>
          <button
            type="button"
            onClick={openAdd}
            disabled={activeCategories.length === 0}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-5 text-[17px] font-semibold text-white shadow-sm transition active:scale-[0.98] active:opacity-80 disabled:opacity-50 lg:flex-none"
          >
            <Plus className="size-5" aria-hidden />
            Add Expense
          </button>
        </div>
      </div>

      {range === "custom" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <DatePicker label="From" value={custom.from} onChange={(v) => setCustom({ from: v, to: v > custom.to ? v : custom.to })} />
          <DatePicker label="To" value={custom.to} onChange={(v) => setCustom({ from: v < custom.from ? v : custom.from, to: v })} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section aria-label="Breakdown by category" className="rounded-xl border border-separator bg-card p-4 shadow-sm lg:order-2">
          <h2 className="text-[17px] font-semibold">By category</h2>
          {breakdown.length === 0 ? (
            <p className="mt-2 text-[15px] text-label2">No expenses in this period.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {breakdown.map((b) => (
                <li key={b.categoryId}>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter(categoryFilter === b.categoryId ? "all" : b.categoryId)}
                    aria-pressed={categoryFilter === b.categoryId}
                    className="flex w-full flex-col gap-1.5 text-left"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={`min-w-0 truncate text-[15px] ${categoryFilter === b.categoryId ? "font-semibold text-brand" : ""}`}>
                        {b.name}
                      </span>
                      <span className="shrink-0 text-[15px] font-medium tabular-nums">{formatPeso(b.total)}</span>
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-fill" aria-hidden>
                      <span
                        className={`block h-full rounded-full ${b.type === "operating" ? "bg-brand" : "bg-label2"}`}
                        style={{ width: `${Math.max(b.share * 100, 2)}%` }}
                      />
                    </span>
                    <span className="flex justify-between text-[13px] text-label2">
                      <span>{EXPENSE_TYPE_LABEL[b.type]} · {b.count} {b.count === 1 ? "expense" : "expenses"}</span>
                      <span>{(b.share * 100).toFixed(1)}%</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Expenses" className="min-w-0 lg:order-1">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-separator bg-card p-8 text-center shadow-sm">
              <span className="flex size-12 items-center justify-center rounded-full bg-brand-tint text-brand">
                <Receipt className="size-6" aria-hidden />
              </span>
              <p className="text-[17px] font-medium">{expenses.length === 0 ? "No expenses yet" : "No expenses match your filters"}</p>
              <p className="max-w-xs text-[15px] text-label2">
                {expenses.length === 0
                  ? "Record your first expense to start tracking what it costs to run the bakery."
                  : "Try a different search, date range or category."}
              </p>
              {expenses.length === 0 && activeCategories.length > 0 && (
                <button
                  type="button"
                  onClick={openAdd}
                  className="mt-2 h-11 rounded-xl bg-brand px-5 text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80"
                >
                  Add Expense
                </button>
              )}
            </div>
          ) : (
            <>
              <ul className="overflow-hidden rounded-xl border border-separator bg-card shadow-sm lg:hidden">
                {visible.map((e) => (
                  <li key={e.id} className="border-b border-separator last:border-b-0">
                    <button type="button" onClick={() => setDetail(e)} className="flex w-full flex-col gap-2 p-4 text-left transition active:bg-fill">
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-[17px] font-medium">{e.title}</span>
                          <span className="block text-[15px] text-label2">{fmtDate(e.expenseDate)}</span>
                        </span>
                        <span className="shrink-0 text-[17px] font-semibold tabular-nums">{formatPeso(e.amount)}</span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge tone="brand">{e.categoryName}</Badge>
                        {e.expenseType !== "operating" && typeBadge(e.expenseType)}
                        {e.hasReceipt && <Paperclip className="size-4 text-label2" aria-label="Has receipt" />}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="hidden overflow-hidden rounded-xl border border-separator bg-card shadow-sm lg:block">
                <table className="w-full text-left text-[15px]">
                  <thead className="border-b border-separator text-[13px] text-label2">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Date</th>
                      <th scope="col" className="px-4 py-3 font-medium">Expense</th>
                      <th scope="col" className="px-4 py-3 font-medium">Category</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((e) => (
                      <tr key={e.id} onClick={() => setDetail(e)} className="cursor-pointer border-b border-separator transition last:border-b-0 hover:bg-fill/60">
                        <td className="px-4 py-3 whitespace-nowrap text-label2">{fmtDate(e.expenseDate)}</td>
                        <td className="max-w-64 px-4 py-3">
                          <button type="button" onClick={(ev) => { ev.stopPropagation(); setDetail(e); }} className="flex max-w-full items-center gap-1.5 text-left font-medium">
                            <span className="truncate">{e.title}</span>
                            {e.hasReceipt && <Paperclip className="size-4 shrink-0 text-label2" aria-label="Has receipt" />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <Badge tone="brand">{e.categoryName}</Badge>
                            {e.expenseType !== "operating" && typeBadge(e.expenseType)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums">{formatPeso(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      {detail && (
        <SheetModal title="Expense" dismissible={!pending} onClose={() => setDetail(null)}>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[22px] leading-7 font-semibold break-words">{detail.title}</p>
              <p className="text-[28px] leading-9 font-bold tracking-tight tabular-nums">{formatPeso(detail.amount)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone="brand">{detail.categoryName}</Badge>
                {typeBadge(detail.expenseType)}
                {detail.isArchived && <Badge tone="muted">Archived</Badge>}
              </div>
            </div>
            <dl className="divide-y divide-separator rounded-xl border border-separator bg-card text-[15px]">
              <Detail label="Expense date" value={fmtDate(detail.expenseDate)} />
              <Detail label="Description" value={detail.description} />
              <Detail label="Created by" value={detail.createdBy} />
              <Detail label="Created" value={dateTimeFmt.format(new Date(detail.createdAt))} />
              <Detail label="Updated" value={dateTimeFmt.format(new Date(detail.updatedAt))} />
            </dl>
            {detail.hasReceipt && (
              <button
                type="button"
                onClick={() => openReceipt(detail)}
                disabled={pending}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-tint text-[17px] font-medium text-brand transition active:opacity-70 disabled:opacity-50"
              >
                <ExternalLink className="size-5" aria-hidden />
                View receipt{detail.receiptName ? ` (${detail.receiptName})` : ""}
              </button>
            )}
            <div className="flex gap-3">
              {detail.isArchived ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => restore(detail)}
                  className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand text-[17px] font-semibold text-white transition active:opacity-80 disabled:opacity-50"
                >
                  <ArchiveRestore className="size-5" aria-hidden />
                  Restore
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setDialogError(null);
                      setConfirm(detail);
                    }}
                    className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-fill text-[17px] font-medium text-red-600 transition active:opacity-70"
                  >
                    <Archive className="size-5" aria-hidden />
                    Archive
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(detail)}
                    className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand text-[17px] font-semibold text-white transition active:opacity-80"
                  >
                    <Pencil className="size-5" aria-hidden />
                    Edit
                  </button>
                </>
              )}
            </div>
          </div>
        </SheetModal>
      )}

      {editor && (
        <SheetModal title={editor.id ? "Edit expense" : "Add expense"} dismissible={!pending} onClose={closeEditor}>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="flex flex-col gap-4"
          >
            {dialogError && <ErrorNote>{dialogError}</ErrorNote>}
            <Field label="Expense title" htmlFor="x-title">
              <input
                id="x-title"
                type="text"
                required
                maxLength={120}
                value={editor.title}
                onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Category" htmlFor="x-category">
              <select
                id="x-category"
                value={editor.categoryId}
                onChange={(e) => setEditor({ ...editor, categoryId: e.target.value })}
                className={fieldClass}
              >
                {editorCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.isActive ? "" : " (archived)"}
                  </option>
                ))}
              </select>
              {selectedCategory && (
                <p className="text-[13px] text-label2">
                  <span className="font-medium">{EXPENSE_TYPE_LABEL[selectedCategory.expenseType]}.</span>{" "}
                  {EXPENSE_TYPE_HINT[selectedCategory.expenseType]}
                </p>
              )}
            </Field>
            <Field label="Amount (PHP)" htmlFor="x-amount">
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[17px] text-label2" aria-hidden>₱</span>
                <input
                  id="x-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="1,250.00"
                  value={editor.amount}
                  onChange={(e) => setEditor({ ...editor, amount: e.target.value })}
                  className={`${fieldClass} pl-8`}
                />
              </div>
            </Field>
            <DatePicker label="Expense date" value={editor.expenseDate} onChange={(v) => setEditor({ ...editor, expenseDate: v })} />
            <Field label="Description (optional)" htmlFor="x-desc">
              <textarea
                id="x-desc"
                rows={3}
                maxLength={1000}
                value={editor.description}
                onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                className="w-full min-w-0 rounded-xl border border-separator bg-card px-3.5 py-2.5 text-[17px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
              />
            </Field>
            <Field label="Receipt or proof of payment (optional)" htmlFor="x-receipt">
              {editor.existingReceipt && !editor.clearReceipt && !file && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-fill px-3.5 py-2.5 text-[15px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <Paperclip className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{editor.existingReceipt}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditor({ ...editor, clearReceipt: true })}
                    className="shrink-0 font-medium text-red-600"
                  >
                    Remove
                  </button>
                </div>
              )}
              {editor.clearReceipt && !file && (
                <p className="text-[15px] text-label2">
                  Receipt will be removed.{" "}
                  <button type="button" onClick={() => setEditor({ ...editor, clearReceipt: false })} className="font-medium text-brand">
                    Undo
                  </button>
                </p>
              )}
              <input
                ref={fileInput}
                id="x-receipt"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                className="block w-full text-[15px] file:mr-3 file:h-10 file:rounded-lg file:border-0 file:bg-fill file:px-4 file:text-[15px] file:font-medium file:text-foreground"
              />
              <p className="text-[13px] text-label2">
                JPEG, PNG, WebP or PDF, up to 5 MB.{editor.existingReceipt && file ? " This replaces the current receipt." : ""}
              </p>
            </Field>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={closeEditor}
                disabled={pending}
                className="h-12 flex-1 rounded-xl bg-fill text-[17px] font-medium transition active:opacity-70 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="h-12 flex-1 rounded-xl bg-brand text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </SheetModal>
      )}

      {confirm && (
        <SheetModal title="Archive expense?" dismissible={!pending} onClose={() => setConfirm(null)}>
          <div className="flex flex-col gap-4">
            {dialogError && <ErrorNote>{dialogError}</ErrorNote>}
            <p className="text-[15px] text-label2">
              {confirm.title} ({formatPeso(confirm.amount)}) will be removed from totals and active lists. The record and
              its receipt are kept, and you can restore it any time under Archived.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                disabled={pending}
                className="h-12 flex-1 rounded-xl bg-fill text-[17px] font-medium transition active:opacity-70 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={archive}
                disabled={pending}
                className="h-12 flex-1 rounded-xl bg-red-600 text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80 disabled:opacity-50"
              >
                {pending ? "Working…" : "Archive"}
              </button>
            </div>
          </div>
        </SheetModal>
      )}

      {showCategories && (
        <CategoriesDialog
          categories={categories.map((c) => ({ id: c.id, name: c.name, isActive: c.isActive, tag: EXPENSE_TYPE_LABEL[c.expenseType] }))}
          noun="expenses"
          typeOptions={TYPE_OPTIONS}
          actions={{
            create: createExpenseCategoryAction,
            rename: renameExpenseCategoryAction,
            setActive: setExpenseCategoryActiveAction,
          }}
          pending={pending}
          error={dialogError}
          run={run}
          onClose={() => setShowCategories(false)}
        />
      )}

      {toast && (
        <div
          role="status"
          className={`fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-sm items-center gap-2 rounded-xl px-4 py-3 text-[15px] font-medium text-white shadow-lg lg:bottom-6 ${
            toast.ok ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.ok ? <Check className="size-5 shrink-0" aria-hidden /> : <TriangleAlert className="size-5 shrink-0" aria-hidden />}
          {toast.text}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, Icon }: { label: string; value: number; Icon: typeof Wallet }) {
  return (
    <div className="min-w-0 rounded-xl border border-separator bg-card p-3 shadow-sm md:p-4">
      <span className="flex size-7 items-center justify-center rounded-lg bg-brand-tint text-brand">
        <Icon className="size-4" aria-hidden />
      </span>
      <p className="mt-2 truncate text-[17px] leading-6 font-bold tracking-tight tabular-nums md:text-[28px] md:leading-8">
        {formatPeso(value)}
      </p>
      <p className="text-[13px] text-label2 md:text-[15px]">{label}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 px-3.5 py-2.5">
      <dt className="shrink-0 text-label2">{label}</dt>
      <dd className="min-w-0 text-right break-words">{value || "—"}</dd>
    </div>
  );
}

function Badge({ tone, children }: { tone: "brand" | "muted"; children: ReactNode }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[13px] font-medium ${
        tone === "brand" ? "bg-brand-tint text-brand" : "bg-fill text-label2"
      }`}
    >
      {children}
    </span>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[15px] font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-600/10 p-3 text-[15px] text-red-600">
      <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      {children}
    </div>
  );
}
