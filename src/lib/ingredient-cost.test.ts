import test from "node:test";
import assert from "node:assert/strict";
import { baseUnitOf, costPerBaseUnit, formatUnitCost, parseAmount } from "./ingredient-cost.ts";

test("converts kg and L to base units", () => {
  assert.equal(costPerBaseUnit(25, "kg", 1250), 0.05);
  assert.equal(costPerBaseUnit(1, "L", 150), 0.15);
  assert.equal(costPerBaseUnit(500, "g", 100), 0.2);
  assert.equal(costPerBaseUnit(12, "pcs", 60), 5);
});

test("maps units to base units", () => {
  assert.equal(baseUnitOf("kg"), "g");
  assert.equal(baseUnitOf("L"), "ml");
  assert.equal(baseUnitOf("pcs"), "pcs");
});

test("rejects invalid quantity or price", () => {
  assert.equal(costPerBaseUnit(0, "g", 10), null);
  assert.equal(costPerBaseUnit(-1, "g", 10), null);
  assert.equal(costPerBaseUnit(1, "g", -5), null);
  assert.equal(costPerBaseUnit(NaN, "g", 5), null);
  assert.equal(costPerBaseUnit(1, "g", 0), 0);
});

test("parses amounts and formats small costs without losing precision", () => {
  assert.equal(parseAmount("1,250.50"), 1250.5);
  assert.ok(Number.isNaN(parseAmount("  ")));
  assert.match(formatUnitCost(0.0042), /0\.0042/);
  assert.match(formatUnitCost(0.05), /0\.05$/);
});
