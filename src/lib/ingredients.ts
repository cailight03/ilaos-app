import "server-only";
import { supabaseAdmin } from "./supabase";
import type { BaseUnit, Unit } from "./ingredient-cost";

export type Category = { id: string; name: string; isActive: boolean };

export type Ingredient = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  purchaseQuantity: number;
  purchaseUnit: Unit;
  purchasePrice: number;
  baseUnit: BaseUnit;
  costPerBaseUnit: number;
  supplier: string | null;
  isActive: boolean;
  updatedAt: string;
};

export type IngredientInput = {
  name: string;
  categoryId: string;
  purchaseQuantity: number;
  purchaseUnit: Unit;
  purchasePrice: number;
  supplier: string | null;
  isActive?: boolean;
};

export class DuplicateNameError extends Error {
  constructor(what: "ingredient" | "category" | "product") {
    super(`A ${what} with that name already exists.`);
  }
}

export class NotFoundError extends Error {
  constructor() {
    super("That item no longer exists.");
  }
}

function fail(error: { message: string; code?: string }, what: "ingredient" | "category"): never {
  if (error.code === "23505") throw new DuplicateNameError(what);
  if (error.code === "23503") throw new Error("Choose a valid category.");
  throw new Error(`${what}: ${error.message}`);
}

const INGREDIENT_COLUMNS =
  "id, name, category_id, purchase_quantity, purchase_unit, purchase_price, base_unit, cost_per_base_unit, " +
  "supplier, is_active, updated_at, ingredient_categories(name)";

type IngredientRow = {
  id: string;
  name: string;
  category_id: string;
  purchase_quantity: number;
  purchase_unit: Unit;
  purchase_price: number;
  base_unit: BaseUnit;
  cost_per_base_unit: number;
  supplier: string | null;
  is_active: boolean;
  updated_at: string;
  ingredient_categories: { name: string } | { name: string }[] | null;
};

function toIngredient(r: IngredientRow): Ingredient {
  const cat = Array.isArray(r.ingredient_categories) ? r.ingredient_categories[0] : r.ingredient_categories;
  return {
    id: r.id,
    name: r.name,
    categoryId: r.category_id,
    categoryName: cat?.name ?? "Uncategorized",
    purchaseQuantity: Number(r.purchase_quantity),
    purchaseUnit: r.purchase_unit,
    purchasePrice: Number(r.purchase_price),
    baseUnit: r.base_unit,
    costPerBaseUnit: Number(r.cost_per_base_unit),
    supplier: r.supplier,
    isActive: r.is_active,
    updatedAt: r.updated_at,
  };
}

export async function listIngredients(): Promise<Ingredient[]> {
  const { data, error } = await supabaseAdmin()
    .from("ingredients")
    .select(INGREDIENT_COLUMNS)
    .order("name");
  if (error) fail(error, "ingredient");
  return (data as unknown as IngredientRow[]).map(toIngredient);
}

export async function createIngredient(input: IngredientInput, actor: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("ingredients")
    .insert({ ...toColumns(input), is_active: input.isActive ?? true, updated_by: actor });
  if (error) fail(error, "ingredient");
}

export async function updateIngredient(id: string, input: IngredientInput, actor: string): Promise<void> {
  const { data, error } = await supabaseAdmin()
    .from("ingredients")
    .update({ ...toColumns(input), updated_by: actor })
    .eq("id", id)
    .select("id");
  if (error) fail(error, "ingredient");
  if (!data?.length) throw new NotFoundError();
}

export async function setIngredientActive(id: string, active: boolean, actor: string): Promise<void> {
  const { data, error } = await supabaseAdmin()
    .from("ingredients")
    .update({ is_active: active, updated_by: actor })
    .eq("id", id)
    .select("id");
  if (error) fail(error, "ingredient");
  if (!data?.length) throw new NotFoundError();
}

function toColumns(i: IngredientInput) {
  return {
    name: i.name,
    category_id: i.categoryId,
    purchase_quantity: i.purchaseQuantity,
    purchase_unit: i.purchaseUnit,
    purchase_price: i.purchasePrice,
    supplier: i.supplier,
  };
}

// Categories

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabaseAdmin()
    .from("ingredient_categories")
    .select("id, name, is_active")
    .order("name");
  if (error) fail(error, "category");
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, isActive: c.is_active }));
}

export async function createCategory(name: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ingredient_categories").insert({ name });
  if (error) fail(error, "category");
}

export async function updateCategory(id: string, patch: { name?: string; isActive?: boolean }): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;
  const { data, error } = await supabaseAdmin()
    .from("ingredient_categories")
    .update(update)
    .eq("id", id)
    .select("id");
  if (error) fail(error, "category");
  if (!data?.length) throw new NotFoundError();
}
