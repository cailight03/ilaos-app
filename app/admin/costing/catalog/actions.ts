"use server";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";
import { logAudit } from "@/src/lib/audit-log";
import { DuplicateProductNameError, ProductInUseError, deleteCatalogProduct, updateCatalogProduct } from "@/src/lib/catalog";
import { NotFoundError } from "@/src/lib/ingredients";
import { getUserForModule } from "@/src/lib/session";
import { STOREFRONT_TAG } from "@/src/lib/store/catalog";

export type CatalogResult = { ok: true } | { ok: false; error: string };

export type CatalogPayload = {
  name: string;
  description: string;
  categoryId: string;
  price: number | null;
  imagePath: string;
  isPublished: boolean;
  hasSlicing: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_RE = /^\/[A-Za-z0-9_\-./]+\.(png|jpe?g|webp|avif|gif)$/i;

export async function saveCatalogProductAction(id: string, input: CatalogPayload): Promise<CatalogResult> {
  const user = await getUserForModule("costing_expenses");
  if (!user) return { ok: false, error: "You don't have permission to do that." };
  if (!UUID_RE.test(String(id)) || !UUID_RE.test(String(input?.categoryId))) return { ok: false, error: "Invalid product." };

  const name = String(input.name ?? "").trim();
  if (!name || name.length > 120) return { ok: false, error: "Enter a name up to 120 characters." };

  const description = String(input.description ?? "").trim();
  if (description.length > 500) return { ok: false, error: "Description must be 500 characters or fewer." };

  const price = input.price;
  if (price !== null && (!Number.isFinite(price) || price < 0 || price > 9_999_999)) {
    return { ok: false, error: "Enter a valid price." };
  }

  const image = String(input.imagePath ?? "").trim();
  if (image && (image.includes("..") || !IMAGE_RE.test(image))) {
    return { ok: false, error: "Image must be a path under /public, like /images/plain.jpg." };
  }

  const isPublished = Boolean(input.isPublished);
  if (isPublished && price === null) return { ok: false, error: "Set a price before publishing." };

  try {
    await updateCatalogProduct(id, {
      name,
      description,
      categoryId: input.categoryId,
      price: price === null ? null : Number(price.toFixed(2)),
      imagePath: image || null,
      isPublished,
      hasSlicing: Boolean(input.hasSlicing),
    });
  } catch (err) {
    if (err instanceof NotFoundError) return { ok: false, error: "That product no longer exists." };
    if (err instanceof DuplicateProductNameError) return { ok: false, error: err.message };
    console.error("[catalog]", err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
  revalidatePath("/admin/costing", "layout");
  revalidatePath("/admin/recipe-calculator", "layout");
  updateTag(STOREFRONT_TAG);
  after(() => logAudit(user.email, "edit", "Catalog"));
  return { ok: true };
}

export async function deleteCatalogProductAction(id: string): Promise<CatalogResult> {
  const user = await getUserForModule("costing_expenses");
  if (!user) return { ok: false, error: "You don't have permission to do that." };
  if (!UUID_RE.test(String(id))) return { ok: false, error: "Invalid product." };
  try {
    await deleteCatalogProduct(id);
  } catch (err) {
    if (err instanceof NotFoundError) return { ok: false, error: "That product no longer exists." };
    if (err instanceof ProductInUseError) return { ok: false, error: err.message };
    console.error("[catalog]", err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
  revalidatePath("/admin/costing", "layout");
  revalidatePath("/admin/recipe-calculator", "layout");
  updateTag(STOREFRONT_TAG);
  after(() => logAudit(user.email, "delete", "Catalog"));
  return { ok: true };
}
