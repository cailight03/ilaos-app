import "server-only";
import { supabaseAdmin } from "./supabase";
import { DuplicateNameError, NotFoundError, listIngredients, type Category, type Ingredient } from "./ingredients";
import type { Unit } from "./ingredient-cost";
import {
  computeAllProducts,
  type CostItem,
  type CustomProduct,
  type LibraryIngredient,
  type Mapping,
  type ProductCost,
} from "./product-cost";

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

async function listMappings(): Promise<Mapping[]> {
  const { data, error } = await supabaseAdmin()
    .from("recipe_ingredient_mappings")
    .select("recipe_ingredient, ingredient_id, density_g_per_ml");
  if (error) fail(error);
  return (data ?? []).map((m) => ({
    recipeIngredient: m.recipe_ingredient,
    ingredientId: m.ingredient_id,
    densityGPerMl: Number(m.density_g_per_ml),
  }));
}

async function listCostItems(): Promise<CostItem[]> {
  const { data, error } = await supabaseAdmin()
    .from("product_cost_items")
    .select("id, product_id, ingredient_id, kind, quantity, unit")
    .order("created_at");
  if (error) fail(error);
  return (data ?? []).map((i) => ({
    id: i.id,
    productId: i.product_id,
    ingredientId: i.ingredient_id,
    kind: i.kind,
    quantity: Number(i.quantity),
    unit: i.unit as Unit,
  }));
}

async function listPrices(): Promise<Map<string, number>> {
  const { data, error } = await supabaseAdmin().from("product_prices").select("product_id, selling_price");
  if (error) fail(error);
  return new Map((data ?? []).map((p) => [p.product_id as string, Number(p.selling_price)]));
}

/** Current cost of every product, computed live from the library, mappings, items and prices. */
export async function loadProductCosts(): Promise<{
  products: ProductCost[];
  ingredients: Ingredient[];
  categories: Category[];
}> {
  const [ingredients, mappings, items, prices, categories, customProducts, assignments] = await Promise.all([
    listIngredients(),
    listMappings(),
    listCostItems(),
    listPrices(),
    listProductCategories(),
    listCustomProducts(),
    listRecipeAssignments(),
  ]);
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const products = computeAllProducts({
    mappings,
    ingredients: ingredients.map(toLibrary),
    items,
    prices,
    customProducts,
  }).map((p) => {
    const categoryId = p.source === "custom" ? p.categoryId : (assignments.get(p.productId) ?? null);
    return { ...p, categoryId, categoryName: categoryId ? (names.get(categoryId) ?? null) : null };
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

export async function createProductCategory(name: string): Promise<void> {
  const { error } = await supabaseAdmin().from("product_categories").insert({ name });
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

async function listCustomProducts(): Promise<CustomProduct[]> {
  const { data, error } = await supabaseAdmin()
    .from("custom_products")
    .select("id, name, category_id, unit_label, is_active")
    .order("name");
  if (error) failNamed(error, "product");
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    categoryId: p.category_id,
    unitLabel: p.unit_label,
    isActive: p.is_active,
  }));
}

async function listRecipeAssignments(): Promise<Map<string, string>> {
  const { data, error } = await supabaseAdmin().from("recipe_product_categories").select("product_id, category_id");
  if (error) failNamed(error, "product");
  return new Map((data ?? []).map((a) => [a.product_id as string, a.category_id as string]));
}

export type CustomProductInput = { name: string; categoryId: string; unitLabel: string };

/** Returns the new product's id. */
export async function createCustomProduct(input: CustomProductInput, actor: string): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from("custom_products")
    .insert({ name: input.name, category_id: input.categoryId, unit_label: input.unitLabel, created_by: actor })
    .select("id")
    .single();
  if (error) failNamed(error, "product");
  return data.id as string;
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
  const { data, error } = await supabaseAdmin().from("custom_products").update(update).eq("id", id).select("id");
  if (error) failNamed(error, "product");
  if (!data?.length) throw new NotFoundError();
}

export async function setRecipeProductCategory(productId: string, categoryId: string, actor: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("recipe_product_categories")
    .upsert({ product_id: productId, category_id: categoryId, updated_by: actor }, { onConflict: "product_id" });
  if (error) failNamed(error, "product");
}

export async function customProductExists(id: string): Promise<boolean> {
  const { data } = await supabaseAdmin().from("custom_products").select("id").eq("id", id).maybeSingle();
  return Boolean(data);
}

// Mutations

export async function upsertMapping(recipeIngredient: string, ingredientId: string, density: number, actor: string) {
  const { error } = await supabaseAdmin()
    .from("recipe_ingredient_mappings")
    .upsert(
      { recipe_ingredient: recipeIngredient, ingredient_id: ingredientId, density_g_per_ml: density, updated_by: actor },
      { onConflict: "recipe_ingredient" },
    );
  if (error) fail(error);
}

export async function deleteMapping(recipeIngredient: string) {
  const { error } = await supabaseAdmin()
    .from("recipe_ingredient_mappings")
    .delete()
    .eq("recipe_ingredient", recipeIngredient);
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
  const { error } = await supabaseAdmin().from("product_cost_items").insert({
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
  const { data, error } = await supabaseAdmin()
    .from("product_cost_items")
    .update({ ingredient_id: input.ingredientId, quantity: input.quantity, unit: input.unit, updated_by: actor })
    .eq("id", id)
    .select("id");
  if (error) fail(error);
  if (!data?.length) throw new ItemNotFoundError();
}

export async function deleteCostItem(id: string) {
  const { data, error } = await supabaseAdmin()
    .from("product_cost_items")
    .delete()
    .eq("id", id)
    .select("product_id, ingredient_id, kind");
  if (error) fail(error);
  return data?.[0] as { product_id: string; ingredient_id: string; kind: string } | undefined;
}

export async function setProductPrice(productId: string, price: number | null, actor: string) {
  const db = supabaseAdmin();
  const { error } =
    price === null
      ? await db.from("product_prices").delete().eq("product_id", productId)
      : await db
          .from("product_prices")
          .upsert({ product_id: productId, selling_price: price, updated_by: actor }, { onConflict: "product_id" });
  if (error) fail(error);
}

export async function ingredientName(id: string): Promise<string> {
  const { data } = await supabaseAdmin().from("ingredients").select("name").eq("id", id).maybeSingle();
  return data?.name ?? "an ingredient";
}

