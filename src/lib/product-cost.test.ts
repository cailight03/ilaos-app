import test from "node:test";
import assert from "node:assert/strict";
import { computeCustomProductCost, computeProductCost, type CostItem, type LibraryIngredient, type Mapping } from "./product-cost.ts";
import type { Recipe } from "./recipes.ts";

const recipe: Recipe = {
  id: "Test Loaf",
  label: "Test Loaf",
  unit: { singular: "Loaf", plural: "Loaves" },
  ingredients: [
    { name: "Bread Flour", grams: 400 },
    { name: "Water", grams: 272 },
    { name: "Starter", grams: 68 },
    { name: "Olive Oil", grams: 9.1 },
  ],
};

const lib = (id: string, baseUnit: "g" | "ml" | "pcs", cost: number, isActive = true): LibraryIngredient => ({
  id,
  name: id,
  baseUnit,
  costPerBaseUnit: cost,
  isActive,
});
const ingredients = [lib("flour", "g", 0.05), lib("water", "ml", 0.01), lib("oil", "ml", 0.4), lib("bag", "pcs", 2)];
const map = (recipeIngredient: string, ingredientId: string, densityGPerMl = 1): Mapping => ({
  recipeIngredient,
  ingredientId,
  densityGPerMl,
});
const full = [map("bread flour", "flour"), map("water", "water"), map("olive oil", "oil", 0.91)];
const base = { mappings: full, ingredients, items: [] as CostItem[], sellingPrice: null };

test("costs recipe lines, converting ml with density and splitting starter 70% hydration", () => {
  const r = computeProductCost(recipe, base);
  assert.equal(r.complete, true);
  // flour 400 + starter flour 40, water 272 + starter water 28, oil 9.1 g / 0.91 = 10 ml
  const expected = (400 + 40) * 0.05 + (272 + 28) * 0.01 + 10 * 0.4;
  assert.ok(Math.abs(r.totalCost! - expected) < 1e-9);
});

test("unmapped ingredients block the total instead of counting as zero", () => {
  const r = computeProductCost(recipe, { ...base, mappings: [map("bread flour", "flour")] });
  assert.equal(r.complete, false);
  assert.equal(r.totalCost, null);
  assert.equal(r.grossProfit, null);
  assert.ok(r.issueCount >= 2);
});

test("starter inherits missing flour/water mappings", () => {
  const r = computeProductCost(recipe, { ...base, mappings: [map("olive oil", "oil")] });
  assert.equal(r.lines.find((l) => l.key === "starter:flour")?.issue, "unmapped");
});

test("pcs ingredient can't be costed from grams", () => {
  const r = computeProductCost(recipe, { ...base, mappings: [...full.slice(1), map("bread flour", "bag")] });
  assert.equal(r.lines[0].issue, "unit_mismatch");
  assert.equal(r.totalCost, null);
});

test("packaging, profit and margin; archived ingredient warns but is costed", () => {
  const items: CostItem[] = [{ id: "1", productId: "Test Loaf", ingredientId: "bag", kind: "packaging", quantity: 1, unit: "pcs" }];
  const withArchived = ingredients.map((i) => (i.id === "oil" ? { ...i, isActive: false } : i));
  const r = computeProductCost(recipe, { ...base, ingredients: withArchived, items, sellingPrice: 400 });
  assert.equal(r.warningCount, 1);
  assert.equal(r.packagingCost, 2);
  assert.ok(Math.abs(r.grossProfit! - (400 - r.totalCost!)) < 1e-9);
  assert.ok(Math.abs(r.marginPct! - (r.grossProfit! / 400) * 100) < 1e-9);
});

test("margin is null without a price or with a zero price", () => {
  assert.equal(computeProductCost(recipe, base).marginPct, null);
  assert.equal(computeProductCost(recipe, { ...base, sellingPrice: 0 }).marginPct, null);
});

test("custom product costs its own ingredient items and treats no ingredients as unknown, not zero", () => {
  const product = { id: "p1", name: "Brownie", categoryId: "c1", unitLabel: "piece", isActive: true };
  const item = (kind: CostItem["kind"], ingredientId: string, quantity: number, unit: CostItem["unit"]): CostItem => ({
    id: `${kind}-${ingredientId}`,
    productId: "p1",
    ingredientId,
    kind,
    quantity,
    unit,
  });

  const empty = computeCustomProductCost(product, { ingredients, items: [], sellingPrice: 50 });
  assert.equal(empty.complete, false);
  assert.equal(empty.totalCost, null);

  const costed = computeCustomProductCost(product, {
    ingredients,
    items: [item("ingredient", "flour", 0.2, "kg"), item("packaging", "bag", 1, "pcs")],
    sellingPrice: 50,
  });
  assert.equal(costed.source, "custom");
  assert.ok(Math.abs(costed.totalCost! - (200 * 0.05 + 2)) < 1e-9);
  assert.ok(Math.abs(costed.grossProfit! - 38) < 1e-9);
});
