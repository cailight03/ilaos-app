"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Check, ChevronLeft, History, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import {
  clearMappingAction,
  removeCostItemAction,
  saveCostItemAction,
  saveMappingAction,
  saveProductAction,
  setProductActiveAction,
  setProductPriceAction,
  type ActionResult,
} from "../actions";
import { SheetModal } from "../../../_components/sheet-modal";
import { ErrorNote, Field, fieldClass, formatMargin } from "../product-ui";
import { ProductFormDialog, type ProductFormValues } from "../product-form";
import type { Category } from "@/src/lib/ingredients";
import {
  UNITS,
  baseUnitOf,
  formatPeso,
  formatQuantity,
  formatUnitCost,
  parseAmount,
  type BaseUnit,
  type Unit,
} from "@/src/lib/ingredient-cost";
import { ISSUE_LABEL, type CostLine, type ProductCost } from "@/src/lib/product-cost";
import type { AuditEntry } from "@/src/lib/audit-log";

export type IngredientOption = {
  id: string;
  name: string;
  baseUnit: BaseUnit;
  categoryName: string;
  isActive: boolean;
};

type MapDialog = { line: CostLine; ingredientId: string; density: string };
type ItemDialog = { kind: "ingredient" | "packaging" | "addon"; id: string | null; ingredientId: string; quantity: string; unit: Unit };

const dateTimeFmt = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

const unitsFor = (base: BaseUnit): Unit[] => UNITS.filter((u) => baseUnitOf(u) === base);

export function ProductDetail({
  product,
  ingredients,
  categories,
  activity,
}: {
  product: ProductCost;
  ingredients: IngredientOption[];
  categories: Category[];
  activity: AuditEntry[];
}) {
  const router = useRouter();
  const [mapDialog, setMapDialog] = useState<MapDialog | null>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialog | null>(null);
  const [removing, setRemoving] = useState<CostLine | null>(null);
  const [editing, setEditing] = useState<ProductFormValues | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [price, setPrice] = useState(product.sellingPrice === null ? "" : String(product.sellingPrice));
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  const run = (work: () => Promise<ActionResult>, success: string, onOk: () => void) => {
    setDialogError(null);
    startTransition(async () => {
      const result = await work();
      if (result.ok) {
        onOk();
        setToast({ ok: true, text: success });
        router.refresh();
      } else {
        setDialogError(result.error);
        setToast({ ok: false, text: result.error });
      }
    });
  };

  const isCustom = product.source === "custom";
  const ingredientLines = product.lines.filter((l) => l.kind === "ingredient");
  const recipeLines = product.lines.filter((l) => l.kind === "recipe");
  const starterLines = product.lines.filter((l) => l.kind === "starter");
  const packagingLines = product.lines.filter((l) => l.kind === "packaging");
  const addonLines = product.lines.filter((l) => l.kind === "addon");
  const problems = product.lines.filter((l) => l.issue !== null);
  const archived = product.lines.filter((l) => l.issue === null && l.archived);

  const openMap = (line: CostLine) => {
    setDialogError(null);
    setMapDialog({
      line,
      ingredientId: line.ingredientId ?? "",
      density: String(line.densityGPerMl ?? 1),
    });
  };

  const saveMap = () => {
    if (!mapDialog?.line.mappingKey) return;
    const density = parseAmount(mapDialog.density);
    run(
      () => saveMappingAction(mapDialog.line.mappingKey!, mapDialog.ingredientId, Number.isNaN(density) ? 1 : density),
      "Mapping saved.",
      () => setMapDialog(null),
    );
  };

  const clearMap = () => {
    if (!mapDialog?.line.mappingKey) return;
    run(() => clearMappingAction(mapDialog.line.mappingKey!), "Mapping removed.", () => setMapDialog(null));
  };

  const openItem = (kind: ItemDialog["kind"], line?: CostLine) => {
    setDialogError(null);
    const first = ingredients.find((i) => i.isActive);
    const ingredientId = line?.ingredientId ?? first?.id ?? "";
    const base = byId.get(ingredientId)?.baseUnit ?? "g";
    setItemDialog({
      kind,
      id: line?.itemId ?? null,
      ingredientId,
      quantity: line ? String(line.quantity) : "",
      unit: line ? line.unit : unitsFor(base)[0],
    });
  };

  const saveItem = () => {
    if (!itemDialog) return;
    const quantity = parseAmount(itemDialog.quantity);
    if (!(quantity > 0)) {
      setDialogError("Quantity must be greater than zero.");
      return;
    }
    run(
      () =>
        saveCostItemAction({
          id: itemDialog.id,
          productId: product.productId,
          ingredientId: itemDialog.ingredientId,
          kind: itemDialog.kind,
          quantity,
          unit: itemDialog.unit,
        }),
      itemDialog.id ? "Item updated." : "Item added.",
      () => setItemDialog(null),
    );
  };

  const savePrice = (value: number | null) => {
    run(
      () => setProductPriceAction(product.productId, value),
      value === null ? "Selling price cleared." : "Selling price saved.",
      () => {},
    );
  };

  const submitPrice = () => {
    const value = parseAmount(price);
    if (Number.isNaN(value)) {
      setToast({ ok: false, text: "Enter a selling price." });
      return;
    }
    if (value < 0) {
      setToast({ ok: false, text: "Price can't be negative." });
      return;
    }
    savePrice(value);
  };

  const priceDirty = parseAmount(price) !== (product.sellingPrice ?? NaN);

  const renderLines = (lines: CostLine[], editable: "map" | "item") =>
    lines.map((line) => (
      <LineRow
        key={line.key}
        line={line}
        action={
          editable === "map" ? (
            <button
              type="button"
              onClick={() => openMap(line)}
              className="flex h-9 items-center gap-1 rounded-lg bg-fill px-3 text-[15px] font-medium transition hover:opacity-80 active:opacity-70"
            >
              <Pencil className="size-4" aria-hidden />
              {line.ingredientId ? "Change" : "Map"}
            </button>
          ) : (
            <>
              <button
                type="button"
                aria-label={`Edit ${line.label}`}
                onClick={() => openItem(line.kind as ItemDialog["kind"], line)}
                className="flex size-9 items-center justify-center rounded-lg bg-fill transition active:opacity-70"
              >
                <Pencil className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`Remove ${line.label}`}
                onClick={() => {
                  setDialogError(null);
                  setRemoving(line);
                }}
                className="flex size-9 items-center justify-center rounded-lg text-red-600 transition active:opacity-70"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </>
          )
        }
      />
    ));

  const itemIngredient = itemDialog ? byId.get(itemDialog.ingredientId) : undefined;
  const itemUnits = itemIngredient ? unitsFor(itemIngredient.baseUnit) : [];
  const mapIngredient = mapDialog ? byId.get(mapDialog.ingredientId) : undefined;
  const itemOptions = itemDialog
    ? ingredients.filter((i) => i.isActive || i.id === itemDialog.ingredientId)
    : [];
  const mapOptions = mapDialog ? ingredients.filter((i) => i.isActive || i.id === mapDialog.ingredientId) : [];

  return (
    <div className="flex animate-ios-in flex-col gap-5">
      <div className="flex flex-col gap-1 pt-2 lg:pt-0">
        <Link
          href="/admin/costing/products"
          className="flex w-fit items-center gap-0.5 text-[17px] text-brand transition active:opacity-60"
        >
          <ChevronLeft className="-ml-1.5 size-6" aria-hidden />
          Product Costing
        </Link>
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 text-[34px] leading-10 font-bold tracking-tight lg:text-[28px] lg:leading-9">{product.label}</h1>
          <div className="flex shrink-0 items-center gap-1 pt-1">
            <button
              type="button"
              onClick={() => {
                setDialogError(null);
                setEditing({
                  id: product.productId,
                  name: product.label,
                  categoryId: product.categoryId ?? categories.find((c) => c.isActive)?.id ?? "",
                  unitLabel: product.unitLabel,
                });
              }}
              className="flex h-9 items-center gap-1 rounded-lg bg-fill px-3 text-[15px] font-medium transition active:opacity-70"
            >
              <Pencil className="size-4" aria-hidden />
              Edit
            </button>
            {isCustom &&
              (product.isActive ? (
                <button
                  type="button"
                  onClick={() => {
                    setDialogError(null);
                    setArchiving(true);
                  }}
                  className="flex h-9 items-center gap-1 rounded-lg px-3 text-[15px] font-medium text-red-600 transition active:opacity-70"
                >
                  <Archive className="size-4" aria-hidden />
                  Archive
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() => setProductActiveAction(product.productId, true), "Product restored.", () => {})
                  }
                  className="flex h-9 items-center gap-1 rounded-lg bg-fill px-3 text-[15px] font-medium transition active:opacity-70 disabled:opacity-50"
                >
                  <ArchiveRestore className="size-4" aria-hidden />
                  Restore
                </button>
              ))}
          </div>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-[15px] text-label2">
          {product.categoryName ? (
            <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-[13px] font-medium text-brand">{product.categoryName}</span>
          ) : (
            <span>No category</span>
          )}
          <span>Cost per {product.unitLabel.toLowerCase()}</span>
          {!product.isActive && <span className="rounded-full bg-fill px-2.5 py-0.5 text-[13px] font-medium">Archived</span>}
        </p>
      </div>

      <section aria-label="Cost summary" className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-6">
        <Tile label="Ingredients" value={product.ingredientCost === null ? "—" : formatPeso(product.ingredientCost)} />
        <Tile label="Packaging" value={product.packagingCost === null ? "—" : formatPeso(product.packagingCost)} />
        <Tile label="Total cost" value={product.totalCost === null ? "—" : formatPeso(product.totalCost)} strong />
        <Tile label="Selling price" value={product.sellingPrice === null ? "Not set" : formatPeso(product.sellingPrice)} />
        <Tile label="Gross profit" value={product.grossProfit === null ? "—" : formatPeso(product.grossProfit)} />
        <Tile label="Margin" value={formatMargin(product.marginPct)} />
      </section>

      {problems.length > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-600/10 p-3.5 text-[15px] text-red-600">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Total cost can&apos;t be calculated yet</p>
            <ul className="mt-1 list-disc pl-5">
              {problems.map((l) => (
                <li key={l.key}>
                  {l.label}: {ISSUE_LABEL[l.issue!].toLowerCase()}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {isCustom && ingredientLines.length === 0 && (
        <p className="rounded-xl bg-red-600/10 p-3.5 text-[15px] text-red-600">
          Add at least one ingredient to calculate this product&apos;s cost.
        </p>
      )}
      {archived.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-orange-500/15 p-3.5 text-[15px] text-orange-600">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          Using archived ingredients: {archived.map((l) => l.ingredientName).join(", ")}. Their last price is still counted.
        </div>
      )}
      {product.totalCost !== null && product.sellingPrice === null && (
        <p className="rounded-xl bg-brand-tint p-3.5 text-[15px] text-brand">Set a selling price to see gross profit and margin.</p>
      )}

      <Section title="Selling price">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submitPrice();
          }}
          className="flex gap-2 p-4"
        >
          <div className="relative min-w-0 flex-1">
            <label htmlFor="selling-price" className="sr-only">Selling price (PHP)</label>
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[17px] text-label2" aria-hidden>₱</span>
            <input
              id="selling-price"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={`${fieldClass} pl-8`}
            />
          </div>
          <button
            type="submit"
            disabled={pending || !priceDirty}
            className="h-11 shrink-0 rounded-xl bg-brand px-5 text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80 disabled:opacity-50"
          >
            Save
          </button>
          {product.sellingPrice !== null && (
            <button
              type="button"
              disabled={pending}
              onClick={() => savePrice(null)}
              className="h-11 shrink-0 rounded-xl bg-fill px-4 text-[17px] font-medium transition active:opacity-70 disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </form>
      </Section>

      {isCustom ? (
        <Section
          title="Ingredients"
          hint={`Quantity used per ${product.unitLabel.toLowerCase()}, from the Ingredient Library.`}
          action={<AddButton onClick={() => openItem("ingredient")} disabled={ingredients.length === 0} label="Add" />}
        >
          {ingredientLines.length === 0 ? <Empty>No ingredients added.</Empty> : renderLines(ingredientLines, "item")}
        </Section>
      ) : (
        <>
          <Section title="Recipe ingredients" hint="Quantities come from the Recipe Calculator (per piece).">
            {renderLines(recipeLines, "map")}
          </Section>

          <Section
            title="Sourdough starter"
            hint="Costed from flour and water at 70% hydration, using the Bread Flour and Water mappings."
          >
            {starterLines.length === 0 ? <Empty>This product has no starter.</Empty> : renderLines(starterLines, "map")}
          </Section>
        </>
      )}

      <Section
        title="Packaging"
        action={<AddButton onClick={() => openItem("packaging")} disabled={ingredients.length === 0} label="Add" />}
      >
        {packagingLines.length === 0 ? <Empty>No packaging added.</Empty> : renderLines(packagingLines, "item")}
      </Section>

      <Section
        title="Add-ons"
        hint="Extra ingredients not in the recipe, such as toppings. Costing only; the Recipe Calculator is unchanged."
        action={<AddButton onClick={() => openItem("addon")} disabled={ingredients.length === 0} label="Add" />}
      >
        {addonLines.length === 0 ? <Empty>No add-ons.</Empty> : renderLines(addonLines, "item")}
      </Section>

      <Section title="Activity" icon={<History className="size-4" aria-hidden />}>
        {activity.length === 0 ? (
          <Empty>No changes recorded yet.</Empty>
        ) : (
          activity.map((a) => (
            <li key={a.id} className="flex flex-col gap-0.5 px-4 py-3">
              <p className="text-[15px]">{a.actor} · {a.action} · {a.module}</p>
              <p className="text-[13px] text-label2">
                {dateTimeFmt.format(new Date(a.createdAt))}
              </p>
            </li>
          ))
        )}
      </Section>
      {mapDialog && (
        <SheetModal title="Map ingredient" dismissible={!pending} onClose={() => setMapDialog(null)}>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              saveMap();
            }}
            className="flex flex-col gap-4"
          >
            {dialogError && <ErrorNote>{dialogError}</ErrorNote>}
            <p className="text-[15px] text-label2">
              Choose the Ingredient Library item for <strong className="text-foreground">{mapDialog.line.mappingKey === "bread flour" && mapDialog.line.kind === "starter" ? "Bread Flour (also used for starter)" : mapDialog.line.kind === "starter" ? "Water (also used for starter)" : mapDialog.line.label}</strong>.
              This applies to every product that uses it.
            </p>
            <Field label="Library ingredient" htmlFor="m-ingredient">
              <select
                id="m-ingredient"
                value={mapDialog.ingredientId}
                onChange={(e) => setMapDialog({ ...mapDialog, ingredientId: e.target.value })}
                className={fieldClass}
              >
                <option value="" disabled>Select an ingredient…</option>
                {mapOptions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.categoryName}){i.isActive ? "" : " — archived"}
                  </option>
                ))}
              </select>
            </Field>
            {mapIngredient?.baseUnit === "ml" && (
              <Field label="Density (g per ml)" htmlFor="m-density">
                <input
                  id="m-density"
                  type="text"
                  inputMode="decimal"
                  value={mapDialog.density}
                  onChange={(e) => setMapDialog({ ...mapDialog, density: e.target.value })}
                  className={fieldClass}
                />
                <span className="text-[13px] text-label2">
                  The recipe uses grams but this item is priced per ml. Water is 1; olive oil is about 0.91.
                </span>
              </Field>
            )}
            {mapIngredient?.baseUnit === "pcs" && (
              <ErrorNote>This item is priced per piece, so grams in the recipe can&apos;t be converted. Pick a g or ml item.</ErrorNote>
            )}
            <div className="flex gap-3 pt-1">
              {mapDialog.line.ingredientId && (
                <button
                  type="button"
                  onClick={clearMap}
                  disabled={pending}
                  className="h-12 rounded-xl px-4 text-[17px] font-medium text-red-600 transition active:opacity-70 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
              <button
                type="button"
                onClick={() => setMapDialog(null)}
                disabled={pending}
                className="h-12 flex-1 rounded-xl bg-fill text-[17px] font-medium transition active:opacity-70 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !mapDialog.ingredientId}
                className="h-12 flex-1 rounded-xl bg-brand text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </SheetModal>
      )}

      {itemDialog && (
        <SheetModal
          title={`${itemDialog.id ? "Edit" : "Add"} ${itemDialog.kind === "addon" ? "add-on" : itemDialog.kind}`}
          dismissible={!pending}
          onClose={() => setItemDialog(null)}
        >
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              saveItem();
            }}
            className="flex flex-col gap-4"
          >
            {dialogError && <ErrorNote>{dialogError}</ErrorNote>}
            <Field label="Library ingredient" htmlFor="i-ingredient">
              <select
                id="i-ingredient"
                value={itemDialog.ingredientId}
                onChange={(e) => {
                  const next = byId.get(e.target.value);
                  const units = next ? unitsFor(next.baseUnit) : [];
                  setItemDialog({
                    ...itemDialog,
                    ingredientId: e.target.value,
                    unit: units.includes(itemDialog.unit) ? itemDialog.unit : (units[0] ?? itemDialog.unit),
                  });
                }}
                className={fieldClass}
              >
                {itemOptions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.categoryName}){i.isActive ? "" : " — archived"}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-[1fr_6.5rem] gap-3">
              <Field label="Quantity per piece" htmlFor="i-quantity">
                <input
                  id="i-quantity"
                  type="text"
                  inputMode="decimal"
                  value={itemDialog.quantity}
                  onChange={(e) => setItemDialog({ ...itemDialog, quantity: e.target.value })}
                  className={fieldClass}
                />
              </Field>
              <Field label="Unit" htmlFor="i-unit">
                <select
                  id="i-unit"
                  value={itemDialog.unit}
                  onChange={(e) => setItemDialog({ ...itemDialog, unit: e.target.value as Unit })}
                  className={fieldClass}
                >
                  {itemUnits.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setItemDialog(null)}
                disabled={pending}
                className="h-12 flex-1 rounded-xl bg-fill text-[17px] font-medium transition active:opacity-70 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !itemDialog.ingredientId}
                className="h-12 flex-1 rounded-xl bg-brand text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </SheetModal>
      )}

      {editing && (
        <ProductFormDialog
          initial={editing}
          recipeProduct={!isCustom}
          categories={categories}
          pending={pending}
          error={dialogError}
          onSubmit={(values) => run(() => saveProductAction(values), "Product updated.", () => setEditing(null))}
          onClose={() => setEditing(null)}
        />
      )}

      {archiving && (
        <SheetModal title="Archive product?" dismissible={!pending} onClose={() => setArchiving(false)}>
          <div className="flex flex-col gap-4">
            {dialogError && <ErrorNote>{dialogError}</ErrorNote>}
            <p className="text-[15px] text-label2">
              {product.label} will be hidden from the active list. You can restore it any time.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setArchiving(false)}
                disabled={pending}
                className="h-12 flex-1 rounded-xl bg-fill text-[17px] font-medium transition active:opacity-70 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => setProductActiveAction(product.productId, false), "Product archived.", () => setArchiving(false))
                }
                className="h-12 flex-1 rounded-xl bg-red-600 text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80 disabled:opacity-50"
              >
                {pending ? "Working…" : "Archive"}
              </button>
            </div>
          </div>
        </SheetModal>
      )}

      {removing && (
        <SheetModal title="Remove item?" dismissible={!pending} onClose={() => setRemoving(null)}>
          <div className="flex flex-col gap-4">
            {dialogError && <ErrorNote>{dialogError}</ErrorNote>}
            <p className="text-[15px] text-label2">
              {removing.label} will no longer be counted in this product&apos;s cost. Past history is kept.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRemoving(null)}
                disabled={pending}
                className="h-12 flex-1 rounded-xl bg-fill text-[17px] font-medium transition active:opacity-70 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => removeCostItemAction(removing.itemId!), "Item removed.", () => setRemoving(null))}
                className="h-12 flex-1 rounded-xl bg-red-600 text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80 disabled:opacity-50"
              >
                {pending ? "Working…" : "Remove"}
              </button>
            </div>
          </div>
        </SheetModal>
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

function LineRow({ line, action }: { line: CostLine; action: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px]">{line.label}</p>
        <p className="text-[13px] text-label2">
          {formatQuantity(line.quantity)} {line.unit}
          {line.baseQuantity !== null && line.baseUnit && (
            <> · {formatQuantity(line.baseQuantity)} {line.baseUnit} of {line.ingredientName}</>
          )}
        </p>
        {line.issue ? (
          <p className="mt-0.5 flex items-center gap-1 text-[13px] font-medium text-red-600">
            <TriangleAlert className="size-3.5" aria-hidden />
            {ISSUE_LABEL[line.issue]}
            {line.ingredientName ? ` (${line.ingredientName})` : ""}
          </p>
        ) : line.archived ? (
          <p className="mt-0.5 flex items-center gap-1 text-[13px] font-medium text-orange-600">
            <TriangleAlert className="size-3.5" aria-hidden />
            {line.ingredientName} is archived
          </p>
        ) : (
          <p className="text-[13px] text-label2">
            {line.ingredientName} · {formatUnitCost(line.unitCost ?? 0)} / {line.baseUnit}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 md:justify-end">
        <p className="text-[17px] font-semibold tabular-nums">{line.cost === null ? "—" : formatPeso(line.cost)}</p>
        <div className="flex items-center gap-1">{action}</div>
      </div>
    </li>
  );
}

function Section({
  title,
  hint,
  action,
  icon,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-[20px] font-semibold tracking-tight">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {hint && <p className="-mt-1 text-[13px] text-label2">{hint}</p>}
      <ul className="divide-y divide-separator overflow-hidden rounded-xl border border-separator bg-card shadow-sm">
        {children}
      </ul>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <li className="px-4 py-5 text-center text-[15px] text-label2">{children}</li>;
}

function AddButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 items-center gap-1 rounded-lg bg-brand px-3 text-[15px] font-semibold text-white transition active:scale-[0.97] active:opacity-80 disabled:opacity-50"
    >
      <Plus className="size-4" aria-hidden />
      {label}
    </button>
  );
}

function Tile({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 shadow-sm md:p-4 ${strong ? "border-brand/30 bg-brand-tint" : "border-separator bg-card"}`}>
      <p className={`text-[22px] leading-7 font-bold tracking-tight tabular-nums ${strong ? "text-brand" : ""}`}>{value}</p>
      <p className="text-[13px] text-label2">{label}</p>
    </div>
  );
}

