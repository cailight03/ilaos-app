import "server-only";
import { supabaseAdmin } from "./supabase";
import { isStarter, normalizeKey, type Mapping } from "./product-cost";
import type { ProductRef } from "./product-registry";
import type { Recipe } from "./recipes";

type ProductRow = { id: string; cost_key: string; name: string; is_active: boolean; sort_order: number };
type LineRow = {
  id: string;
  ingredient_id: string | null;
  name: string;
  is_starter: boolean;
  quantity: number | string;
  unit: string;
  density_g_per_ml: number | string;
  sort_order: number;
};
type RecipeRow = {
  id: string;
  group_key: string | null;
  unit_singular: string;
  unit_plural: string;
  products: ProductRow | ProductRow[];
  recipe_ingredients: LineRow[] | null;
};

const one = <T>(v: T | T[]): T => (Array.isArray(v) ? v[0] : v);

/** Custom products are keyed by their own id; recipe products by the name used in the order sheet. */
export const isCustomProduct = (p: { id: string; cost_key: string }) => p.cost_key === p.id;

const titleCase = (s: string) => s.replace(/(^|[\s_-])([a-z])/g, (_, sep: string, c: string) => `${sep}${c.toUpperCase()}`);

async function fetchRows(): Promise<RecipeRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("recipes")
    .select(
      "id, group_key, unit_singular, unit_plural, products!inner(id, cost_key, name, is_active, sort_order), " +
        "recipe_ingredients(id, ingredient_id, name, is_starter, quantity, unit, density_g_per_ml, sort_order)",
    );
  if (error) throw new Error(`recipes: ${error.message}`);
  const rows = (data ?? []) as unknown as RecipeRow[];
  return rows
    .filter((r) => !isCustomProduct(one(r.products)))
    .sort((a, b) => {
      const pa = one(a.products);
      const pb = one(b.products);
      return pa.sort_order - pb.sort_order || pa.name.localeCompare(pb.name);
    });
}

const sortedLines = (r: RecipeRow) => [...(r.recipe_ingredients ?? [])].sort((a, b) => a.sort_order - b.sort_order);

// Recipe quantities are grams per piece; kg rows are converted so the rest of the app only sees grams.
const toGrams = (l: LineRow) => (l.unit === "kg" ? Number(l.quantity) * 1000 : Number(l.quantity));

function toRecipes(rows: RecipeRow[]): Recipe[] {
  return rows.map((r) => {
    const p = one(r.products);
    return {
      id: p.cost_key,
      label: p.name,
      ...(r.group_key ? { group: { id: r.group_key, label: titleCase(r.group_key) } } : {}),
      unit: { singular: r.unit_singular, plural: r.unit_plural },
      ingredients: sortedLines(r).map((l) => ({ name: l.name, grams: toGrams(l) })),
    };
  });
}

/**
 * Recipe-driven products for the Recipe Calculator, in display order. Carries no costing data
 * (library ingredients, densities), so it is safe for users who only have the recipe module.
 */
export async function loadRecipes(options: { activeOnly?: boolean } = {}): Promise<Recipe[]> {
  const rows = await fetchRows();
  return toRecipes(rows.filter((r) => !options.activeOnly || one(r.products).is_active));
}

/**
 * Order-sheet product names with display labels and active state, for dashboard, orders and reports.
 * Custom and storefront-only products never appear on the order sheet, so they are excluded.
 */
export async function loadProductRefs(): Promise<ProductRef[]> {
  const rows = await fetchRows();
  return rows
    .map((r) => one(r.products))
    .filter((p) => p.cost_key !== p.id)
    .map((p) => ({ key: p.cost_key, label: p.name, active: p.is_active }));
}

/**
 * Everything Product Costing needs about recipe products: the recipes, the name-level mapping to Ingredient
 * Library items (first mapped row per name wins), and which products are active.
 */
export async function loadRecipeCostingData(): Promise<{
  recipes: Recipe[];
  mappings: Mapping[];
  inactive: ReadonlySet<string>;
}> {
  const rows = await fetchRows();
  const mappings = new Map<string, Mapping>();
  for (const r of rows) {
    for (const l of r.recipe_ingredients ?? []) {
      if (l.is_starter || isStarter(l.name) || !l.ingredient_id) continue;
      const key = normalizeKey(l.name);
      if (!mappings.has(key)) {
        mappings.set(key, { recipeIngredient: key, ingredientId: l.ingredient_id, densityGPerMl: Number(l.density_g_per_ml) });
      }
    }
  }
  return {
    recipes: toRecipes(rows),
    mappings: [...mappings.values()],
    inactive: new Set(rows.filter((r) => !one(r.products).is_active).map((r) => one(r.products).cost_key)),
  };
}

export type EditableRow = {
  id: string;
  name: string;
  isStarter: boolean;
  /** Linked to an Ingredient Library item; mapping is edited in Product Costing. */
  mapped: boolean;
  grams: number;
};
export type EditableRecipe = { costKey: string; label: string; unit: string; rows: EditableRow[] };

export async function loadEditableRecipes(): Promise<EditableRecipe[]> {
  const rows = await fetchRows();
  return rows.map((r) => ({
    costKey: one(r.products).cost_key,
    label: one(r.products).name,
    unit: r.unit_plural,
    rows: sortedLines(r).map((l) => ({
      id: l.id,
      name: l.name,
      isStarter: l.is_starter,
      mapped: l.is_starter || l.ingredient_id !== null,
      grams: toGrams(l),
    })),
  }));
}

/** id null = a new row. Existing rows only change quantity; new rows are a library item or the starter. */
export type RecipeRowInput = {
  id: string | null;
  grams: number;
  isStarter?: boolean;
  ingredientId?: string;
};

export class RecipeSaveError extends Error {}

/** Applies the full row list for one recipe product: removes missing rows, updates quantities, adds new rows. */
export async function saveRecipeRows(costKey: string, rows: readonly RecipeRowInput[], actor: string): Promise<void> {
  const db = supabaseAdmin();
  const all = await fetchRows();
  const target = all.find((r) => one(r.products).cost_key === costKey);
  if (!target) throw new RecipeSaveError("That recipe no longer exists.");

  const existing = new Map((target.recipe_ingredients ?? []).map((l) => [l.id, l]));
  const keep = new Set<string>();
  for (const r of rows) {
    if (r.id === null) continue;
    if (!existing.has(r.id) || keep.has(r.id)) throw new RecipeSaveError("This recipe changed. Reload and try again.");
    keep.add(r.id);
  }

  const libraryIds = [...new Set(rows.flatMap((r) => (r.id === null && !r.isStarter && r.ingredientId ? [r.ingredientId] : [])))];
  const library = new Map<string, string>();
  if (libraryIds.length) {
    const { data, error } = await db.from("ingredients").select("id, name").in("id", libraryIds);
    if (error) throw new Error(`recipes: ${error.message}`);
    for (const i of data ?? []) library.set(i.id as string, i.name as string);
  }

  // Densities already set for a name in any recipe carry over to new rows with that name.
  const density = new Map<string, number>();
  for (const r of all) {
    for (const l of r.recipe_ingredients ?? []) {
      const key = normalizeKey(l.name);
      if (l.ingredient_id && !density.has(key)) density.set(key, Number(l.density_g_per_ml));
    }
  }

  const names = new Set<string>();
  const inserts: Record<string, unknown>[] = [];
  const updates: { id: string; grams: number; sort: number }[] = [];
  rows.forEach((r, index) => {
    const sort = index + 1;
    if (r.id !== null) {
      const l = existing.get(r.id)!;
      names.add(normalizeKey(l.name));
      updates.push({ id: r.id, grams: r.grams, sort });
      return;
    }
    const name = r.isStarter ? "Starter" : library.get(r.ingredientId ?? "");
    if (!name) throw new RecipeSaveError("Choose an ingredient from the library.");
    const key = normalizeKey(name);
    if (names.has(key)) throw new RecipeSaveError(`${name} is already in this recipe.`);
    names.add(key);
    inserts.push({
      recipe_id: target.id,
      ingredient_id: r.isStarter ? null : r.ingredientId,
      name,
      is_starter: Boolean(r.isStarter),
      quantity: r.grams,
      unit: "g",
      density_g_per_ml: density.get(key) ?? 1,
      sort_order: sort,
      updated_by: actor,
    });
  });

  const removed = [...existing.keys()].filter((id) => !keep.has(id));
  if (removed.length) {
    const { error } = await db.from("recipe_ingredients").delete().in("id", removed);
    if (error) throw new Error(`recipes: ${error.message}`);
  }
  for (const u of updates) {
    const { error } = await db
      .from("recipe_ingredients")
      .update({ quantity: u.grams, unit: "g", sort_order: u.sort, updated_by: actor })
      .eq("id", u.id);
    if (error) throw new Error(`recipes: ${error.message}`);
  }
  if (inserts.length) {
    const { error } = await db.from("recipe_ingredients").insert(inserts);
    if (error) {
      if (error.code === "23505") throw new RecipeSaveError("That ingredient is already in this recipe.");
      throw new Error(`recipes: ${error.message}`);
    }
  }
}
