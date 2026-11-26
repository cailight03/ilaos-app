"use server";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";
import { UNITS, isUnit } from "@/src/lib/ingredient-cost";
import { recordCostSnapshotSafely } from "@/src/lib/cost-history";
import {
  DuplicateItemError,
  ItemNotFoundError,
  createCostItem,
  createCustomProduct,
  createProductCategory,
  customProductExists,
  deleteCostItem,
  deleteMapping,
  isMappableRecipeIngredient,
  recipeProductExists,
  setProductPrice,
  setRecipeProductCategory,

  updateCostItem,
  updateCustomProduct,
  updateProductCategory,
  upsertMapping,
} from "@/src/lib/product-costing";
import { DuplicateNameError, NotFoundError } from "@/src/lib/ingredients";
import { logAudit } from "@/src/lib/audit-log";
import { getUserForModule } from "@/src/lib/session";
import { STOREFRONT_TAG } from "@/src/lib/store/catalog";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export type SaveCostItemPayload = {
  id: string | null;
  productId: string;
  ingredientId: string;
  kind: string;
  quantity: number;
  unit: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AMOUNT = 9_999_999_999;
const DENIED = "You don't have permission to do that.";

type Note = { action: "create" | "edit" | "delete"; id?: string };

// Every action re-checks module access against the database. The audit entry is written after
// the response is sent, so it never slows the save down.
async function run(work: (actor: string) => Promise<Note | void>): Promise<ActionResult> {
  const user = await getUserForModule("costing_expenses");
  if (!user) return { ok: false, error: DENIED };
  try {
    const note = await work(user.email);
    revalidatePath("/admin/costing", "layout");
    updateTag(STOREFRONT_TAG);
    if (note) after(() => logAudit(user.email, note.action, "Costing"));
    return { ok: true, id: note?.id };
  } catch (err) {
    if (
      err instanceof DuplicateItemError ||
      err instanceof ItemNotFoundError ||
      err instanceof DuplicateNameError ||
      err instanceof NotFoundError
    ) {
      return { ok: false, error: err.message };
    }
    console.error("[product-costing]", err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

/** Recipe products and custom products are both rows of products; custom ones are keyed by their own id. */
async function productKind(id: string): Promise<"recipe" | "custom" | null> {
  if (await recipeProductExists(id)) return "recipe";
  if (UUID_RE.test(id) && (await customProductExists(id))) return "custom";
  return null;
}

export async function saveMappingAction(
  recipeIngredient: string,
  ingredientId: string,
  density: number,
): Promise<ActionResult> {
  if (!(await isMappableRecipeIngredient(recipeIngredient))) return { ok: false, error: "Unknown recipe ingredient." };
  if (!UUID_RE.test(String(ingredientId))) return { ok: false, error: "Choose an ingredient." };
  const d = Number(density);
  if (!Number.isFinite(d) || d <= 0 || d > 100) return { ok: false, error: "Density must be greater than zero." };
  return run(async (actor) => {
    await upsertMapping(recipeIngredient, ingredientId, Number(d.toFixed(4)), actor);
    await recordCostSnapshotSafely(actor, "Ingredient mapping changed");
    return { action: "edit" };
  });
}

export async function clearMappingAction(recipeIngredient: string): Promise<ActionResult> {
  if (!(await isMappableRecipeIngredient(recipeIngredient))) return { ok: false, error: "Unknown recipe ingredient." };
  return run(async (actor) => {
    await deleteMapping(recipeIngredient);
    await recordCostSnapshotSafely(actor, "Ingredient mapping removed");
    return { action: "delete" };
  });
}

export async function saveCostItemAction(p: SaveCostItemPayload): Promise<ActionResult> {
  const product = await productKind(String(p.productId));
  if (!product) return { ok: false, error: "Unknown product." };
  if (p.id !== null && !UUID_RE.test(String(p.id))) return { ok: false, error: "Invalid item." };
  if (!UUID_RE.test(String(p.ingredientId))) return { ok: false, error: "Choose an ingredient." };
  if (p.kind !== "packaging" && p.kind !== "addon" && p.kind !== "ingredient") return { ok: false, error: "Invalid item type." };
  // Recipe products take their ingredients from the Recipe Calculator.
  if (p.kind === "ingredient" && product !== "custom") return { ok: false, error: "Invalid item type." };
  if (!isUnit(p.unit)) return { ok: false, error: `Unit must be one of ${UNITS.join(", ")}.` };
  const qty = Number(p.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "Quantity must be greater than zero." };
  if (qty > MAX_AMOUNT) return { ok: false, error: "That number is too large." };
  const quantity = Number(qty.toFixed(4));
  if (quantity <= 0) return { ok: false, error: "Quantity must be greater than zero." };

  const kind: "ingredient" | "packaging" | "addon" = p.kind;
  const input = { productId: p.productId, ingredientId: p.ingredientId, kind, quantity, unit: p.unit };
  return run(async (actor) => {
    if (p.id) await updateCostItem(p.id, input, actor);
    else await createCostItem(input, actor);
    await recordCostSnapshotSafely(actor, "Packaging or add-on changed");
    return { action: p.id ? "edit" : "create" };
  });
}

export async function removeCostItemAction(id: string): Promise<ActionResult> {
  if (!UUID_RE.test(String(id))) return { ok: false, error: "Invalid item." };
  return run(async (actor) => {
    const row = await deleteCostItem(id);
    if (!row) return;
    await recordCostSnapshotSafely(actor, "Packaging or add-on removed");
    return { action: "delete" };
  });
}

/** price null clears the selling price. */
export async function setProductPriceAction(productId: string, price: number | null): Promise<ActionResult> {
  if (!(await productKind(String(productId)))) return { ok: false, error: "Unknown product." };
  if (price !== null) {
    if (!Number.isFinite(price) || price < 0) return { ok: false, error: "Price can't be negative." };
    if (price > MAX_AMOUNT) return { ok: false, error: "That number is too large." };
  }
  const value = price === null ? null : Number(price.toFixed(4));
  return run(async () => {
    await setProductPrice(productId, value);
    return { action: "edit" };
  });
}



export type SaveProductPayload = { id: string | null; name: string; categoryId: string; unitLabel: string };

/** Creates a custom product, or edits one. Recipe products only take a category. Returns the product id. */
export async function saveProductAction(p: SaveProductPayload): Promise<ActionResult> {
  if (!UUID_RE.test(String(p.categoryId))) return { ok: false, error: "Choose a category." };
  const isRecipe = p.id !== null && (await recipeProductExists(p.id));
  if (isRecipe) {
    const id = p.id as string;
    return run(async () => {
      await setRecipeProductCategory(id, p.categoryId);
      return { action: "edit", id };
    });
  }

  const name = String(p.name ?? "").trim();
  const unitLabel = String(p.unitLabel ?? "").trim() || "piece";
  if (!name) return { ok: false, error: "Enter a product name." };
  if (name.length > 120) return { ok: false, error: "Name is too long (120 characters max)." };
  if (unitLabel.length > 30) return { ok: false, error: "Unit label is too long (30 characters max)." };
  if (p.id !== null && !UUID_RE.test(String(p.id))) return { ok: false, error: "Invalid product." };

  return run(async (actor) => {
    if (p.id) {
      await updateCustomProduct(p.id, { name, categoryId: p.categoryId, unitLabel });
      return { action: "edit", id: p.id };
    }
    const id = await createCustomProduct({ name, categoryId: p.categoryId, unitLabel }, actor);
    return { action: "create", id };
  });
}

export async function setProductActiveAction(id: string, active: boolean): Promise<ActionResult> {
  if (!UUID_RE.test(String(id)) || typeof active !== "boolean") return { ok: false, error: "Invalid request." };
  return run(async () => {
    await updateCustomProduct(id, { isActive: active });
    return { action: "edit" };
  });
}

function parseCategoryName(name: string): string | null {
  const n = String(name ?? "").trim();
  return n && n.length <= 60 ? n : null;
}

export async function createProductCategoryAction(name: string): Promise<ActionResult> {
  const n = parseCategoryName(name);
  if (!n) return { ok: false, error: "Enter a category name (60 characters max)." };
  return run(async () => {
    await createProductCategory(n);
    return { action: "create" };
  });
}

export async function renameProductCategoryAction(id: string, name: string): Promise<ActionResult> {
  const n = parseCategoryName(name);
  if (!UUID_RE.test(String(id))) return { ok: false, error: "Invalid category." };
  if (!n) return { ok: false, error: "Enter a category name (60 characters max)." };
  return run(async () => {
    await updateProductCategory(id, { name: n });
    return { action: "edit" };
  });
}

export async function setProductCategoryActiveAction(id: string, active: boolean): Promise<ActionResult> {
  if (!UUID_RE.test(String(id)) || typeof active !== "boolean") return { ok: false, error: "Invalid request." };
  return run(async () => {
    await updateProductCategory(id, { isActive: active });
    return { action: "edit" };
  });
}
