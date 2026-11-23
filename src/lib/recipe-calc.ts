import { RECIPES, type Ingredient, type Quantities, type Recipe } from "./recipes.ts";

export const MAX_QUANTITY = 999;

export function emptyQuantities(): Quantities {
  return Object.fromEntries(RECIPES.map((r) => [r.id, 0])) as Quantities;
}

/** Coerces any input to a whole number in [0, MAX_QUANTITY]. Invalid values become 0. */
export function sanitizeQuantity(raw: unknown): number {
  const text = typeof raw === "number" ? String(Math.trunc(raw)) : String(raw ?? "").trim();
  if (text.startsWith("-")) return 0;
  const cleaned = text.split(/[.,]/)[0].replace(/\D/g, "");
  if (!cleaned) return 0;
  return Math.min(Number(cleaned), MAX_QUANTITY);
}

export function scaleIngredients(
  ingredients: readonly Ingredient[],
  pieces: number,
): Ingredient[] {
  const n = Math.max(0, Math.trunc(pieces) || 0);
  return ingredients.map((i) => ({ name: i.name, grams: i.grams * n }));
}

export type RecipeCard = {
  id: string;
  label: string;
  unit: Recipe["unit"];
  pieces: number;
  ingredients: Ingredient[];
  /** Per-product pieces, only meaningful when several products share one card. */
  parts: { label: string; pieces: number }[];
};

/**
 * One card per recipe with quantity > 0, in recipe order. Products that share a dough
 * (same `group`) are combined into one card; everything else stays separate.
 */
export function buildRecipeCards(quantities: Partial<Quantities>): RecipeCard[] {
  const cards = new Map<string, RecipeCard & { base: readonly Ingredient[] }>();

  for (const recipe of RECIPES as readonly Recipe[]) {
    const pieces = sanitizeQuantity(quantities[recipe.id as keyof Quantities]);
    if (pieces === 0) continue;

    const id = recipe.group?.id ?? recipe.id;
    const part = { label: recipe.label, pieces };
    const existing = cards.get(id);
    if (existing) {
      existing.pieces += pieces;
      existing.parts.push(part);
    } else {
      cards.set(id, {
        id,
        label: recipe.group?.label ?? recipe.label,
        unit: recipe.unit,
        pieces,
        ingredients: [],
        parts: [part],
        base: recipe.ingredients,
      });
    }
  }

  return [...cards.values()].map(({ base, ...card }) => ({
    ...card,
    // Use the group name only when several products actually share the card
    label: card.parts.length > 1 ? card.label : card.parts[0].label,
    ingredients: scaleIngredients(base, card.pieces),
  }));
}

export function totalPieces(quantities: Partial<Quantities>): number {
  return RECIPES.reduce((sum, r) => sum + sanitizeQuantity(quantities[r.id]), 0);
}

type OrderLike = {
  bakeDate: string | null;
  items: readonly { product: string; quantity: number }[];
};

/** Sums ordered quantities per known product for one bake date (ISO yyyy-mm-dd). */
export function aggregateQuantities(
  orders: readonly OrderLike[],
  bakeDate: string,
): Quantities {
  const result = emptyQuantities();
  for (const order of orders) {
    if (order.bakeDate !== bakeDate) continue;
    for (const item of order.items) {
      if (item.product in result) {
        result[item.product as keyof Quantities] += Math.max(0, Math.trunc(item.quantity));
      }
    }
  }
  return result;
}

const fmt = new Intl.NumberFormat("en-US");
export const formatGrams = (g: number) => `${fmt.format(g)}g`;

export function cardTitle(card: RecipeCard): string {
  const { singular, plural } = card.unit;
  return `${card.label} — ${card.pieces} ${card.pieces === 1 ? singular : plural}`;
}

/** e.g. "1 Rosemary Focaccia + 1 Tomato Pesto Focaccia"; null when the card is a single product. */
export function cardDetail(card: RecipeCard): string | null {
  return card.parts.length > 1
    ? card.parts.map((p) => `${p.pieces} ${p.label}`).join(" + ")
    : null;
}

export function formatRecipeText(cards: readonly RecipeCard[]): string {
  return cards
    .map((card) => {
      const lines =
        card.ingredients.length > 0
          ? card.ingredients.map((i) => `${i.name}: ${formatGrams(i.grams)}`)
          : ["Recipe not added yet"];
      const detail = cardDetail(card);
      return [cardTitle(card), ...(detail ? [`(${detail})`] : []), ...lines].join("\n");
    })
    .join("\n\n");
}
