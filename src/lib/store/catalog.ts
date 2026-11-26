import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { supabaseAdmin } from "../supabase";
import { SLICING, type Product, type StoreCategory } from "./products";

export type StorefrontData = { products: Product[]; categories: StoreCategory[] };

type Row = {
  slug: string;
  name: string;
  description: string;
  price: number | string;
  image_path: string | null;
  sort_order: number;
  category_slug: string;
  category_name: string;
  category_sort_order: number;
  has_slicing: boolean;
};

export const STOREFRONT_TAG = "storefront-catalog";

/**
 * Published products for the public storefront. Reads only public.public_catalog, which carries no recipe,
 * ingredient, cost or margin columns.
 */
export async function loadStorefront(): Promise<StorefrontData> {
  "use cache";
  cacheTag(STOREFRONT_TAG);
  cacheLife("minutes");

  const { data, error } = await supabaseAdmin()
    .from("public_catalog")
    .select("slug, name, description, price, image_path, sort_order, category_slug, category_name, category_sort_order, has_slicing")
    .order("category_sort_order")
    .order("category_name")
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`storefront: ${error.message}`);

  const rows = (data ?? []) as Row[];
  const products: Product[] = rows.map((r) => ({
    id: r.slug,
    name: r.name,
    description: r.description,
    price: Number(r.price),
    category: r.category_slug,
    image: r.image_path ?? "",
    ...(r.has_slicing ? { options: [SLICING] } : {}),
  }));

  // One tile per category, using its first product's photo.
  const categories: StoreCategory[] = [];
  for (const r of rows) {
    if (categories.some((c) => c.id === r.category_slug)) continue;
    categories.push({ id: r.category_slug, label: r.category_name, image: r.image_path ?? "" });
  }
  return { products, categories };
}
