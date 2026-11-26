import "server-only";
import { supabaseAdmin } from "./supabase";
import { NotFoundError } from "./ingredients";

export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  categoryName: string;
  price: number | null;
  imagePath: string | null;
  isPublished: boolean;
  hasSlicing: boolean;
  isActive: boolean;
  /** Not on the order sheet, so deleting it can't orphan orders; the server still checks recipe and cost data. */
  canDelete: boolean;
};

export type CatalogPatch = {
  name: string;
  description: string;
  categoryId: string;
  price: number | null;
  imagePath: string | null;
  isPublished: boolean;
  hasSlicing: boolean;
};

type Row = {
  id: string;
  cost_key: string;
  name: string;
  slug: string;
  description: string;
  category_id: string;
  price: number | string | null;
  image_path: string | null;
  is_published: boolean;
  has_slicing: boolean;
  is_active: boolean;
  product_categories: { name: string } | { name: string }[] | null;
};

/** Store-facing fields only; recipes and costs are never read here. */
export async function listCatalog(): Promise<CatalogProduct[]> {
  const { data, error } = await supabaseAdmin()
    .from("products")
    .select(
      "id, cost_key, name, slug, description, category_id, price, image_path, is_published, has_slicing, is_active, product_categories(name)",
    )
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`catalog: ${error.message}`);
  return ((data ?? []) as Row[]).map((r) => {
    const cat = Array.isArray(r.product_categories) ? r.product_categories[0] : r.product_categories;
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      categoryId: r.category_id,
      categoryName: cat?.name ?? "",
      price: r.price === null ? null : Number(r.price),
      imagePath: r.image_path,
      isPublished: r.is_published,
      hasSlicing: r.has_slicing,
      isActive: r.is_active,
      canDelete: r.cost_key === r.id,
    };
  });
}

export class DuplicateProductNameError extends Error {
  constructor() {
    super("Another product already has that name.");
  }
}

export class ProductInUseError extends Error {}

/** Only products outside the order sheet with an empty recipe and no packaging or add-on costs can be deleted. */
export async function deleteCatalogProduct(id: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: product, error } = await db
    .from("products")
    .select("id, cost_key, recipes(recipe_ingredients(id))")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`catalog: ${error.message}`);
  if (!product) throw new NotFoundError();
  if (product.cost_key !== product.id) {
    throw new ProductInUseError("This product is tied to the order sheet. Unpublish it instead.");
  }
  const recipes = Array.isArray(product.recipes) ? product.recipes : product.recipes ? [product.recipes] : [];
  if (recipes.some((r: { recipe_ingredients: unknown[] | null }) => (r.recipe_ingredients ?? []).length > 0)) {
    throw new ProductInUseError("This product has a recipe. Unpublish it instead.");
  }
  // Cost history is append-only and keyed by text, not a foreign key. Products off the order sheet never
  // appear in sales, so leftover snapshots can't affect any report.
  const { count, error: e } = await db
    .from("product_cost_items")
    .select("product_id", { count: "exact", head: true })
    .eq("product_id", id);
  if (e) throw new Error(`catalog: ${e.message}`);
  if (count) throw new ProductInUseError("This product has packaging or add-on costs. Remove them in Product Costing first.");
  const { error: delError } = await db.from("products").delete().eq("id", id);
  if (delError) throw new Error(`catalog: ${delError.message}`);
}

export async function updateCatalogProduct(id: string, patch: CatalogPatch): Promise<void> {
  const { data, error } = await supabaseAdmin()
    .from("products")
    .update({
      name: patch.name,
      description: patch.description,
      category_id: patch.categoryId,
      price: patch.price,
      image_path: patch.imagePath,
      is_published: patch.isPublished,
      has_slicing: patch.hasSlicing,
    })
    .eq("id", id)
    .select("id");
  if (error) {
    if (error.code === "23505") throw new DuplicateProductNameError();
    if (error.code === "23503") throw new Error("Choose a valid category.");
    throw new Error(`catalog: ${error.message}`);
  }
  if (!data?.length) throw new NotFoundError();
}
