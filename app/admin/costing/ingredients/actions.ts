"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { logAudit } from "@/src/lib/audit-log";
import { UNITS, isUnit } from "@/src/lib/ingredient-cost";
import {
  DuplicateNameError,
  NotFoundError,
  createCategory,
  createIngredient,
  setIngredientActive,
  updateCategory,
  updateIngredient,
  type IngredientInput,
} from "@/src/lib/ingredients";
import { getUserForModule } from "@/src/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type SaveIngredientPayload = {
  id: string | null;
  name: string;
  categoryId: string;
  purchaseQuantity: number;
  purchaseUnit: string;
  purchasePrice: number;
  supplier: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AMOUNT = 9_999_999_999;
const DENIED = "You don't have permission to do that.";
const PATH = "/admin/costing/ingredients";

// Every action re-checks module access against the database before doing anything.
async function run(action: string, work: (actor: string) => Promise<ActionResult | void>): Promise<ActionResult> {
  const user = await getUserForModule("costing_expenses");
  if (!user) return { ok: false, error: DENIED };
  try {
    const result = await work(user.email);
    if (result && !result.ok) return result;
    revalidatePath(PATH);
    after(() => logAudit(user.email, action, "Ingredients"));
    return { ok: true };
  } catch (err) {
    if (err instanceof DuplicateNameError || err instanceof NotFoundError) {
      return { ok: false, error: err.message };
    }
    console.error("[ingredients]", err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

const decimals = (n: number, max: number) => Number(n.toFixed(max));

function parseIngredient(p: SaveIngredientPayload): IngredientInput | string {
  const name = String(p.name ?? "").trim();
  if (!name) return "Enter an ingredient name.";
  if (name.length > 120) return "Name is too long (120 characters max).";
  if (!UUID_RE.test(String(p.categoryId))) return "Choose a category.";
  if (!isUnit(p.purchaseUnit)) return `Unit must be one of ${UNITS.join(", ")}.`;
  const qty = Number(p.purchaseQuantity);
  const price = Number(p.purchasePrice);
  if (!Number.isFinite(qty) || qty <= 0) return "Quantity must be greater than zero.";
  if (!Number.isFinite(price) || price < 0) return "Price can't be negative.";
  if (qty > MAX_AMOUNT || price > MAX_AMOUNT) return "That number is too large.";
  const supplier = String(p.supplier ?? "").trim();
  if (supplier.length > 120) return "Supplier is too long (120 characters max).";
  const purchaseQuantity = decimals(qty, 4);
  if (purchaseQuantity <= 0) return "Quantity must be greater than zero.";
  return {
    name,
    categoryId: p.categoryId,
    purchaseQuantity,
    purchaseUnit: p.purchaseUnit,
    purchasePrice: decimals(price, 4),
    supplier: supplier || null,
  };
}

export async function saveIngredientAction(payload: SaveIngredientPayload): Promise<ActionResult> {
  if (payload.id !== null && !UUID_RE.test(String(payload.id))) return { ok: false, error: "Invalid ingredient." };
  const input = parseIngredient(payload);
  if (typeof input === "string") return { ok: false, error: input };
  return run(payload.id ? "edit" : "create", async (actor) => {
    await (payload.id ? updateIngredient(payload.id, input, actor) : createIngredient(input, actor));
    revalidatePath("/admin/costing/products");
  });
}

export async function setIngredientActiveAction(id: string, active: boolean): Promise<ActionResult> {
  if (!UUID_RE.test(String(id))) return { ok: false, error: "Invalid ingredient." };
  if (typeof active !== "boolean") return { ok: false, error: "Invalid request." };
  return run("edit", async (actor) => {
    await setIngredientActive(id, active, actor);
    revalidatePath("/admin/costing/products");
  });
}

export async function createCategoryAction(name: string): Promise<ActionResult> {
  const clean = String(name ?? "").trim();
  if (!clean) return { ok: false, error: "Enter a category name." };
  if (clean.length > 60) return { ok: false, error: "Category name is too long (60 characters max)." };
  return run("create", () => createCategory(clean));
}

export async function renameCategoryAction(id: string, name: string): Promise<ActionResult> {
  if (!UUID_RE.test(String(id))) return { ok: false, error: "Invalid category." };
  const clean = String(name ?? "").trim();
  if (!clean) return { ok: false, error: "Enter a category name." };
  if (clean.length > 60) return { ok: false, error: "Category name is too long (60 characters max)." };
  return run("edit", () => updateCategory(id, { name: clean }));
}

export async function setCategoryActiveAction(id: string, active: boolean): Promise<ActionResult> {
  if (!UUID_RE.test(String(id))) return { ok: false, error: "Invalid category." };
  if (typeof active !== "boolean") return { ok: false, error: "Invalid request." };
  return run("edit", () => updateCategory(id, { isActive: active }));
}
