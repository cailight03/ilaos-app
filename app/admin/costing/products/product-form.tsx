"use client";

import { useState } from "react";
import { SheetModal } from "../../_components/sheet-modal";
import { ErrorNote, Field, fieldClass } from "./product-ui";
import type { Category } from "@/src/lib/ingredients";

export type ProductFormValues = { id: string | null; name: string; categoryId: string; unitLabel: string };

/** Add or edit a product. Recipe products only let you change the category; their name comes from the recipe. */
export function ProductFormDialog({
  initial,
  recipeProduct,
  categories,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  initial: ProductFormValues;
  recipeProduct: boolean;
  categories: Category[];
  pending: boolean;
  error: string | null;
  onSubmit: (values: ProductFormValues) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState(initial);
  const options = categories.filter((c) => c.isActive || c.id === initial.categoryId);
  const valid = values.categoryId !== "" && (recipeProduct || values.name.trim() !== "");

  return (
    <SheetModal
      title={initial.id ? "Edit product" : "Add product"}
      dismissible={!pending}
      onClose={onClose}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(values);
        }}
        className="flex flex-col gap-4"
      >
        {error && <ErrorNote>{error}</ErrorNote>}
        <Field label="Product name" htmlFor="p-name">
          <input
            id="p-name"
            type="text"
            maxLength={120}
            disabled={recipeProduct}
            autoFocus={!recipeProduct}
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            className={`${fieldClass} disabled:opacity-60`}
          />
          {recipeProduct && (
            <span className="text-[13px] text-label2">This product comes from the Recipe Calculator.</span>
          )}
        </Field>
        <Field label="Category" htmlFor="p-category">
          <select
            id="p-category"
            value={values.categoryId}
            onChange={(e) => setValues({ ...values, categoryId: e.target.value })}
            className={fieldClass}
          >
            <option value="" disabled>Select a category…</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.isActive ? "" : " (archived)"}
              </option>
            ))}
          </select>
        </Field>
        {!recipeProduct && (
          <Field label="Sold per" htmlFor="p-unit">
            <input
              id="p-unit"
              type="text"
              maxLength={30}
              placeholder="piece"
              value={values.unitLabel}
              onChange={(e) => setValues({ ...values, unitLabel: e.target.value })}
              className={fieldClass}
            />
            <span className="text-[13px] text-label2">What one costed unit is called, e.g. piece, loaf or box.</span>
          </Field>
        )}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-12 flex-1 rounded-xl bg-fill text-[17px] font-medium transition active:opacity-70 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || !valid}
            className="h-12 flex-1 rounded-xl bg-brand text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </SheetModal>
  );
}
