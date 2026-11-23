export type Ingredient = { name: string; grams: number };

export type Recipe = {
  /** Matches the product name as written in the order sheet. */
  id: string;
  label: string;
  /** Products with the same group share one dough, so they're calculated as a single recipe card. */
  group?: { id: string; label: string };
  /** "Loaves", "Pieces" — used in headings */
  unit: { singular: string; plural: string };
  /** Grams per one piece. Empty means the recipe hasn't been provided yet. */
  ingredients: readonly Ingredient[];
};

const FOCACCIA_DOUGH: readonly Ingredient[] = [
  { name: "Bread Flour", grams: 300 },
  { name: "Water", grams: 234 },
  { name: "Starter", grams: 60 },
  { name: "Salt", grams: 6 },
  { name: "Extra Virgin Olive Oil", grams: 9 },
];

const FOCACCIA_GROUP = { id: "focaccia", label: "Focaccia" } as const;

export const RECIPES = [
  {
    id: "Plain Sourdough",
    label: "Plain Sourdough",
    unit: { singular: "Loaf", plural: "Loaves" },
    ingredients: [
      { name: "Bread Flour", grams: 400 },
      { name: "Water", grams: 272 },
      { name: "Starter", grams: 68 },
      { name: "Salt", grams: 8 },
    ],
  },
  {
    id: "Jalapeno Cheddar",
    label: "Jalapeño Cheddar Sourdough",
    unit: { singular: "Loaf", plural: "Loaves" },
    ingredients: [
      { name: "Bread Flour", grams: 400 },
      { name: "Water", grams: 272 },
      { name: "Starter", grams: 68 },
      { name: "Salt", grams: 8 },
      { name: "Cheddar Cheese", grams: 50 },
      { name: "Jalapeños", grams: 25 },
    ],
  },
  {
    id: "Wheat Multi-seed",
    label: "Wheat Multiseed Sourdough",
    unit: { singular: "Loaf", plural: "Loaves" },
    ingredients: [
      { name: "Bread Flour", grams: 350 },
      { name: "Wheat Flour", grams: 50 },
      { name: "Water", grams: 272 },
      { name: "Starter", grams: 64 },
      { name: "Salt", grams: 8 },
    ],
  },
  {
    id: "Rosemary Focaccia",
    label: "Rosemary Focaccia",
    group: FOCACCIA_GROUP,
    unit: { singular: "Piece", plural: "Pieces" },
    ingredients: FOCACCIA_DOUGH,
  },
  {
    id: "Tomato Pesto Focaccia",
    label: "Tomato Pesto Focaccia",
    group: FOCACCIA_GROUP,
    unit: { singular: "Piece", plural: "Pieces" },
    ingredients: FOCACCIA_DOUGH, // same base dough as Rosemary; toppings aren't tracked
  },
] as const satisfies readonly Recipe[];

export type RecipeId = (typeof RECIPES)[number]["id"];

export type Quantities = Record<RecipeId, number>;
