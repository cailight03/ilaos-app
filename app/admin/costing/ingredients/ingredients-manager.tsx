"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  Package,
  Pencil,
  Plus,
  Search,
  Tags,
  TriangleAlert,
} from "lucide-react";
import {
  createCategoryAction,
  renameCategoryAction,
  saveIngredientAction,
  setCategoryActiveAction,
  setIngredientActiveAction,
  type ActionResult,
} from "./actions";
import {
  UNITS,
  baseUnitOf,
  costPerBaseUnit,
  formatPeso,
  formatQuantity,
  formatUnitCost,
  parseAmount,
  type Unit,
} from "@/src/lib/ingredient-cost";
import type { Category, Ingredient } from "@/src/lib/ingredients";
import { SheetModal } from "../../_components/sheet-modal";
import { CategoriesDialog } from "../_components/categories-dialog";

type Editor = {
  id: string | null;
  name: string;
  categoryId: string;
  quantity: string;
  unit: Unit;
  price: string;
  supplier: string;
};

const fieldClass =
  "h-11 w-full min-w-0 rounded-xl border border-separator bg-card px-3.5 text-[17px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";

const dateFmt = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

export function IngredientsManager({
  ingredients,
  categories,
}: {
  ingredients: Ingredient[];
  categories: Category[];
}) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("active");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [confirm, setConfirm] = useState<Ingredient | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const total = ingredients.length;
  const active = ingredients.filter((i) => i.isActive).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ingredients.filter((i) => {
      if (status === "active" && !i.isActive) return false;
      if (status === "inactive" && i.isActive) return false;
      if (categoryFilter !== "all" && i.categoryId !== categoryFilter) return false;
      return !q || i.name.toLowerCase().includes(q);
    });
  }, [ingredients, query, status, categoryFilter]);

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

  const openAdd = () => {
    setDialogError(null);
    const first = categories.find((c) => c.isActive);
    setEditor({ id: null, name: "", categoryId: first?.id ?? "", quantity: "", unit: "g", price: "", supplier: "" });
  };

  const openEdit = (i: Ingredient) => {
    setDialogError(null);
    setEditor({
      id: i.id,
      name: i.name,
      categoryId: i.categoryId,
      quantity: String(i.purchaseQuantity),
      unit: i.purchaseUnit,
      price: String(i.purchasePrice),
      supplier: i.supplier ?? "",
    });
  };

  const closeEditor = () => {
    setEditor(null);
  };

  const quantity = editor ? parseAmount(editor.quantity) : NaN;
  const price = editor ? parseAmount(editor.price) : NaN;
  const preview = editor ? costPerBaseUnit(quantity, editor.unit, price) : null;

  const validate = (e: Editor): string | null => {
    if (!e.name.trim()) return "Enter an ingredient name.";
    if (!e.categoryId) return "Choose a category.";
    if (!(quantity > 0)) return "Quantity must be greater than zero.";
    if (Number.isNaN(price)) return "Enter the purchase price.";
    if (price < 0) return "Price can't be negative.";
    return null;
  };

  const save = () => {
    if (!editor) return;
    const problem = validate(editor);
    if (problem) {
      setDialogError(problem);
      return;
    }
    run(
      () =>
        saveIngredientAction({
          id: editor.id,
          name: editor.name,
          categoryId: editor.categoryId,
          purchaseQuantity: quantity,
          purchaseUnit: editor.unit,
          purchasePrice: price,
          supplier: editor.supplier,
        }),
      editor.id ? "Ingredient updated." : "Ingredient added.",
      closeEditor,
    );
  };

  const archive = () => {
    if (!confirm) return;
    run(() => setIngredientActiveAction(confirm.id, false), "Ingredient archived.", () => setConfirm(null));
  };

  const restore = (i: Ingredient) =>
    run(() => setIngredientActiveAction(i.id, true), "Ingredient restored.", () => {});

  const categoryOptions = editor
    ? categories.filter((c) => c.isActive || c.id === editor.categoryId)
    : [];

  const rowActions = (i: Ingredient) => (
    <>
      <button
        type="button"
        onClick={() => openEdit(i)}
        className="flex h-9 items-center gap-1 rounded-lg bg-fill px-3 text-[15px] font-medium transition hover:opacity-80 active:opacity-70"
      >
        <Pencil className="size-4" aria-hidden />
        Edit
      </button>
      {i.isActive ? (
        <button
          type="button"
          onClick={() => {
            setDialogError(null);
            setConfirm(i);
          }}
          className="flex h-9 items-center gap-1 rounded-lg px-3 text-[15px] font-medium text-red-600 transition hover:opacity-80 active:opacity-70"
        >
          <Archive className="size-4" aria-hidden />
          Archive
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => restore(i)}
          className="flex h-9 items-center gap-1 rounded-lg bg-fill px-3 text-[15px] font-medium transition hover:opacity-80 active:opacity-70 disabled:opacity-50"
        >
          <ArchiveRestore className="size-4" aria-hidden />
          Restore
        </button>
      )}
    </>
  );

  return (
    <div className="flex animate-ios-in flex-col gap-5">
      <section aria-label="Summary" className="grid grid-cols-3 gap-2 md:gap-3">
        <Stat label="Total" value={total} />
        <Stat label="Active" value={active} />
        <Stat label="Archived" value={total - active} />
      </section>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-label2" aria-hidden />
          <label htmlFor="ingredient-search" className="sr-only">Search ingredients</label>
          <input
            id="ingredient-search"
            type="search"
            placeholder="Search ingredients"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${fieldClass} pl-11`}
          />
        </div>
        <div className="flex gap-2">
          <label htmlFor="category-filter" className="sr-only">Filter by category</label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={`${fieldClass} min-w-0 flex-1 lg:w-44 lg:flex-none`}
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
            className={`${fieldClass} min-w-0 flex-1 lg:w-36 lg:flex-none`}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Archived</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setDialogError(null);
              setShowCategories(true);
            }}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-fill px-4 text-[17px] font-medium transition active:opacity-70 lg:flex-none"
          >
            <Tags className="size-5" aria-hidden />
            Categories
          </button>
          <button
            type="button"
            onClick={openAdd}
            disabled={!categories.some((c) => c.isActive)}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80 disabled:opacity-50 lg:flex-none"
          >
            <Plus className="size-5" aria-hidden />
            Add
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-separator bg-card p-8 text-center shadow-sm">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-tint text-brand">
            <Package className="size-6" aria-hidden />
          </span>
          <p className="text-[17px] font-medium">{total === 0 ? "No ingredients yet" : "No ingredients match your filters"}</p>
          <p className="max-w-xs text-[15px] text-label2">
            {total === 0
              ? "Add your first ingredient to start building your price library."
              : "Try a different search, category or status."}
          </p>
          {total === 0 && categories.some((c) => c.isActive) && (
            <button
              type="button"
              onClick={openAdd}
              className="mt-2 h-11 rounded-xl bg-brand px-5 text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80"
            >
              Add ingredient
            </button>
          )}
        </div>
      ) : (
        <>
          <ul className="overflow-hidden rounded-xl border border-separator bg-card shadow-sm lg:hidden">
            {visible.map((i) => (
              <li key={i.id} className={`flex flex-col gap-3 border-b border-separator p-4 last:border-b-0 ${i.isActive ? "" : "opacity-70"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-medium">{i.name}</p>
                    <p className="text-[15px] text-label2">
                      {formatQuantity(i.purchaseQuantity)} {i.purchaseUnit} · {formatPeso(i.purchasePrice)}
                    </p>
                  </div>
                  <div className="shrink-0 text-left">
                    <p className="text-[17px] font-semibold tabular-nums text-brand">{formatUnitCost(i.costPerBaseUnit)}</p>
                    <p className="text-[13px] text-label2">per {i.baseUnit}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="brand">{i.categoryName}</Badge>
                  {!i.isActive && <Badge tone="muted">Archived</Badge>}
                  {i.supplier && <span className="truncate text-[13px] text-label2">{i.supplier}</span>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-label2">Updated {dateFmt.format(new Date(i.updatedAt))}</span>
                  <div className="flex items-center gap-2">{rowActions(i)}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-xl border border-separator bg-card shadow-sm lg:block">
            <table className="w-full text-left text-[15px]">
              <thead className="border-b border-separator text-[13px] text-label2">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Ingredient</th>
                  <th scope="col" className="px-4 py-3 font-medium">Category</th>
                  <th scope="col" className="px-4 py-3 font-medium">Purchase</th>
                  <th scope="col" className="px-4 py-3 font-medium">Unit cost</th>
                  <th scope="col" className="px-4 py-3 font-medium">Supplier</th>
                  <th scope="col" className="px-4 py-3 font-medium">Updated</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((i) => (
                  <tr key={i.id} className={`border-b border-separator last:border-b-0 ${i.isActive ? "" : "opacity-70"}`}>
                    <td className="max-w-56 truncate px-4 py-3 font-medium">{i.name}</td>
                    <td className="px-4 py-3"><Badge tone="brand">{i.categoryName}</Badge></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatQuantity(i.purchaseQuantity)} {i.purchaseUnit} · {formatPeso(i.purchasePrice)}
                    </td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap tabular-nums">
                      {formatUnitCost(i.costPerBaseUnit)}
                      <span className="font-normal text-label2"> / {i.baseUnit}</span>
                    </td>
                    <td className="max-w-40 truncate px-4 py-3 text-label2">{i.supplier ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-label2">{dateFmt.format(new Date(i.updatedAt))}</td>
                    <td className="px-4 py-3"><Badge tone={i.isActive ? "brand" : "muted"}>{i.isActive ? "Active" : "Archived"}</Badge></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2">{rowActions(i)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editor && (
        <SheetModal title={editor.id ? "Edit ingredient" : "Add ingredient"} dismissible={!pending} onClose={() => closeEditor()}>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="flex flex-col gap-4"
          >
            {dialogError && <ErrorNote>{dialogError}</ErrorNote>}
            <Field label="Ingredient name" htmlFor="i-name">
              <input
                id="i-name"
                type="text"
                required
                maxLength={120}
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Category" htmlFor="i-category">
              <select
                id="i-category"
                value={editor.categoryId}
                onChange={(e) => setEditor({ ...editor, categoryId: e.target.value })}
                className={fieldClass}
              >
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.isActive ? "" : " (archived)"}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-[1fr_6.5rem] gap-3">
              <Field label="Purchase quantity" htmlFor="i-qty">
                <input
                  id="i-qty"
                  type="text"
                  inputMode="decimal"
                  placeholder="25"
                  value={editor.quantity}
                  onChange={(e) => setEditor({ ...editor, quantity: e.target.value })}
                  className={fieldClass}
                />
              </Field>
              <Field label="Unit" htmlFor="i-unit">
                <select
                  id="i-unit"
                  value={editor.unit}
                  onChange={(e) => setEditor({ ...editor, unit: e.target.value as Unit })}
                  className={fieldClass}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Purchase price (PHP)" htmlFor="i-price">
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[17px] text-label2" aria-hidden>₱</span>
                <input
                  id="i-price"
                  type="text"
                  inputMode="decimal"
                  placeholder="1,250.00"
                  value={editor.price}
                  onChange={(e) => setEditor({ ...editor, price: e.target.value })}
                  className={`${fieldClass} pl-8`}
                />
              </div>
            </Field>

            <div aria-live="polite" className="rounded-xl bg-brand-tint p-3.5 text-brand">
              <p className="text-[13px] font-medium">Cost per {baseUnitOf(editor.unit)}</p>
              {preview === null ? (
                <p className="text-[15px] opacity-80">Enter a quantity and price to see the unit cost.</p>
              ) : (
                <>
                  <p className="text-[22px] font-bold tracking-tight tabular-nums">
                    {formatUnitCost(preview)} <span className="text-[15px] font-medium">/ {baseUnitOf(editor.unit)}</span>
                  </p>
                  <p className="text-[13px] opacity-80">
                    {formatQuantity(quantity)} {editor.unit} for {formatPeso(price)}
                  </p>
                </>
              )}
            </div>

            <Field label="Supplier (optional)" htmlFor="i-supplier">
              <input
                id="i-supplier"
                type="text"
                maxLength={120}
                value={editor.supplier}
                onChange={(e) => setEditor({ ...editor, supplier: e.target.value })}
                className={fieldClass}
              />
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
        <SheetModal title="Archive ingredient?" dismissible={!pending} onClose={() => setConfirm(null)}>
          <div className="flex flex-col gap-4">
            {dialogError && <ErrorNote>{dialogError}</ErrorNote>}
            <p className="text-[15px] text-label2">
              {confirm.name} will be hidden from active lists. You can restore it any time.
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
          categories={categories}
          noun="ingredients"
          actions={{ create: createCategoryAction, rename: renameCategoryAction, setActive: setCategoryActiveAction }}
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-separator bg-card p-3 shadow-sm md:p-4">
      <p className="text-[28px] leading-8 font-bold tracking-tight tabular-nums">{value}</p>
      <p className="text-[15px] text-label2">{label}</p>
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
