import "server-only";
import { supabaseAdmin } from "./supabase";
import { DuplicateNameError, NotFoundError, listIngredients, type Category, type Ingredient } from "./ingredients";
import type { Unit } from "./ingredient-cost";
import {
  computeAllProducts,
  normalizeKey,
  type CostItem,
  type CustomProduct,
  type LibraryIngredient,
  type ProductCost,
} from "./product-cost";
import { isCustomProduct, loadRecipeCostingData } from "./recipes-db";

export class DuplicateItemError extends Error {
  constructor() {
    super("That ingredient is already added to this product.");
  }
}

export class ItemNotFoundError extends Error {
  constructor() {
    super("That item no longer exists.");
  }
}

function fail(error: { message: string; code?: string }): never {
  if (error.code === "23505") throw new DuplicateItemError();
  if (error.code === "23503") throw new Error("Choose a valid ingredient.");
  throw new Error(`product costing: ${error.message}`);
}

const toLibrary = (i: Ingredient): LibraryIngredient => ({
  id: i.id,
  name: i.name,
  baseUnit: i.baseUnit,
  costPerBaseUnit: i.costPerBaseUnit,
  isActive: i.isActive,
});

type OwnerRef = { id: string; cost_key: string };
type RecipeRowRef = { id: string; name?: string; recipes: { products: OwnerRef | OwnerRef[] } | { products: OwnerRef | OwnerRef[] }[] };

const first = <T>(v: T | T[]): T => (Array.isArray(v) ? v[0] : v);
const ownerOf = (row: RecipeRowRef): OwnerRef => first(first(row.recipes).products);

/** Packaging and add-ons live in product_cost_items; a custom product's ingredients are its recipe rows. */
async function listCostItems(): Promise<CostItem[]> {
  const db = supabaseAdmin();
  const [items, lines] = await Promise.all([
    db
      .from("product_cost_items")
      .select("id, product_id, ingredient_id, kind, quantity, unit")
      .neq("kind", "ingredient")
      .order("created_at"),
    db
      .from("recipe_ingredients")
      .select("id, ingredient_id, quantity, unit, recipes!inner(products!inner(id, cost_key))")
      .not("ingredient_id", "is", null)
      .order("sort_order"),
  ]);
  if (items.error) fail(items.error);
  if (lines.error) fail(lines.error);
  const packaging: CostItem[] = (items.data ?? []).map((i) => ({
    id: i.id,
    productId: i.product_id,
    ingredientId: i.ingredient_id,
    kind: i.kind,
    quantity: Number(i.quantity),
    unit: i.unit as Unit,
  }));
  const ingredientLines: CostItem[] = [];
  for (const l of (lines.data ?? []) as unknown as (RecipeRowRef & { ingredient_id: string; quantity: string; unit: string })[]) {
    const owner = ownerOf(l);
    if (!isCustomProduct(owner)) continue;
    ingredientLines.push({
      id: l.id,
      productId: owner.cost_key,
      ingredientId: l.ingredient_id,
      kind: "ingredient",
      quantity: Number(l.quantity),
      unit: l.unit as Unit,
    });
  }
  return [...packaging, ...ingredientLines];
}

type ProductRow = { id: string; cost_key: string; name: string; category_id: string; unit_label: string; is_active: boolean; price: string | number | null };

async function listProducts(): Promise<ProductRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("products")
    .select("id, cost_key, name, category_id, unit_label, is_active, price")
    .order("name");
  if (error) failNamed(error, "product");
  return (data ?? []) as ProductRow[];
}

/** Current cost of every product, computed live from the library, recipes, items and prices. */
export async function loadProductCosts(): Promise<{
  products: ProductCost[];
  ingredients: Ingredient[];
  categories: Category[];
}> {
  const [ingredients, recipeData, items, categories, catalog] = await Promise.all([
    listIngredients(),
    loadRecipeCostingData(),
    listCostItems(),
    listProductCategories(),
    listProducts(),
  ]);
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const byKey = new Map(catalog.map((p) => [p.cost_key, p]));
  const prices = new Map(catalog.filter((p) => p.price !== null).map((p) => [p.cost_key, Number(p.price)]));
  const customProducts: CustomProduct[] = catalog.filter(isCustomProduct).map((p) => ({
    id: p.id,
    name: p.name,
    categoryId: p.category_id,
    unitLabel: p.unit_label,
    isActive: p.is_active,
  }));
  const products = computeAllProducts({
    recipes: recipeData.recipes,
    mappings: recipeData.mappings,
    ingredients: ingredients.map(toLibrary),
    items,
    prices,
    customProducts,
  }).map((p) => {
    const row = byKey.get(p.productId);
    const categoryId = row?.category_id ?? null;
    return {
      ...p,
      categoryId,
      categoryName: categoryId ? (names.get(categoryId) ?? null) : null,
      isActive: p.source === "custom" ? p.isActive : !recipeData.inactive.has(p.productId),
    };
  });
  return { products, ingredients, categories };
}

// Product catalog: categories, custom products, recipe product categories

function failNamed(error: { message: string; code?: string }, what: "category" | "product"): never {
  if (error.code === "23505") throw new DuplicateNameError(what);
  if (error.code === "23503") throw new Error("Choose a valid category.");
  throw new Error(`product ${what}: ${error.message}`);
}

export async function listProductCategories(): Promise<Category[]> {
  const { data, error } = await supabaseAdmin().from("product_categories").select("id, name, is_active").order("name");
  if (error) failNamed(error, "category");
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, isActive: c.is_active }));
}

const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export async function createProductCategory(name: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("product_categories")
    .insert({ name, slug: slugify(name) || null });
  if (error) failNamed(error, "category");
}

export async function updateProductCategory(id: string, patch: { name?: string; isActive?: boolean }): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;
  const { data, error } = await supabaseAdmin().from("product_categories").update(update).eq("id", id).select("id");
  if (error) failNamed(error, "category");
  if (!data?.length) throw new NotFoundError();
}

export type CustomProductInput = { name: string; categoryId: string; unitLabel: string };

const initcap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Returns the new product's id. A custom product's cost_key is its own id, and it gets an empty recipe. */
export async function createCustomProduct(input: CustomProductInput, actor: string): Promise<string> {
  const db = supabaseAdmin();
  const id = crypto.randomUUID();
  const { error } = await db.from("products").insert({
    id,
    cost_key: id,
    slug: `${slugify(input.name) || "product"}-${id.slice(0, 4)}`,
    name: input.name,
    category_id: input.categoryId,
    unit_label: input.unitLabel,
    created_by: actor,
  });
  if (error) failNamed(error, "product");
  const unit = initcap(input.unitLabel);
  const recipe = await db
    .from("recipes")
    .insert({ product_id: id, unit_singular: unit, unit_plural: `${unit}s`, updated_by: actor });
  if (recipe.error) {
    await db.from("products").delete().eq("id", id);
    failNamed(recipe.error, "product");
  }
  return id;
}

export async function updateCustomProduct(
  id: string,
  patch: Partial<CustomProductInput> & { isActive?: boolean },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.categoryId !== undefined) update.category_id = patch.categoryId;
  if (patch.unitLabel !== undefined) update.unit_label = patch.unitLabel;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;
  const db = supabaseAdmin();
  const { data, error } = await db.from("products").update(update).eq("id", id).eq("cost_key", id).select("id");
  if (error) failNamed(error, "product");
  if (!data?.length) throw new NotFoundError();
  if (patch.unitLabel !== undefined) {
    const unit = initcap(patch.unitLabel);
    await db.from("recipes").update({ unit_singular: unit, unit_plural: `${unit}s` }).eq("product_id", id);
  }
}

/** Recipe products are keyed by cost_key (the name used in the order sheet). */
export async function setRecipeProductCategory(productId: string, categoryId: string): Promise<void> {
  const { data, error } = await supabaseAdmin()
    .from("products")
    .update({ category_id: categoryId })
    .eq("cost_key", productId)
    .select("id");
  if (error) failNamed(error, "product");
  if (!data?.length) throw new NotFoundError();
}

async function productByKey(costKey: string): Promise<OwnerRef | null> {
  const { data } = await supabaseAdmin().from("products").select("id, cost_key").eq("cost_key", costKey).maybeSingle();
  return (data as OwnerRef | null) ?? null;
}

export async function customProductExists(id: string): Promise<boolean> {
  const p = await productByKey(id);
  return p !== null && isCustomProduct(p);
}

export async function recipeProductExists(costKey: string): Promise<boolean> {
  const p = await productByKey(costKey);
  return p !== null && !isCustomProduct(p);
}

// Mutations

/** Rows of recipe-driven products (never custom products) whose ingredient name matches key. */
async function recipeRowIdsByName(key: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from("recipe_ingredients")
    .select("id, name, recipes!inner(products!inner(id, cost_key))")
    .eq("is_starter", false);
  if (error) fail(error);
  return ((data ?? []) as unknown as RecipeRowRef[])
    .filter((r) => normalizeKey(r.name ?? "") === key && !isCustomProduct(ownerOf(r)))
    .map((r) => r.id);
}

export async function isMappableRecipeIngredient(key: string): Promise<boolean> {
  return (await recipeRowIdsByName(key)).length > 0;
}

/** A mapping is stored on the recipe rows themselves, so it applies to every recipe using that name. */
export async function upsertMapping(recipeIngredient: string, ingredientId: string, density: number, actor: string) {
  const ids = await recipeRowIdsByName(recipeIngredient);
  if (!ids.length) throw new NotFoundError();
  const { error } = await supabaseAdmin()
    .from("recipe_ingredients")
    .update({ ingredient_id: ingredientId, density_g_per_ml: density, updated_by: actor })
    .in("id", ids);
  if (error) fail(error);
}

export async function deleteMapping(recipeIngredient: string) {
  const ids = await recipeRowIdsByName(recipeIngredient);
  if (!ids.length) return;
  const { error } = await supabaseAdmin().from("recipe_ingredients").update({ ingredient_id: null }).in("id", ids);
  if (error) fail(error);
}

export type CostItemInput = {
  productId: string;
  ingredientId: string;
  kind: "ingredient" | "packaging" | "addon";
  quantity: number;
  unit: Unit;
};

export async function createCostItem(input: CostItemInput, actor: string) {
  const db = supabaseAdmin();
  if (input.kind === "ingredient") {
    // A custom product's ingredients are rows of its recipe.
    const { data: recipe } = await db.from("recipes").select("id").eq("product_id", input.productId).maybeSingle();
    if (!recipe) throw new ItemNotFoundError();
    const { data: last } = await db
      .from("recipe_ingredients")
      .select("sort_order")
      .eq("recipe_id", recipe.id)
      .order("sort_order", { ascending: false })
      .limit(1);
    const { error } = await db.from("recipe_ingredients").insert({
      recipe_id: recipe.id,
      ingredient_id: input.ingredientId,
      name: await libraryName(input.ingredientId),
      quantity: input.quantity,
      unit: input.unit,
      sort_order: (last?.[0]?.sort_order ?? 0) + 1,
      updated_by: actor,
    });
    if (error) fail(error);
    return;
  }
  const { error } = await db.from("product_cost_items").insert({
    product_id: input.productId,
    ingredient_id: input.ingredientId,
    kind: input.kind,
    quantity: input.quantity,
    unit: input.unit,
    updated_by: actor,
  });
  if (error) fail(error);
}

export async function updateCostItem(id: string, input: CostItemInput, actor: string) {
  const db = supabaseAdmin();
  const { data, error } =
    input.kind === "ingredient"
      ? await db
          .from("recipe_ingredients")
          .update({
            ingredient_id: input.ingredientId,
            name: await libraryName(input.ingredientId),
            quantity: input.quantity,
            unit: input.unit,
            updated_by: actor,
          })
          .eq("id", id)
          .select("id")
      : await db
          .from("product_cost_items")
          .update({ ingredient_id: input.ingredientId, quantity: input.quantity, unit: input.unit, updated_by: actor })
          .eq("id", id)
          .select("id");
  if (error) fail(error);
  if (!data?.length) throw new ItemNotFoundError();
}

export async function deleteCostItem(id: string) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("product_cost_items")
    .delete()
    .eq("id", id)
    .neq("kind", "ingredient")
    .select("product_id, ingredient_id, kind");
  if (error) fail(error);
  if (data?.length) return data[0] as { product_id: string; ingredient_id: string; kind: string };

  // Otherwise it may be an ingredient row of a custom product's recipe. Recipe products' rows are never removed here.
  const { data: row } = await db
    .from("recipe_ingredients")
    .select("id, ingredient_id, recipes!inner(products!inner(id, cost_key))")
    .eq("id", id)
    .maybeSingle();
  if (!row) return undefined;
  const owner = ownerOf(row as unknown as RecipeRowRef);
  if (!isCustomProduct(owner)) return undefined;
  const removed = await db.from("recipe_ingredients").delete().eq("id", id);
  if (removed.error) fail(removed.error);
  return { product_id: owner.cost_key, ingredient_id: row.ingredient_id as string, kind: "ingredient" };
}

/** The price is shared by Product Costing and the storefront. null clears it. */
export async function setProductPrice(productId: string, price: number | null) {
  const { data, error } = await supabaseAdmin()
    .from("products")
    .update({ price })
    .eq("cost_key", productId)
    .select("id");
  if (error) fail(error);
  if (!data?.length) throw new NotFoundError();
}

async function libraryName(id: string): Promise<string> {
  const { data } = await supabaseAdmin().from("ingredients").select("name").eq("id", id).maybeSingle();
  if (!data) throw new Error("Choose a valid ingredient.");
  return data.name as string;
}

export async function ingredientName(id: string): Promise<string> {
  const { data } = await supabaseAdmin().from("ingredients").select("name").eq("id", id).maybeSingle();
  return data?.name ?? "an ingredient";
}

