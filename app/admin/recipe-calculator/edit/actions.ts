"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { logAudit } from "@/src/lib/audit-log";
import { recordCostSnapshotSafely } from "@/src/lib/cost-history";
import { RecipeSaveError, saveRecipeRows, type RecipeRowInput } from "@/src/lib/recipes-db";
import { getUserForModule } from "@/src/lib/session";

export type SaveRecipeResult = { ok: true } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_GRAMS = 100_000;
const MAX_ROWS = 50;

export async function saveRecipeAction(costKey: string, rows: RecipeRowInput[]): Promise<SaveRecipeResult> {
  const user = await getUserForModule("recipe_calculator");
  if (!user) return { ok: false, error: "You don't have permission to do that." };
  if (typeof costKey !== "string" || !costKey || !Array.isArray(rows) || rows.length > MAX_ROWS) {
    return { ok: false, error: "Invalid recipe." };
  }

  const clean: RecipeRowInput[] = [];
  for (const r of rows) {
    const grams = Number(r?.grams);
    if (!Number.isFinite(grams) || grams <= 0) return { ok: false, error: "Every quantity must be greater than zero." };
    if (grams > MAX_GRAMS) return { ok: false, error: "A quantity is too large." };
    const rounded = Number(grams.toFixed(4));
    if (rounded <= 0) return { ok: false, error: "Every quantity must be greater than zero." };
    if (r.id !== null && !UUID_RE.test(String(r.id))) return { ok: false, error: "Invalid recipe." };
    if (r.id === null && !r.isStarter && !UUID_RE.test(String(r.ingredientId))) {
      return { ok: false, error: "Choose an ingredient from the library." };
    }
    clean.push({ id: r.id, grams: rounded, isStarter: r.id === null && Boolean(r.isStarter), ingredientId: r.ingredientId });
  }

  try {
    await saveRecipeRows(costKey, clean, user.email);
    await recordCostSnapshotSafely(user.email, "Recipe changed");
    revalidatePath("/admin/recipe-calculator", "layout");
    revalidatePath("/admin/costing", "layout");
    after(() => logAudit(user.email, "edit", "Recipes"));
    return { ok: true };
  } catch (err) {
    if (err instanceof RecipeSaveError) return { ok: false, error: err.message };
    console.error("[recipes]", err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
