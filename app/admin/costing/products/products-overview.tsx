"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ChevronRight, Plus, Search, Tags, TriangleAlert, UtensilsCrossed } from "lucide-react";
import {
  createProductCategoryAction,
  renameProductCategoryAction,
  saveProductAction,
  setProductCategoryActiveAction,
  type ActionResult,
} from "./actions";
import { formatPeso } from "@/src/lib/ingredient-cost";
import type { Category } from "@/src/lib/ingredients";
import type { ProductCost } from "@/src/lib/product-cost";
import { CategoriesDialog } from "../_components/categories-dialog";
import { ProductFormDialog, type ProductFormValues } from "./product-form";
import { StatusBadge, fieldClass, formatMargin } from "./product-ui";

export function ProductsOverview({ products, categories }: { products: ProductCost[]; categories: Category[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("active");
  const [form, setForm] = useState<ProductFormValues | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (status === "active" && !p.isActive) return false;
      if (status === "inactive" && p.isActive) return false;
      if (categoryFilter !== "all" && p.categoryId !== categoryFilter) return false;
      return !q || p.label.toLowerCase().includes(q);
    });
  }, [products, query, status, categoryFilter]);

  const live = products.filter((p) => p.isActive);
  const complete = live.filter((p) => p.complete).length;
  const href = (p: ProductCost) => `/admin/costing/products/${encodeURIComponent(p.productId)}`;
  const hasActiveCategory = categories.some((c) => c.isActive);

  const run = (work: () => Promise<ActionResult>, success: string, onOk: (result: ActionResult) => void) => {
    setDialogError(null);
    startTransition(async () => {
      const result = await work();
      if (result.ok) {
        onOk(result);
        setToast({ ok: true, text: success });
        router.refresh();
      } else {
        setDialogError(result.error);
        setToast({ ok: false, text: result.error });
      }
    });
  };

  const openAdd = () => {
    setDialogError(null);
    setForm({ id: null, name: "", categoryId: categories.find((c) => c.isActive)?.id ?? "", unitLabel: "piece" });
  };

  const submitProduct = (values: ProductFormValues) =>
    run(
      () => saveProductAction(values),
      "Product added.",
      (result) => {
        setForm(null);
        if (result.ok && result.id) router.push(`/admin/costing/products/${encodeURIComponent(result.id)}`);
      },
    );

  const categoryBadge = (p: ProductCost) =>
    p.categoryName ? (
      <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-[13px] font-medium whitespace-nowrap text-brand">{p.categoryName}</span>
    ) : (
      <span className="text-[13px] text-label2">No category</span>
    );

  const statusBadge = (p: ProductCost) =>
    p.isActive ? (
      <StatusBadge product={p} />
    ) : (
      <span className="rounded-full bg-fill px-2.5 py-0.5 text-[13px] font-medium text-label2">Archived</span>
    );

  return (
    <div className="flex animate-ios-in flex-col gap-5">
      <section aria-label="Summary" className="grid grid-cols-3 gap-2 md:gap-3">
        <Stat label="Products" value={live.length} />
        <Stat label="Fully costed" value={complete} />
        <Stat label="Need attention" value={live.length - complete} />
      </section>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-label2" aria-hidden />
          <label htmlFor="product-search" className="sr-only">Search products</label>
          <input
            id="product-search"
            type="search"
            placeholder="Search products"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${fieldClass} pl-11`}
          />
        </div>
        <div className="flex gap-2">
          <label htmlFor="product-category-filter" className="sr-only">Filter by category</label>
          <select
            id="product-category-filter"
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
          <label htmlFor="product-status-filter" className="sr-only">Filter by status</label>
          <select
            id="product-status-filter"
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
            disabled={!hasActiveCategory}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80 disabled:opacity-50 lg:flex-none"
          >
            <Plus className="size-5" aria-hidden />
            Add
          </button>
        </div>
      </div>

      {!hasActiveCategory && (
        <p className="rounded-xl bg-brand-tint p-3.5 text-[15px] text-brand">
          Create a product category first, then you can add products.
        </p>
      )}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-separator bg-card p-8 text-center shadow-sm">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-tint text-brand">
            <UtensilsCrossed className="size-6" aria-hidden />
          </span>
          <p className="text-[17px] font-medium">No products match your filters</p>
          <p className="max-w-xs text-[15px] text-label2">Try a different search, category or status.</p>
        </div>
      ) : (
        <>
          <ul className="overflow-hidden rounded-xl border border-separator bg-card shadow-sm lg:hidden">
            {visible.map((p) => (
              <li key={p.productId} className={`border-b border-separator last:border-b-0 ${p.isActive ? "" : "opacity-70"}`}>
                <Link href={href(p)} className="flex flex-col gap-3 p-4 transition active:bg-fill">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[17px] font-medium">{p.label}</p>
                      <div className="mt-1">{categoryBadge(p)}</div>
                    </div>
                    <span className="flex shrink-0 items-center gap-1">
                      {statusBadge(p)}
                      <ChevronRight className="size-5 text-label2" aria-hidden />
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[15px]">
                    <Metric label="Cost" value={p.totalCost === null ? "—" : formatPeso(p.totalCost)} />
                    <Metric label="Selling price" value={p.sellingPrice === null ? "Not set" : formatPeso(p.sellingPrice)} />
                    <Metric label="Gross profit" value={p.grossProfit === null ? "—" : formatPeso(p.grossProfit)} />
                    <Metric label="Margin" value={formatMargin(p.marginPct)} />
                  </dl>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-xl border border-separator bg-card shadow-sm lg:block">
            <table className="w-full text-left text-[15px]">
              <thead className="border-b border-separator text-[13px] text-label2">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Product</th>
                  <th scope="col" className="px-4 py-3 font-medium">Category</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Total cost</th>
                  <th scope="col" className="px-4 py-3 font-medium">Selling price</th>
                  <th scope="col" className="px-4 py-3 font-medium">Gross profit</th>
                  <th scope="col" className="px-4 py-3 font-medium">Margin</th>
                  <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.productId} className={`border-b border-separator last:border-b-0 hover:bg-fill/60 ${p.isActive ? "" : "opacity-70"}`}>
                    <td className="px-4 py-3 font-medium">
                      <Link href={href(p)} className="hover:underline">{p.label}</Link>
                    </td>
                    <td className="px-4 py-3">{categoryBadge(p)}</td>
                    <td className="px-4 py-3">{statusBadge(p)}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{p.totalCost === null ? "—" : formatPeso(p.totalCost)}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{p.sellingPrice === null ? "Not set" : formatPeso(p.sellingPrice)}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{p.grossProfit === null ? "—" : formatPeso(p.grossProfit)}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatMargin(p.marginPct)}</td>
                    <td className="px-4 py-3">
                      <Link href={href(p)} aria-label={`Open ${p.label}`} className="flex size-9 items-center justify-center rounded-lg bg-fill">
                        <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-[13px] text-label2">
        Costs are per unit and always use the current ingredient prices. A product without a full cost shows “—”,
        never a partial total.
      </p>

      {form && (
        <ProductFormDialog
          initial={form}
          recipeProduct={false}
          categories={categories}
          pending={pending}
          error={dialogError}
          onSubmit={submitProduct}
          onClose={() => setForm(null)}
        />
      )}

      {showCategories && (
        <CategoriesDialog
          categories={categories}
          noun="products"
          pending={pending}
          error={dialogError}
          run={(work, success, onOk) => run(work, success, () => onOk())}
          actions={{
            create: createProductCategoryAction,
            rename: renameProductCategoryAction,
            setActive: setProductCategoryActiveAction,
          }}
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

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-[13px] text-label2">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
