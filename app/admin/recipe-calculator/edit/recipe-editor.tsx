"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EditableRecipe, RecipeRowInput } from "@/src/lib/recipes-db";
import { ErrorNote, fieldClass } from "../../costing/products/product-ui";
import { saveRecipeAction } from "./actions";

type Row = { key: string; id: string | null; name: string; isStarter: boolean; grams: string; ingredientId?: string };
type LibraryItem = { id: string; name: string };

const toRows = (r: EditableRecipe): Row[] =>
  r.rows.map((x) => ({ key: x.id, id: x.id, name: x.name, isStarter: x.isStarter, grams: String(x.grams) }));

export function RecipeEditor({ recipes, library }: { recipes: EditableRecipe[]; library: LibraryItem[] }) {
  const router = useRouter();
  const [costKey, setCostKey] = useState(recipes[0]?.costKey ?? "");
  const current = recipes.find((r) => r.costKey === costKey);
  const [rows, setRows] = useState<Row[]>(current ? toRows(current) : []);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pick, setPick] = useState("");

  // After a save the server sends fresh row ids; reset so new rows are not inserted twice.
  const [seen, setSeen] = useState(recipes);
  if (seen !== recipes) {
    setSeen(recipes);
    const fresh = recipes.find((r) => r.costKey === costKey);
    setRows(fresh ? toRows(fresh) : []);
  }

  const select = (key: string) => {
    const next = recipes.find((r) => r.costKey === key);
    setCostKey(key);
    setRows(next ? toRows(next) : []);
    setError(null);
    setSaved(false);
  };

  const hasStarter = rows.some((r) => r.isStarter);
  const usedIngredients = new Set(rows.map((r) => r.ingredientId).filter(Boolean));
  const usedNames = new Set(rows.map((r) => r.name.trim().toLowerCase()));
  const available = library.filter((i) => !usedIngredients.has(i.id) && !usedNames.has(i.name.trim().toLowerCase()));

  const setGrams = (key: string, grams: string) => {
    setSaved(false);
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, grams } : r)));
  };

  const addIngredient = (id: string) => {
    const item = library.find((i) => i.id === id);
    if (!item) return;
    setSaved(false);
    setRows((rs) => [...rs, { key: crypto.randomUUID(), id: null, name: item.name, isStarter: false, grams: "", ingredientId: id }]);
    setPick("");
  };

  const addStarter = () => {
    setSaved(false);
    setRows((rs) => [...rs, { key: crypto.randomUUID(), id: null, name: "Starter", isStarter: true, grams: "" }]);
  };

  const remove = (key: string) => {
    setSaved(false);
    setRows((rs) => rs.filter((r) => r.key !== key));
  };

  const save = () => {
    setError(null);
    const payload: RecipeRowInput[] = [];
    for (const r of rows) {
      const grams = Number(r.grams);
      if (!r.grams.trim() || !Number.isFinite(grams) || grams <= 0) {
        setError(`Enter a quantity greater than zero for ${r.name}.`);
        return;
      }
      payload.push({ id: r.id, grams, isStarter: r.isStarter, ingredientId: r.ingredientId });
    }
    if (payload.length === 0) {
      setError("A recipe needs at least one ingredient.");
      return;
    }
    startTransition(async () => {
      const res = await saveRecipeAction(costKey, payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  if (!current) return <p className="text-label2">No recipes yet.</p>;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/recipe-calculator" className="text-[15px] text-brand">
        ← Back to calculator
      </Link>

      <select
        aria-label="Recipe"
        value={costKey}
        onChange={(e) => select(e.target.value)}
        className={fieldClass}
        disabled={pending}
      >
        {recipes.map((r) => (
          <option key={r.costKey} value={r.costKey}>
            {r.label}
          </option>
        ))}
      </select>

      <ul className="flex flex-col divide-y divide-separator rounded-xl bg-card">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px]">{r.name}</p>
              {r.id === null && !r.isStarter && <p className="text-[13px] text-label2">New</p>}
            </div>
            <div className="w-24 shrink-0">
              <input
                aria-label={`${r.name} grams`}
                inputMode="decimal"
                value={r.grams}
                onChange={(e) => setGrams(r.key, e.target.value)}
                className={`${fieldClass} text-right`}
                placeholder="0"
              />
            </div>
            <span className="w-4 shrink-0 text-label2">g</span>
            <button
              type="button"
              onClick={() => remove(r.key)}
              className="h-11 shrink-0 rounded-xl px-3 text-[15px] text-red-600"
              aria-label={`Remove ${r.name}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Add ingredient"
          value={pick}
          onChange={(e) => addIngredient(e.target.value)}
          className={`${fieldClass} flex-1`}
        >
          <option value="">Add ingredient…</option>
          {available.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        {!hasStarter && (
          <button type="button" onClick={addStarter} className="h-11 rounded-xl border border-separator px-4 text-[17px]">
            Add starter
          </button>
        )}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {saved && <p className="text-[15px] text-label2">Saved.</p>}

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="h-12 rounded-xl bg-brand text-[17px] font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save recipe"}
      </button>
    </div>
  );
}
