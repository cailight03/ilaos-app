import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBakeDays,
  buildCustomerInsights,
  buildProductPerformance,
  buildReportCsv,
  buildSalesReport,
  buildTrend,
  customerIdentity,
  filterByRange,
  growthPercent,
  resolveRange,
  sortProducts,
  summarize,
  todayInManila,
  type ReportOrder,
} from "./sales-report.ts";

const order = (n: number, bakeDate: string | null, total: number, over: Partial<ReportOrder> = {}): ReportOrder => ({
  rowNumber: n,
  bakeDate,
  total,
  items: [{ product: "Plain Sourdough", unitPrice: 250, quantity: 1 }],
  customerKey: null,
  ...over,
});

const TODAY = "2026-11-24"; // a Tuesday

test("todayInManila uses Asia/Manila, not UTC", () => {
  assert.equal(todayInManila(new Date("2026-11-23T17:00:00Z")), "2026-11-24");
  assert.equal(todayInManila(new Date("2026-11-23T15:59:00Z")), "2026-11-23");
});

test("resolveRange builds each preset and its previous equivalent period", () => {
  assert.deepEqual(resolveRange("week", TODAY), {
    range: { from: "2026-11-23", to: "2026-11-29" },
    previous: { from: "2026-11-16", to: "2026-11-22" },
  });
  assert.deepEqual(resolveRange("month", TODAY), {
    range: { from: "2026-11-01", to: "2026-11-30" },
    previous: { from: "2026-10-01", to: "2026-10-31" },
  });
  assert.deepEqual(resolveRange("lastMonth", "2026-01-15"), {
    range: { from: "2025-12-01", to: "2025-12-31" },
    previous: { from: "2025-11-01", to: "2025-11-30" },
  });
  assert.deepEqual(resolveRange("year", TODAY), {
    range: { from: "2026-01-01", to: "2026-12-31" },
    previous: { from: "2025-01-01", to: "2025-12-31" },
  });
  assert.deepEqual(resolveRange("all", TODAY), { range: { from: null, to: null }, previous: null });
});

test("custom range swaps reversed dates and compares with the preceding same-length window", () => {
  const r = resolveRange("custom", TODAY, { from: "2026-11-10", to: "2026-11-05" });
  assert.deepEqual(r.range, { from: "2026-11-05", to: "2026-11-10" });
  assert.deepEqual(r.previous, { from: "2026-10-30", to: "2026-11-04" });
  assert.equal(resolveRange("custom", TODAY, { from: "nope", to: "2026-11-10" }).previous, null);
});

test("filterByRange is inclusive and ignores orders without a valid bake date", () => {
  const orders = [
    order(1, "2026-11-01", 100),
    order(2, "2026-11-30", 100),
    order(3, "2026-12-01", 100),
    order(4, null, 100),
  ];
  const got = filterByRange(orders, { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual(got.map((o) => o.rowNumber), [1, 2]);
  assert.equal(filterByRange(orders, { from: null, to: null }).length, 3);
});

test("summarize counts each order total once, however many line items it has", () => {
  const multi = order(1, "2026-11-22", 780, {
    items: [
      { product: "Plain Sourdough", unitPrice: 250, quantity: 2 },
      { product: "Tomato Pesto Focaccia", unitPrice: 320, quantity: 1 },
    ],
  });
  const s = summarize([multi, order(2, "2026-11-22", 250), order(3, "2026-11-29", 250)]);
  assert.equal(s.totalSales, 1280);
  assert.equal(s.totalOrders, 3);
  assert.equal(s.totalProducts, 5);
  assert.equal(s.averageOrderValue, 1280 / 3);
  assert.equal(s.bakeDays, 2);
  assert.equal(s.averageSalesPerBakeDay, 640);
});

test("summarize handles empty and invalid data without NaN", () => {
  const empty = summarize([]);
  assert.equal(empty.averageOrderValue, null);
  assert.equal(empty.averageSalesPerBakeDay, null);
  const bad = summarize([order(1, "2026-11-22", NaN, { items: [{ product: "X", unitPrice: 1, quantity: NaN }] })]);
  assert.equal(bad.totalSales, 0);
  assert.equal(bad.totalProducts, 0);
});

test("growthPercent compares with the previous period and needs prior revenue", () => {
  assert.equal(growthPercent(150, 100), 50);
  assert.equal(growthPercent(50, 100), -50);
  assert.equal(growthPercent(100, 0), null);
});

test("buildSalesReport reports growth against the previous equivalent period", () => {
  const orders = [
    order(1, "2026-10-10", 200),
    order(2, "2026-10-17", 200),
    order(3, "2026-11-07", 500),
    order(4, "2026-12-05", 999), // outside both periods
    order(5, null, 999), // no bake date
  ];
  const r = buildSalesReport(orders, { preset: "month", today: TODAY, group: "day" });
  assert.equal(r.summary.totalSales, 500);
  assert.equal(r.comparison?.previousSales, 400);
  assert.equal(r.growth, 25);
  assert.equal(r.skippedOrders, 1);
  const all = buildSalesReport(orders, { preset: "all", today: TODAY, group: "day" });
  assert.equal(all.growth, null);
  assert.equal(all.summary.totalSales, 500 + 400 + 999);
});

test("growth for a period in progress compares the same number of elapsed days", () => {
  const orders = [
    order(1, "2026-10-20", 100), // inside the first 24 days of October
    order(2, "2026-10-28", 900), // later in October: must not count against a partial November
    order(3, "2026-11-10", 150),
    order(4, "2026-11-28", 5000), // scheduled after today: shown in totals, not in growth
  ];
  const r = buildSalesReport(orders, { preset: "month", today: TODAY, group: "day" });
  assert.equal(r.summary.totalSales, 5150);
  assert.deepEqual(r.comparison?.current, { from: "2026-11-01", to: TODAY });
  assert.deepEqual(r.comparison?.previous, { from: "2026-10-01", to: "2026-10-24" });
  assert.equal(r.growth, 50);
  // A finished period is compared in full.
  const last = buildSalesReport(orders, { preset: "lastMonth", today: TODAY, group: "day" });
  assert.equal(last.comparison?.currentSales, 1000);
});

test("a week is compared in full against the previous week", () => {
  const orders = [order(1, "2026-11-21", 400), order(2, "2026-11-28", 600)];
  const r = buildSalesReport(orders, { preset: "week", today: TODAY, group: "day" });
  assert.deepEqual(r.comparison?.current, { from: "2026-11-23", to: "2026-11-29" });
  assert.equal(r.growth, 50);
});

test("product performance uses recorded prices and lists every known product", () => {
  const rows = buildProductPerformance([
    order(1, "2025-09-06", 230, { items: [{ product: "Plain Sourdough", unitPrice: 230, quantity: 1 }] }),
    order(2, "2026-11-22", 500, { items: [{ product: "Plain Sourdough", unitPrice: 250, quantity: 2 }] }),
    order(3, "2026-11-22", 90, { items: [{ product: "Seasonal Loaf", unitPrice: 90, quantity: 1 }] }),
  ]);
  const plain = rows.find((r) => r.product === "Plain Sourdough")!;
  assert.equal(plain.quantity, 3);
  assert.equal(plain.revenue, 730);
  assert.equal(rows.length, 6); // 5 known + 1 unrecognized
  assert.equal(rows.find((r) => r.product === "Rosemary Focaccia")!.quantity, 0);
  assert.equal(Math.round(plain.revenueShare * 10) / 10, 89.0);
  assert.equal(
    rows.reduce((n, r) => n + r.unitShare, 0).toFixed(6),
    "100.000000",
  );
  assert.equal(sortProducts(rows, "revenue")[0].product, "Plain Sourdough");
});

test("product shares are zero, not NaN, when nothing was sold", () => {
  const rows = buildProductPerformance([]);
  assert.ok(rows.every((r) => r.revenueShare === 0 && r.unitShare === 0));
});

test("buildTrend groups by day, week, month and year", () => {
  const orders = [
    order(1, "2026-10-31", 100), // Saturday
    order(2, "2026-11-01", 200), // Sunday, same Mon-start week as Oct 31
    order(3, "2026-11-22", 300),
    order(4, "2027-01-02", 400),
  ];
  const days = buildTrend(orders, "day");
  assert.deepEqual(days.map((p) => p.key), ["2026-10-31", "2026-11-01", "2026-11-22", "2027-01-02"]);
  assert.equal(days[1].change, 100);

  const weeks = buildTrend(orders, "week");
  assert.equal(weeks[0].key, "2026-10-26");
  assert.equal(weeks[0].sales, 300);
  assert.equal(weeks[1].key, "2026-11-02");
  assert.equal(weeks[1].sales, 0); // quiet week shows as a real zero

  const months = buildTrend(orders, "month");
  assert.deepEqual(months.map((p) => [p.key, p.sales]), [
    ["2026-10", 100],
    ["2026-11", 500],
    ["2026-12", 0],
    ["2027-01", 400],
  ]);
  assert.equal(months[1].change, 400);
  assert.equal(months[3].change, null); // previous month had no sales

  assert.deepEqual(buildTrend(orders, "year").map((p) => [p.key, p.sales]), [
    ["2026", 600],
    ["2027", 400],
  ]);
  assert.deepEqual(buildTrend([], "day"), []);
});

test("buildBakeDays summarizes each date, newest first", () => {
  const days = buildBakeDays([
    order(1, "2026-11-15", 250),
    order(2, "2026-11-22", 250),
    order(3, "2026-11-22", 750, {
      items: [{ product: "Plain Sourdough", unitPrice: 250, quantity: 3 }],
    }),
  ]);
  assert.deepEqual(days.map((d) => d.date), ["2026-11-22", "2026-11-15"]);
  assert.deepEqual(days[0], { date: "2026-11-22", orders: 2, products: 4, sales: 1000, averageOrderValue: 500 });
});

test("customerIdentity prefers email, falls back to a normalized mobile, never uses names", () => {
  assert.equal(customerIdentity({ email: " Jo@Example.com ", mobile: "09171234567" }), "email:jo@example.com");
  assert.equal(customerIdentity({ email: "n/a", mobile: "0917 123 4567" }), "mobile:9171234567");
  assert.equal(customerIdentity({ mobile: "+63 917 123 4567" }), "mobile:9171234567");
  assert.equal(customerIdentity({ mobile: "9171234567" }), "mobile:9171234567");
  assert.equal(customerIdentity({ mobile: "12345" }), null);
  assert.equal(customerIdentity({}), null);
});

test("customer insights split new vs returning and measure repeat rate", () => {
  const c = (n: number, date: string, key: string | null) => order(n, date, 100, { customerKey: key });
  const orders = [
    c(1, "2026-10-10", "a"),
    c(2, "2026-10-10", "b"),
    c(3, "2026-11-07", "a"), // returning
    c(4, "2026-11-07", "c"), // new
    c(5, "2026-11-14", "c"), // c repeats within range
    c(6, "2026-11-14", "d"), // new, one order
  ];
  const range = { from: "2026-11-01", to: "2026-11-30" };
  const got = buildCustomerInsights(orders, range)!;
  assert.equal(got.uniqueCustomers, 3);
  assert.equal(got.newCustomers, 2);
  assert.equal(got.returningCustomers, 1);
  assert.equal(got.repeatCustomers, 2); // a (Oct + Nov) and c (two Nov dates)
  assert.equal(Math.round(got.repeatRate! * 10) / 10, 66.7);
});

test("customer insights are withheld when identifiers are unreliable", () => {
  const orders = [
    order(1, "2026-11-07", 100, { customerKey: "a" }),
    order(2, "2026-11-07", 100),
    order(3, "2026-11-14", 100),
  ];
  assert.equal(buildCustomerInsights(orders, { from: null, to: null }), null);
  assert.equal(buildCustomerInsights([], { from: null, to: null }), null);
});

test("CSV export includes summary, products and bake days with escaping", () => {
  const report = buildSalesReport(
    [order(1, "2026-11-22", 250, { items: [{ product: "=Evil, \"Loaf\"", unitPrice: 250, quantity: 1 }] })],
    { preset: "all", today: TODAY, group: "day" },
  );
  const csv = buildReportCsv(report, "All Time");
  assert.match(csv, /Total Sales \(PHP\),250\.00/);
  assert.match(csv, /Total Orders,1/);
  assert.match(csv, /Sales Growth vs Previous Period \(%\),\r\n/);
  assert.match(csv, /Product Performance/);
  assert.match(csv, /"'=Evil, ""Loaf"""/);
  assert.match(csv, /2026-11-22,1,1,250\.00,250\.00/);
});
