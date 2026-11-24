import assert from "node:assert/strict";
import { test } from "node:test";
import {
  breakdownByCategory,
  filterExpenses,
  isIsoDate,
  monthRange,
  operatingExpenseTotal,
  summarize,
  type ExpenseLike,
} from "./expense-types.ts";

const row = (o: Partial<ExpenseLike>): ExpenseLike => ({
  amount: 100,
  expenseType: "operating",
  categoryId: "c1",
  categoryName: "Electricity",
  expenseDate: "2026-11-10",
  title: "Meralco bill",
  description: null,
  ...o,
});

const rows = [
  row({ amount: 1500.1 }),
  row({ amount: 0.2, categoryId: "c2", categoryName: "Ingredient Purchases", expenseType: "material", title: "Flour", description: "25kg bag" }),
  row({ amount: 8000, categoryId: "c3", categoryName: "Equipment", expenseType: "capital", title: "Oven", expenseDate: "2026-10-30" }),
];

test("summarize keeps the three types apart and avoids float drift", () => {
  assert.deepEqual(summarize(rows), { total: 9500.3, operating: 1500.1, material: 0.2, capital: 8000 });
});

test("operatingExpenseTotal excludes materials and capital", () => {
  assert.equal(operatingExpenseTotal(rows), 1500.1);
});

test("breakdown is sorted by amount with shares of the total", () => {
  const b = breakdownByCategory(rows);
  assert.deepEqual(b.map((x) => x.name), ["Equipment", "Electricity", "Ingredient Purchases"]);
  assert.ok(Math.abs(b.reduce((t, x) => t + x.share, 0) - 1) < 1e-9);
});

test("filter by search, category and inclusive date range", () => {
  const f = { query: "", from: "", to: "", categoryId: "all" };
  assert.equal(filterExpenses(rows, { ...f, query: "25KG" }).length, 1);
  assert.equal(filterExpenses(rows, { ...f, from: "2026-11-01", to: "2026-11-10" }).length, 2);
  assert.equal(filterExpenses(rows, { ...f, categoryId: "c3" }).length, 1);
});

test("monthRange handles year boundaries and leap years", () => {
  assert.deepEqual(monthRange("2026-01-15", -1), { from: "2025-12-01", to: "2025-12-31" });
  assert.deepEqual(monthRange("2028-02-10"), { from: "2028-02-01", to: "2028-02-29" });
});

test("isIsoDate rejects impossible dates", () => {
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("2026-11-24"), true);
});
