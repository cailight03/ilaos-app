"use server";

import { aggregateQuantities } from "@/src/lib/recipe-calc";
import type { Quantities } from "@/src/lib/recipes";
import { getSheetRows, SheetsError } from "@/src/lib/google-sheets";
import { parseOrders } from "@/src/lib/orders";
import { getUserForModule } from "@/src/lib/session";

export type LoadResult =
  | { ok: true; quantities: Quantities; orderCount: number }
  | { ok: false; error: string };

export async function loadQuantitiesFromOrders(bakeDate: string): Promise<LoadResult> {
  if (!(await getUserForModule("recipe_calculator"))) {
    return { ok: false, error: "You don't have access to the recipe calculator." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bakeDate)) {
    return { ok: false, error: "Pick a bake date first." };
  }

  try {
    const { rows } = await getSheetRows();
    const orders = parseOrders(rows).filter((o) => o.bakeDate === bakeDate);
    return {
      ok: true,
      quantities: aggregateQuantities(orders, bakeDate),
      orderCount: orders.length,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof SheetsError ? err.message : "Could not load orders. Try again.",
    };
  }
}
