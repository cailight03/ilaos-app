export type Ingredient = { name: string; grams: number };

export type Recipe = {
  /** Matches the product name as written in the order sheet (products.cost_key in the database). */
  id: string;
  label: string;
  /** Products with the same group share one dough, so they're calculated as a single recipe card. */
  group?: { id: string; label: string };
  /** "Loaves", "Pieces" — used in headings */
  unit: { singular: string; plural: string };
  /** Grams per one piece. Empty means the recipe hasn't been provided yet. */
  ingredients: readonly Ingredient[];
};

export type RecipeId = string;

export type Quantities = Record<RecipeId, number>;
