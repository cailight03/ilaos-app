"use client";

import { useState, useTransition } from "react";
import { SheetModal } from "../../_components/sheet-modal";
import { ErrorNote, Field, fieldClass } from "../products/product-ui";
import type { CatalogProduct } from "@/src/lib/catalog";
import { deleteCatalogProductAction, saveCatalogProductAction } from "./actions";

type Cat = { id: string; name: string };

const peso = (n: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);

export function CatalogManager({ products, categories }: { products: CatalogProduct[]; categories: Cat[] }) {
  const [editing, setEditing] = useState<CatalogProduct | null>(null);

  return (
    <>
      <p className="text-[15px] text-label2">
        What the storefront shows. Published products appear publicly; recipes and costs never do.
      </p>
      <ul className="flex flex-col divide-y divide-separator rounded-xl bg-card">
        {products.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setEditing(p)}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-medium">{p.name}</p>
                <p className="truncate text-[15px] text-label2">
                  {p.categoryName} · {p.price === null ? "No price" : peso(p.price)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-medium ${
                  p.isPublished ? "bg-green-600/15 text-green-700" : "bg-fill text-label2"
                }`}
              >
                {p.isPublished ? "Published" : "Draft"}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {editing && (
        <ProductDialog key={editing.id} product={editing} categories={categories} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function ProductDialog({
  product,
  categories,
  onClose,
}: {
  product: CatalogProduct;
  categories: Cat[];
  onClose: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [price, setPrice] = useState(product.price === null ? "" : String(product.price));
  const [imagePath, setImagePath] = useState(product.imagePath ?? "");
  const [published, setPublished] = useState(product.isPublished);
  const [hasSlicing, setHasSlicing] = useState(product.hasSlicing);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The product's category may be archived; keep it selectable so saving doesn't silently move it.
  const options = categories.some((c) => c.id === product.categoryId)
    ? categories
    : [...categories, { id: product.categoryId, name: product.categoryName }];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = price.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setError("Enter a valid price.");
      return;
    }
    startTransition(async () => {
      const res = await saveCatalogProductAction(product.id, {
        name,
        description,
        categoryId,
        price: parsed,
        imagePath,
        isPublished: published,
        hasSlicing,
      });
      if (res.ok) onClose();
      else setError(res.error);
    });
  };

  return (
    <SheetModal title={product.name} onClose={onClose} dismissible={!pending}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Name" htmlFor="cat-name">
          <input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={fieldClass} />
        </Field>
        <Field label="Category" htmlFor="cat-category">
          <select id="cat-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldClass}>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Price (₱)" htmlFor="cat-price">
          <input
            id="cat-price"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={fieldClass}
            placeholder="0.00"
          />
        </Field>
        <Field label="Description" htmlFor="cat-description">
          <textarea
            id="cat-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            className={`${fieldClass} h-auto py-2.5`}
          />
        </Field>
        <Field label="Image path" htmlFor="cat-image">
          <input
            id="cat-image"
            value={imagePath}
            onChange={(e) => setImagePath(e.target.value)}
            className={fieldClass}
            placeholder="/images/plain-sourdough.jpg"
          />
        </Field>
        <label className="flex items-center gap-3 text-[17px]">
          <input
            type="checkbox"
            checked={hasSlicing}
            onChange={(e) => setHasSlicing(e.target.checked)}
            className="size-5 accent-brand"
          />
          Offer sliced / unsliced
        </label>
        <label className="flex items-center gap-3 text-[17px]">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="size-5 accent-brand"
          />
          Published on storefront
        </label>
        {error && <ErrorNote>{error}</ErrorNote>}
        {product.canDelete && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Delete "${product.name}"? This can't be undone.`)) return;
              setError(null);
              startTransition(async () => {
                const res = await deleteCatalogProductAction(product.id);
                if (res.ok) onClose();
                else setError(res.error);
              });
            }}
            className="h-11 rounded-xl text-[15px] font-medium text-red-600 disabled:opacity-50"
          >
            Delete product
          </button>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-12 flex-1 rounded-xl border border-separator text-[17px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="h-12 flex-1 rounded-xl bg-brand text-[17px] font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </SheetModal>
  );
}
