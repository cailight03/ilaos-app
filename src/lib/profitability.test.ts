import test from "node:test";
import assert from "node:assert/strict";
import {
  allocateCents,
  attachCosts,
  buildCostBook,
  buildProfitCsv,
  buildProfitReport,
  changeOf,
  lookupCost,
  metricsForRange,
  type CostRow,
} from "./profitability.ts";
import type { ExpenseLike } from "./expense-types.ts";
import type { ReportOrder } from "./sales-report.ts";

const PLAIN = "Plain Sourdough";
const OTHER = "Cinnamon Roll";

const order = (n: number, bakeDate: string | null, total: number, over: Partial<ReportOrder> = {}): ReportOrder => ({
  rowNumber: n,
  bakeDate,
  total,
  refund: 0,
  items: [{ product: PLAIN, unitPrice: 300, quantity: 2 }],
  customerKey: null,
  ...over,
});

const cost = (productId: string, effectiveDate: string, unitCost: number | null, over: Partial<CostRow> = {}): CostRow => ({
  productId,
  effectiveDate,
  unitCost,
  isComplete: unitCost !== null,
  isEstimate: false,
  ...over,
});

const expense = (amount: number, expenseType: ExpenseLike["expenseType"], expenseDate: string, name = "Cat"): ExpenseLike => ({
  amount,
  expenseType,
  categoryId: name,
  categoryName: name,
  expenseDate,
  title: name,
  description: null,
});

const TODAY = "2026-11-24";
const month = (from: string, to: string) => ({ preset: "custom" as const, today: TODAY, custom: { from, to }, group: "day" as const });

function report(orders: ReportOrder[], costs: CostRow[], expenses: ExpenseLike[], from = "2026-11-01", to = "2026-11-30") {
  return buildProfitReport(attachCosts(orders, buildCostBook(costs)), expenses, month(from, to));
}

test("worked example: discount, COGS, expenses and margins", () => {
  const r = report(
    [order(1, "2026-11-10", 540)], // 2 × ₱300 less ₱60 discount
    [cost(PLAIN, "2026-01-01", 120)],
    [expense(100, "operating", "2026-11-12"), expense(500, "material", "2026-11-12"), expense(5000, "capital", "2026-11-12")],
  );
  const m = r.metrics;
  assert.equal(m.revenue, 540);
  assert.equal(m.cogs, 240);
  assert.equal(m.grossProfit, 300);
  assert.equal(m.grossMargin?.toFixed(2), "55.56");
  assert.equal(m.operatingExpenses, 100);
  assert.equal(m.netOperatingProfit, 200);
  assert.equal(m.operatingMargin?.toFixed(2), "37.04");
  assert.equal(m.coverage, "complete");
  assert.equal(r.expenseTotals.capital, 5000);
  assert.equal(r.expenseTotals.material, 500);
});

test("refunds reduce revenue; archived orders are not passed in at all", () => {
  const r = report([order(1, "2026-11-10", 540, { refund: 40 })], [cost(PLAIN, "2026-01-01", 120)], []);
  assert.equal(r.metrics.revenue, 500);
  assert.equal(r.metrics.grossProfit, 260);
});

test("historical cost: each bake date uses the cost in effect then", () => {
  const costs = [cost(PLAIN, "2026-01-01", 100), cost(PLAIN, "2026-11-15", 150)];
  const orders = [order(1, "2026-11-10", 600), order(2, "2026-11-20", 600)];
  const r = report(orders, costs, []);
  const byDate = Object.fromEntries(r.bakeDays.map((d) => [d.date, d.cogs]));
  assert.equal(byDate["2026-11-10"], 200);
  assert.equal(byDate["2026-11-20"], 300);
});

test("a later cost never changes a past period", () => {
  const orders = [order(1, "2026-11-10", 600)];
  const before = report(orders, [cost(PLAIN, "2026-01-01", 100)], []).metrics;
  const after = report(orders, [cost(PLAIN, "2026-01-01", 100), cost(PLAIN, "2026-11-23", 999)], []).metrics;
  assert.deepEqual(after, before);
});

test("no cost row before the bake date means uncosted, not zero and not today's cost", () => {
  const book = buildCostBook([cost(PLAIN, "2026-11-20", 100)]);
  assert.deepEqual(lookupCost(book, PLAIN, "2026-11-19"), { unitCost: null, status: "uncosted" });
  assert.deepEqual(lookupCost(book, "Unknown", "2026-11-25"), { unitCost: null, status: "uncosted" });
  assert.deepEqual(lookupCost(book, PLAIN, "2026-11-20"), { unitCost: 100, status: "costed" });

  const r = report([order(1, "2026-11-10", 600)], [cost(PLAIN, "2026-11-20", 100)], []);
  assert.equal(r.metrics.coverage, "incomplete");
  assert.equal(r.metrics.grossProfit, null);
  assert.equal(r.metrics.netOperatingProfit, null);
  assert.equal(r.metrics.grossMargin, null);
  assert.equal(r.metrics.uncostedRevenue, 600);
  assert.deepEqual(r.uncostedBakeDates, ["2026-11-10"]);
});

test("incomplete cost rows are uncosted; estimates are labelled", () => {
  const incomplete = buildCostBook([cost(PLAIN, "2026-01-01", null)]);
  assert.equal(lookupCost(incomplete, PLAIN, "2026-11-10").status, "uncosted");
  const est = report([order(1, "2026-11-10", 600)], [cost(PLAIN, "2026-01-01", 100, { isEstimate: true })], []);
  assert.equal(est.metrics.coverage, "estimate");
  assert.equal(est.metrics.grossProfit, 400);
});

test("mixed coverage: profit and margins use costed revenue only", () => {
  const orders = [
    order(1, "2026-11-10", 600),
    order(2, "2026-11-11", 400, { items: [{ product: OTHER, unitPrice: 200, quantity: 2 }] }),
  ];
  const r = report(orders, [cost(PLAIN, "2026-01-01", 100)], []);
  const m = r.metrics;
  assert.equal(m.revenue, 1000);
  assert.equal(m.costedRevenue, 600);
  assert.equal(m.uncostedRevenue, 400);
  assert.equal(m.cogs, 200);
  assert.equal(m.grossProfit, 400);
  assert.equal(m.coverage, "incomplete");
  const unknown = r.products.find((p) => p.product === OTHER);
  assert.equal(unknown?.grossProfit, null);
  assert.equal(r.products[r.products.length - 1].product, OTHER); // unknown ranks last
});

test("loss: costs above revenue give negative profit and margin", () => {
  const r = report([order(1, "2026-11-10", 100)], [cost(PLAIN, "2026-01-01", 100)], [expense(50, "operating", "2026-11-10")]);
  assert.equal(r.metrics.grossProfit, -100);
  assert.equal(r.metrics.netOperatingProfit, -150);
  assert.equal(r.metrics.operatingMargin, -150);
});

test("zero revenue: expenses still count, margins are null", () => {
  const r = report([], [], [expense(80, "operating", "2026-11-05")]);
  assert.equal(r.metrics.revenue, 0);
  assert.equal(r.metrics.grossProfit, 0);
  assert.equal(r.metrics.netOperatingProfit, -80);
  assert.equal(r.metrics.grossMargin, null);
  assert.equal(r.metrics.operatingMargin, null);
  assert.equal(r.metrics.coverage, "complete");
});

test("discount is shared across items by value, without losing a cent", () => {
  assert.deepEqual(allocateCents(100, [1, 1, 1]), [34, 33, 33]);
  assert.equal(allocateCents(1000, [3, 3, 3]).reduce((a, b) => a + b, 0), 1000);
  const orders = [
    order(1, "2026-11-10", 333.33, {
      items: [
        { product: PLAIN, unitPrice: 100, quantity: 1 },
        { product: OTHER, unitPrice: 200, quantity: 1 },
      ],
    }),
  ];
  const r = report(orders, [cost(PLAIN, "2026-01-01", 10), cost(OTHER, "2026-01-01", 10)], []);
  assert.equal(r.products.reduce((s, p) => s + p.revenue, 0).toFixed(2), "333.33");
  assert.equal(r.metrics.revenue, 333.33);
});

test("orders without readable items stay in revenue but are uncosted", () => {
  const r = report([order(1, "2026-11-10", 250, { items: [] })], [cost(PLAIN, "2026-01-01", 10)], []);
  assert.equal(r.metrics.revenue, 250);
  assert.equal(r.metrics.coverage, "incomplete");
});

test("date filtering is inclusive and uses bake date for sales, expense date for expenses", () => {
  const orders = [order(1, "2026-10-31", 100), order(2, "2026-11-01", 200), order(3, "2026-11-30", 300), order(4, "2026-12-01", 400)];
  const expenses = [
    expense(10, "operating", "2026-10-31"),
    expense(20, "operating", "2026-11-01"),
    expense(30, "operating", "2026-11-30"),
    expense(40, "operating", "2026-12-01"),
  ];
  const m = report(orders, [cost(PLAIN, "2026-01-01", 0)], expenses).metrics;
  assert.equal(m.revenue, 500);
  assert.equal(m.operatingExpenses, 50);
});

test("expense with no bake date lands in the period of its expense date, once", () => {
  const e = expense(75, "operating", "2026-11-15");
  const nov = report([], [], [e]).metrics.operatingExpenses;
  const dec = report([], [], [e], "2026-12-01", "2026-12-31").metrics.operatingExpenses;
  assert.equal(nov, 75);
  assert.equal(dec, 0);
});

test("material, capital are not deducted; no double counting across types", () => {
  const r = report(
    [order(1, "2026-11-10", 600)],
    [cost(PLAIN, "2026-01-01", 100)],
    [expense(999, "material", "2026-11-10"), expense(8888, "capital", "2026-11-10")],
  );
  assert.equal(r.metrics.operatingExpenses, 0);
  assert.equal(r.metrics.netOperatingProfit, r.metrics.grossProfit);
  const deducted = r.expenseBreakdown.filter((c) => c.type === "operating");
  assert.equal(deducted.length, 0);
});

test("previous-period comparison uses the equivalent earlier range", () => {
  const orders = [order(1, "2026-10-10", 300), order(2, "2026-11-10", 600)];
  const r = report(orders, [cost(PLAIN, "2026-01-01", 0)], [], "2026-11-01", "2026-11-30");
  assert.ok(r.comparison);
  assert.equal(r.comparison.currentMetrics.revenue, 600);
  assert.equal(r.comparison.previousMetrics.revenue, 300);
  assert.equal(changeOf(600, 300)?.pct, 100);
  assert.equal(changeOf(600, 0)?.pct, null);
  assert.equal(changeOf(null, 5), null);
});

test("report, metricsForRange and CSV agree", () => {
  const orders = [order(1, "2026-11-10", 540)];
  const costs = [cost(PLAIN, "2026-01-01", 120)];
  const expenses = [expense(100, "operating", "2026-11-12")];
  const costed = attachCosts(orders, buildCostBook(costs));
  const r = buildProfitReport(costed, expenses, month("2026-11-01", "2026-11-30"));
  assert.deepEqual(metricsForRange(costed, expenses, r.range), r.metrics);
  const csv = buildProfitCsv(r, "Custom");
  assert.match(csv, /Total revenue,540\.00/);
  assert.match(csv, /Net operating profit,200\.00/);
  assert.match(csv, /taxes and depreciation/);
});

test("bake day profit sums to total gross profit", () => {
  const orders = [order(1, "2026-11-10", 600), order(2, "2026-11-11", 300, { items: [{ product: PLAIN, unitPrice: 300, quantity: 1 }] })];
  const r = report(orders, [cost(PLAIN, "2026-01-01", 100)], []);
  const sum = r.bakeDays.reduce((s, d) => s + (d.grossProfit ?? 0), 0);
  assert.equal(sum, r.metrics.grossProfit);
});
