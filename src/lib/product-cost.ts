import type { Recipe } from "./recipes.ts";
import { baseUnitOf, toBaseQuantity, type BaseUnit, type Unit } from "./ingredient-cost.ts";

/** Starter is built from flour and water at 70% hydration: per 1 g of starter, 1/1.7 g flour + 0.7/1.7 g water. */
export const STARTER_HYDRATION = 0.7;

export type LibraryIngredient = {
  id: string;
  name: string;
  baseUnit: BaseUnit;
  costPerBaseUnit: number;
  isActive: boolean;
};

export type Mapping = { recipeIngredient: string; ingredientId: string; densityGPerMl: number };

export type CostItem = {
  id: string;
  productId: string;
  ingredientId: string;
  kind: "ingredient" | "packaging" | "addon";
  quantity: number;
  unit: Unit;
};

/** A user-created product whose ingredients are Ingredient Library items (no recipe). */
export type CustomProduct = {
  id: string;
  name: string;
  categoryId: string;
  unitLabel: string;
  isActive: boolean;
};

export type LineKind = "recipe" | "starter" | "ingredient" | "packaging" | "addon";
export type LineIssue = "unmapped" | "missing_ingredient" | "unit_mismatch";

export type CostLine = {
  key: string;
  kind: LineKind;
  label: string;
  quantity: number;
  unit: Unit;
  /** Recipe ingredient key used to map this line (null for packaging and add-ons). */
  mappingKey: string | null;
  itemId: string | null;
  ingredientId: string | null;
  ingredientName: string | null;
  /** Mapped ingredient is archived: still costed, but flagged. */
  archived: boolean;
  densityGPerMl: number | null;
  baseQuantity: number | null;
  baseUnit: BaseUnit | null;
  unitCost: number | null;
  /** null when the line can't be costed. Never treated as zero. */
  cost: number | null;
  issue: LineIssue | null;
};

export type ProductCost = {
  productId: string;
  label: string;
  unitLabel: string;
  /** "recipe" products come from the Recipe Calculator; "custom" ones are created in Product Costing. */
  source: "recipe" | "custom";
  categoryId: string | null;
  categoryName: string | null;
  isActive: boolean;
  lines: CostLine[];
  ingredientCost: number | null;
  packagingCost: number | null;
  totalCost: number | null;
  sellingPrice: number | null;
  grossProfit: number | null;
  marginPct: number | null;
  /** Lines that block a total (unmapped, missing or mismatched). */
  issueCount: number;
  /** Lines costed using an archived ingredient. */
  warningCount: number;
  complete: boolean;
};

export const normalizeKey = (name: string) => name.trim().toLowerCase();

export const isStarter = (name: string) => normalizeKey(name) === "starter";

/** Mappable recipe ingredients (everything but Starter, which is derived), keyed by normalized name. */
export function mappableIngredients(recipes: readonly Recipe[]): { key: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const r of recipes) {
    for (const i of r.ingredients) {
      if (!isStarter(i.name) && !seen.has(normalizeKey(i.name))) seen.set(normalizeKey(i.name), i.name);
    }
  }
  return [...seen].map(([key, label]) => ({ key, label }));
}
type Context = {
  mappings: ReadonlyMap<string, Mapping>;
  ingredients: ReadonlyMap<string, LibraryIngredient>;
};

function blankLine(
  key: string,
  kind: LineKind,
  label: string,
  quantity: number,
  unit: Unit,
  mappingKey: string | null,
  itemId: string | null,
): CostLine {
  return {
    key,
    kind,
    label,
    quantity,
    unit,
    mappingKey,
    itemId,
    ingredientId: null,
    ingredientName: null,
    archived: false,
    densityGPerMl: null,
    baseQuantity: null,
    baseUnit: null,
    unitCost: null,
    cost: null,
    issue: null,
  };
}

function finish(line: CostLine, ing: LibraryIngredient | undefined, baseQuantity: number | null, issue: LineIssue | null) {
  if (ing) {
    line.ingredientId = ing.id;
    line.ingredientName = ing.name;
    line.archived = !ing.isActive;
    line.baseUnit = ing.baseUnit;
    line.unitCost = ing.costPerBaseUnit;
  }
  if (issue || baseQuantity === null || !ing) {
    line.issue = issue ?? "missing_ingredient";
    return line;
  }
  line.baseQuantity = baseQuantity;
  line.cost = baseQuantity * ing.costPerBaseUnit;
  return line;
}

/** A recipe line is in grams; convert to the mapped ingredient's base unit. */
function costRecipeLine(line: CostLine, ctx: Context): CostLine {
  const mapping = line.mappingKey ? ctx.mappings.get(line.mappingKey) : undefined;
  if (!mapping) {
    line.issue = "unmapped";
    return line;
  }
  line.ingredientId = mapping.ingredientId;
  line.densityGPerMl = mapping.densityGPerMl;
  const ing = ctx.ingredients.get(mapping.ingredientId);
  if (!ing) return finish(line, undefined, null, "missing_ingredient");
  if (ing.baseUnit === "g") return finish(line, ing, line.quantity, null);
  if (ing.baseUnit === "ml") return finish(line, ing, line.quantity / mapping.densityGPerMl, null);
  return finish(line, ing, null, "unit_mismatch"); // grams can't be converted to pieces
}

function costItemLine(line: CostLine, item: CostItem, ctx: Context): CostLine {
  const ing = ctx.ingredients.get(item.ingredientId);
  line.ingredientId = item.ingredientId;
  if (!ing) return finish(line, undefined, null, "missing_ingredient");
  if (baseUnitOf(item.unit) !== ing.baseUnit) return finish(line, ing, null, "unit_mismatch");
  return finish(line, ing, toBaseQuantity(item.quantity, item.unit), null);
}

const sum = (lines: CostLine[]) => lines.reduce((s, l) => s + (l.cost ?? 0), 0);

type Identity = Pick<ProductCost, "productId" | "label" | "unitLabel" | "source" | "categoryId" | "categoryName" | "isActive">;

function summarize(identity: Identity, lines: CostLine[], price: number | null): ProductCost {
  const issueCount = lines.filter((l) => l.issue !== null).length;
  const warningCount = lines.filter((l) => l.issue === null && l.archived).length;
  const complete = issueCount === 0;

  const packaging = lines.filter((l) => l.kind === "packaging");
  const ingredientCost = complete ? sum(lines.filter((l) => l.kind !== "packaging")) : null;
  const packagingCost = complete ? sum(packaging) : null;
  const totalCost = ingredientCost !== null && packagingCost !== null ? ingredientCost + packagingCost : null;

  const grossProfit = totalCost !== null && price !== null ? price - totalCost : null;
  const marginPct = grossProfit !== null && price !== null && price > 0 ? (grossProfit / price) * 100 : null;

  return {
    ...identity,
    lines,
    ingredientCost,
    packagingCost,
    totalCost,
    sellingPrice: price,
    grossProfit,
    marginPct,
    issueCount,
    warningCount,
    complete,
  };
}

function itemLines(productId: string, items: readonly CostItem[], ctx: Context): CostLine[] {
  return items
    .filter((i) => i.productId === productId)
    .map((item) => {
      const ing = ctx.ingredients.get(item.ingredientId);
      const line = blankLine(`${item.kind}:${item.ingredientId}`, item.kind, ing?.name ?? "Unknown ingredient", item.quantity, item.unit, null, item.id);
      return costItemLine(line, item, ctx);
    });
}

function contextOf(data: { mappings: readonly Mapping[]; ingredients: readonly LibraryIngredient[] }): Context {
  return {
    mappings: new Map(data.mappings.map((m) => [m.recipeIngredient, m])),
    ingredients: new Map(data.ingredients.map((i) => [i.id, i])),
  };
}

export function computeProductCost(
  recipe: Recipe,
  data: {
    mappings: readonly Mapping[];
    ingredients: readonly LibraryIngredient[];
    items: readonly CostItem[];
    sellingPrice: number | null;
  },
): ProductCost {
  const ctx = contextOf(data);

  const lines: CostLine[] = [];
  for (const ri of recipe.ingredients) {
    if (isStarter(ri.name)) {
      const flour = ri.grams / (1 + STARTER_HYDRATION);
      const water = (ri.grams * STARTER_HYDRATION) / (1 + STARTER_HYDRATION);
      lines.push(costRecipeLine(blankLine("starter:flour", "starter", "Starter · flour", flour, "g", "bread flour", null), ctx));
      lines.push(costRecipeLine(blankLine("starter:water", "starter", "Starter · water", water, "g", "water", null), ctx));
    } else {
      const key = normalizeKey(ri.name);
      lines.push(costRecipeLine(blankLine(`recipe:${key}`, "recipe", ri.name, ri.grams, "g", key, null), ctx));
    }
  }
  lines.push(...itemLines(recipe.id, data.items, ctx));

  return summarize(
    {
      productId: recipe.id,
      label: recipe.label,
      unitLabel: recipe.unit.singular,
      source: "recipe",
      categoryId: null,
      categoryName: null,
      isActive: true,
    },
    lines,
    data.sellingPrice,
  );
}

export function computeCustomProductCost(
  product: CustomProduct,
  data: { ingredients: readonly LibraryIngredient[]; items: readonly CostItem[]; sellingPrice: number | null },
): ProductCost {
  const ctx = contextOf({ mappings: [], ingredients: data.ingredients });
  const lines = itemLines(product.id, data.items, ctx);
  const result = summarize(
    {
      productId: product.id,
      label: product.name,
      unitLabel: product.unitLabel,
      source: "custom",
      categoryId: product.categoryId,
      categoryName: null,
      isActive: product.isActive,
    },
    lines,
    data.sellingPrice,
  );
  // A product with no ingredients yet has an unknown cost, not a zero cost.
  if (!lines.some((l) => l.kind === "ingredient")) {
    return {
      ...result,
      ingredientCost: null,
      packagingCost: null,
      totalCost: null,
      grossProfit: null,
      marginPct: null,
      issueCount: result.issueCount + 1,
      complete: false,
    };
  }
  return result;
}

export function computeAllProducts(data: {
  recipes: readonly Recipe[];
  mappings: readonly Mapping[];
  ingredients: readonly LibraryIngredient[];
  items: readonly CostItem[];
  prices: ReadonlyMap<string, number>;
  customProducts?: readonly CustomProduct[];
}): ProductCost[] {
  const recipes = data.recipes.map((r) =>
    computeProductCost(r, { ...data, sellingPrice: data.prices.get(r.id) ?? null }),
  );
  const custom = (data.customProducts ?? []).map((p) =>
    computeCustomProductCost(p, { ...data, sellingPrice: data.prices.get(p.id) ?? null }),
  );
  return [...recipes, ...custom];
}


export const ISSUE_LABEL: Record<LineIssue, string> = {
  unmapped: "Not mapped",
  missing_ingredient: "Ingredient missing",
  unit_mismatch: "Unit can't be converted",
};
