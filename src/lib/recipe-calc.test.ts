import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateQuantities,
  buildRecipeCards,
  cardDetail,
  formatRecipeText,
  sanitizeQuantity,
  totalPieces,
} from "./recipe-calc.ts";

test("scales jalapeño cheddar x3 per the spec", () => {
  const [card] = buildRecipeCards({ "Jalapeno Cheddar": 3 });
  assert.deepEqual(
    card.ingredients.map((i) => [i.name, i.grams]),
    [
      ["Bread Flour", 1200],
      ["Water", 816],
      ["Starter", 204],
      ["Salt", 24],
      ["Cheddar Cheese", 150],
      ["Jalapeños", 75],
    ],
  );
});

test("keeps products as separate cards and skips zero quantities", () => {
  const cards = buildRecipeCards({
    "Jalapeno Cheddar": 3,
    "Rosemary Focaccia": 2,
    "Plain Sourdough": 0,
  });
  assert.equal(cards.length, 2);
  assert.equal(cards[1].ingredients.find((i) => i.name === "Bread Flour")?.grams, 600);
  assert.equal(cards[1].ingredients.find((i) => i.name === "Extra Virgin Olive Oil")?.grams, 18);
  assert.equal(totalPieces({ "Jalapeno Cheddar": 3, "Rosemary Focaccia": 2 }), 5);
});

test("rosemary and tomato pesto share one focaccia dough card", () => {
  const cards = buildRecipeCards({ "Rosemary Focaccia": 1, "Tomato Pesto Focaccia": 1 });
  assert.equal(cards.length, 1);
  assert.equal(cards[0].pieces, 2);
  assert.equal(cards[0].ingredients.find((i) => i.name === "Bread Flour")?.grams, 600);
  assert.equal(cardDetail(cards[0]), "1 Rosemary Focaccia + 1 Tomato Pesto Focaccia");
  assert.equal(totalPieces({ "Rosemary Focaccia": 1, "Tomato Pesto Focaccia": 1 }), 2);
});

test("sanitizeQuantity rejects negatives, decimals and junk", () => {
  assert.equal(sanitizeQuantity("-5"), 0);
  assert.equal(sanitizeQuantity("2.7"), 2);
  assert.equal(sanitizeQuantity("abc"), 0);
  assert.equal(sanitizeQuantity(""), 0);
  assert.equal(sanitizeQuantity(undefined), 0);
  assert.equal(sanitizeQuantity(-3), 0);
  assert.equal(sanitizeQuantity(1e9), 999);
});

test("aggregateQuantities sums per product for the chosen date only", () => {
  const orders = [
    { bakeDate: "2026-11-22", items: [{ product: "Plain Sourdough", quantity: 2 }, { product: "Rosemary Focaccia", quantity: 1 }] },
    { bakeDate: "2026-11-22", items: [{ product: "Plain Sourdough", quantity: 3 }, { product: "Unknown Bun", quantity: 9 }] },
    { bakeDate: "2026-11-29", items: [{ product: "Plain Sourdough", quantity: 7 }] },
  ];
  const q = aggregateQuantities(orders, "2026-11-22");
  assert.equal(q["Plain Sourdough"], 5);
  assert.equal(q["Rosemary Focaccia"], 1);
  assert.equal(q["Jalapeno Cheddar"], 0);
});

test("formatRecipeText formats headings and grams", () => {
  const text = formatRecipeText(buildRecipeCards({ "Rosemary Focaccia": 1 }));
  assert.match(text, /^Rosemary Focaccia — 1 Piece\nBread Flour: 300g/);
});
