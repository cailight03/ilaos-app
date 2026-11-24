import type { OrderItem } from "./order-parsing.ts";
import type { ProductName } from "./orders.ts";
import { productLabel } from "./order-view.ts";

/** The slice of an order the report needs. `customerKey` is an opaque identifier, never a name. */
export type ReportOrder = {
  rowNumber: number;
  bakeDate: string | null; // ISO yyyy-mm-dd
  total: number; // the order's recorded Total, counted once per order
  items: OrderItem[];
  customerKey: string | null;
};

export type RangePreset = "week" | "month" | "lastMonth" | "year" | "all" | "custom";
export type TrendGroup = "day" | "week" | "month" | "year";
export type ProductSort = "quantity" | "revenue";

/** Inclusive ISO dates. `null` means unbounded on that side. */
export type DateRange = { from: string | null; to: string | null };

export const RANGE_LABELS: Record<RangePreset, string> = {
  week: "This Week",
  month: "This Month",
  lastMonth: "Last Month",
  year: "This Year",
  all: "All Time",
  custom: "Custom",
};

export const GROUP_LABELS: Record<TrendGroup, string> = {
  day: "Bake day",
  week: "Week",
  month: "Month",
  year: "Year",
};

// Always listed in product performance, even with no sales. Matches PRODUCTS in orders.ts.
export const KNOWN_PRODUCTS = [
  "Plain Sourdough",
  "Jalapeno Cheddar",
  "Wheat Multi-seed",
  "Rosemary Focaccia",
  "Tomato Pesto Focaccia",
] as const satisfies readonly ProductName[];

/** Customer insights are only shown when most orders in range carry a usable identifier. */
export const MIN_IDENTIFIED_SHARE = 0.8;

// ---------- Dates (all pure ISO-string math in UTC, so no timezone drift) ----------

const DAY_MS = 86_400_000;

const epochDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
};
const fromEpochDay = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);

export function isIsoDate(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && fromEpochDay(epochDay(value)) === value;
}

export const addDays = (iso: string, days: number) => fromEpochDay(epochDay(iso) + days);
const daysBetween = (from: string, to: string) => epochDay(to) - epochDay(from);

/** Weeks start on Monday. */
export const startOfWeek = (iso: string) => addDays(iso, -((new Date(epochDay(iso) * DAY_MS).getUTCDay() + 6) % 7));
const startOfMonth = (iso: string) => `${iso.slice(0, 8)}01`;
const endOfMonth = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return fromEpochDay(Date.UTC(y, m, 0) / DAY_MS);
};
const shiftMonths = (iso: string, months: number) => {
  const [y, m] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-01`;
};

/** Today's date in the bakery's timezone (Asia/Manila), as ISO yyyy-mm-dd. */
export function todayInManila(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export type ResolvedRange = {
  range: DateRange;
  /** The equivalent period right before `range`, or null when there is none (All Time). */
  previous: DateRange | null;
};

export function resolveRange(
  preset: RangePreset,
  today: string,
  custom?: { from: string; to: string },
): ResolvedRange {
  switch (preset) {
    case "week": {
      const from = startOfWeek(today);
      return {
        range: { from, to: addDays(from, 6) },
        previous: { from: addDays(from, -7), to: addDays(from, -1) },
      };
    }
    case "month": {
      const from = startOfMonth(today);
      const prev = shiftMonths(from, -1);
      return { range: { from, to: endOfMonth(from) }, previous: { from: prev, to: endOfMonth(prev) } };
    }
    case "lastMonth": {
      const from = shiftMonths(startOfMonth(today), -1);
      const prev = shiftMonths(from, -1);
      return { range: { from, to: endOfMonth(from) }, previous: { from: prev, to: endOfMonth(prev) } };
    }
    case "year": {
      const y = Number(today.slice(0, 4));
      return {
        range: { from: `${y}-01-01`, to: `${y}-12-31` },
        previous: { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
      };
    }
    case "custom": {
      if (custom && isIsoDate(custom.from) && isIsoDate(custom.to)) {
        const [from, to] = custom.from <= custom.to ? [custom.from, custom.to] : [custom.to, custom.from];
        const length = daysBetween(from, to) + 1;
        return {
          range: { from, to },
          previous: { from: addDays(from, -length), to: addDays(from, -1) },
        };
      }
      return { range: { from: null, to: null }, previous: null };
    }
    case "all":
    default:
      return { range: { from: null, to: null }, previous: null };
  }
}

const inRange = (date: string, r: DateRange) =>
  (r.from === null || date >= r.from) && (r.to === null || date <= r.to);

/** Orders whose bake date falls inside the range. Orders without a valid bake date never match. */
export function filterByRange<T extends { bakeDate: string | null }>(orders: readonly T[], range: DateRange): T[] {
  return orders.filter((o) => isIsoDate(o.bakeDate) && inRange(o.bakeDate, range));
}

// ---------- Formatting helpers (pure) ----------

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(epochDay(iso) * DAY_MS).toLocaleDateString("en-PH", { ...opts, timeZone: "UTC" });

export function formatRange(range: DateRange): string {
  if (!range.from || !range.to) return "All time";
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return range.from === range.to ? fmt(range.from, o) : `${fmt(range.from, o)} – ${fmt(range.to, o)}`;
}

// ---------- Core metrics ----------

const safe = (n: number) => (Number.isFinite(n) ? n : 0);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Units across line items. Invalid quantities count as 0. */
export const orderUnits = (o: Pick<ReportOrder, "items">) =>
  sum(o.items.map((i) => (Number.isFinite(i.quantity) && i.quantity > 0 ? i.quantity : 0)));

export type SummaryMetrics = {
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  averageOrderValue: number | null; // null when there are no orders
  bakeDays: number; // distinct bake dates with at least one order
  averageSalesPerBakeDay: number | null;
};

export function summarize(orders: readonly ReportOrder[]): SummaryMetrics {
  // `total` is the order's own recorded amount. Line items are never added to it.
  const totalSales = sum(orders.map((o) => safe(o.total)));
  const bakeDays = new Set(orders.map((o) => o.bakeDate).filter(Boolean)).size;
  return {
    totalSales,
    totalOrders: orders.length,
    totalProducts: sum(orders.map(orderUnits)),
    averageOrderValue: orders.length ? totalSales / orders.length : null,
    bakeDays,
    averageSalesPerBakeDay: bakeDays ? totalSales / bakeDays : null,
  };
}

/** Percent change from `previous` to `current`. Null when there is no previous revenue to compare to. */
export function growthPercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

// ---------- Trend ----------

export type TrendPoint = {
  key: string; // bucket start (ISO date, yyyy-mm or yyyy)
  label: string; // short axis label
  fullLabel: string; // tooltip title
  sales: number;
  orders: number;
  products: number;
  change: number | null; // % vs the previous point; null if that point had no sales
};

function bucketKey(date: string, group: TrendGroup): string {
  switch (group) {
    case "day":
      return date;
    case "week":
      return startOfWeek(date);
    case "month":
      return date.slice(0, 7);
    case "year":
      return date.slice(0, 4);
  }
}

function nextBucketKey(key: string, group: TrendGroup): string {
  switch (group) {
    case "day":
      return addDays(key, 1);
    case "week":
      return addDays(key, 7);
    case "month":
      return shiftMonths(`${key}-01`, 1).slice(0, 7);
    case "year":
      return String(Number(key) + 1);
  }
}

function bucketLabels(key: string, group: TrendGroup): { label: string; fullLabel: string } {
  switch (group) {
    case "day":
      return {
        label: fmt(key, { month: "short", day: "numeric" }),
        fullLabel: fmt(key, { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
      };
    case "week":
      return {
        label: fmt(key, { month: "short", day: "numeric" }),
        fullLabel: `Week of ${fmt(key, { month: "short", day: "numeric", year: "numeric" })}`,
      };
    case "month":
      return {
        label: fmt(`${key}-01`, { month: "short", year: "2-digit" }),
        fullLabel: fmt(`${key}-01`, { month: "long", year: "numeric" }),
      };
    case "year":
      return { label: key, fullLabel: key };
  }
}

/**
 * Revenue per bucket. Bake days only appear when there were orders; weeks, months and years
 * are continuous, so quiet periods show as real zeros rather than being skipped.
 */
export function buildTrend(orders: readonly ReportOrder[], group: TrendGroup): TrendPoint[] {
  const dated = orders.filter((o): o is ReportOrder & { bakeDate: string } => isIsoDate(o.bakeDate));
  if (dated.length === 0) return [];

  const buckets = new Map<string, ReportOrder[]>();
  for (const o of dated) {
    const k = bucketKey(o.bakeDate, group);
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(o);
  }

  const keys = [...buckets.keys()].sort();
  if (group !== "day") {
    const filled: string[] = [];
    for (let k = keys[0]; k <= keys[keys.length - 1]; k = nextBucketKey(k, group)) filled.push(k);
    keys.splice(0, keys.length, ...filled);
  }

  const points: TrendPoint[] = [];
  for (const key of keys) {
    const s = summarize(buckets.get(key) ?? []);
    points.push({
      key,
      ...bucketLabels(key, group),
      sales: s.totalSales,
      orders: s.totalOrders,
      products: s.totalProducts,
      change: points.length ? growthPercent(s.totalSales, points[points.length - 1].sales) : null,
    });
  }
  return points;
}

// ---------- Products ----------

export type ProductPerformance = {
  product: string; // sheet name
  label: string; // display name
  quantity: number;
  revenue: number; // recorded unit price x quantity, as saved on each order
  revenueShare: number; // % of product revenue
  unitShare: number; // % of units sold
};

/**
 * Revenue uses each line item's recorded unit price, so historical orders keep the price they
 * were sold at. It is before any order-level discount, so it can differ from Total Sales.
 */
export function buildProductPerformance(orders: readonly ReportOrder[]): ProductPerformance[] {
  const acc = new Map<string, { quantity: number; revenue: number }>(
    KNOWN_PRODUCTS.map((p) => [p, { quantity: 0, revenue: 0 }]),
  );

  for (const order of orders) {
    for (const item of order.items) {
      const qty = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 0;
      const price = Number.isFinite(item.unitPrice) && item.unitPrice >= 0 ? item.unitPrice : 0;
      const row = acc.get(item.product) ?? acc.set(item.product, { quantity: 0, revenue: 0 }).get(item.product)!;
      row.quantity += qty;
      row.revenue += qty * price;
    }
  }

  const totalQty = sum([...acc.values()].map((r) => r.quantity));
  const totalRevenue = sum([...acc.values()].map((r) => r.revenue));
  return [...acc].map(([product, r]) => ({
    product,
    label: productLabel(product),
    quantity: r.quantity,
    revenue: r.revenue,
    revenueShare: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0,
    unitShare: totalQty > 0 ? (r.quantity / totalQty) * 100 : 0,
  }));
}

export function sortProducts(rows: readonly ProductPerformance[], by: ProductSort): ProductPerformance[] {
  return [...rows].sort((a, b) =>
    by === "quantity"
      ? b.quantity - a.quantity || b.revenue - a.revenue || a.label.localeCompare(b.label)
      : b.revenue - a.revenue || b.quantity - a.quantity || a.label.localeCompare(b.label),
  );
}

// ---------- Bake days ----------

export type BakeDayPerformance = {
  date: string;
  orders: number;
  products: number;
  sales: number;
  averageOrderValue: number;
};

/** One row per bake date, newest first. */
export function buildBakeDays(orders: readonly ReportOrder[]): BakeDayPerformance[] {
  const byDate = new Map<string, ReportOrder[]>();
  for (const o of orders) {
    if (!isIsoDate(o.bakeDate)) continue;
    (byDate.get(o.bakeDate) ?? byDate.set(o.bakeDate, []).get(o.bakeDate)!).push(o);
  }
  return [...byDate]
    .map(([date, list]) => {
      const s = summarize(list);
      return {
        date,
        orders: s.totalOrders,
        products: s.totalProducts,
        sales: s.totalSales,
        averageOrderValue: s.averageOrderValue ?? 0,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ---------- Customers ----------

/**
 * Stable customer identifier: email when present and valid, otherwise a normalized Philippine
 * mobile number. Names are never used. Returns null when neither is usable.
 */
export function customerIdentity(o: { email?: string; mobile?: string }): string | null {
  const email = o.email?.trim().toLowerCase();
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return `email:${email}`;

  let digits = (o.mobile ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("63")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.length === 10 && digits.startsWith("9") ? `mobile:${digits}` : null;
}

export type CustomerInsights = {
  uniqueCustomers: number;
  newCustomers: number; // first-ever order is inside the range
  returningCustomers: number; // ordered on an earlier bake date before the range
  repeatCustomers: number; // ordered on 2+ different bake dates up to the end of the range
  repeatRate: number | null; // repeatCustomers / uniqueCustomers, %
  unidentifiedOrders: number; // in-range orders with no usable identifier
};

/** Returns null when too few orders in range can be tied to a customer for the numbers to be trusted. */
export function buildCustomerInsights(
  allOrders: readonly ReportOrder[],
  range: DateRange,
): CustomerInsights | null {
  const dated = allOrders.filter((o): o is ReportOrder & { bakeDate: string } => isIsoDate(o.bakeDate));
  const current = dated.filter((o) => inRange(o.bakeDate, range));
  if (current.length === 0) return null;

  const identified = current.filter((o) => o.customerKey);
  if (identified.length / current.length < MIN_IDENTIFIED_SHARE) return null;

  const history = new Map<string, Set<string>>(); // customer -> bake dates up to range end
  const firstSeen = new Map<string, string>();
  for (const o of dated) {
    if (!o.customerKey) continue;
    const first = firstSeen.get(o.customerKey);
    if (!first || o.bakeDate < first) firstSeen.set(o.customerKey, o.bakeDate);
    if (range.to === null || o.bakeDate <= range.to) {
      (history.get(o.customerKey) ?? history.set(o.customerKey, new Set()).get(o.customerKey)!).add(o.bakeDate);
    }
  }

  const customers = new Set(identified.map((o) => o.customerKey!));
  let fresh = 0;
  let repeat = 0;
  for (const key of customers) {
    if (range.from === null || firstSeen.get(key)! >= range.from) fresh++;
    if ((history.get(key)?.size ?? 0) >= 2) repeat++;
  }

  return {
    uniqueCustomers: customers.size,
    newCustomers: fresh,
    returningCustomers: customers.size - fresh,
    repeatCustomers: repeat,
    repeatRate: customers.size ? (repeat / customers.size) * 100 : null,
    unidentifiedOrders: current.length - identified.length,
  };
}

// ---------- Full report ----------

export type SalesReport = {
  range: DateRange;
  summary: SummaryMetrics;
  /**
   * Growth is like-for-like: for a period still in progress, sales up to today are compared with
   * the same number of days at the start of the previous period. Null when there is no earlier period.
   */
  comparison: { current: DateRange; previous: DateRange; currentSales: number; previousSales: number } | null;
  growth: number | null; // sales growth %, null when the previous period had no sales
  trend: TrendPoint[];
  products: ProductPerformance[];
  productRevenueTotal: number; // sum of recorded line-item revenue
  bakeDays: BakeDayPerformance[];
  customers: CustomerInsights | null;
  skippedOrders: number; // orders with no valid bake date, left out of every figure
};

export type ReportOptions = {
  preset: RangePreset;
  today: string;
  custom?: { from: string; to: string };
  group: TrendGroup;
};

function resolveComparison(range: DateRange, previous: DateRange | null, today: string) {
  if (!previous || !range.from || !range.to || !previous.from || !previous.to) return null;
  if (today < range.from) return null; // nothing has happened yet in this period
  // A week is one bake cycle and orders are placed ahead of bake day, so it is compared in full.
  if (range.to <= today || daysBetween(range.from, range.to) < 7) return { current: range, previous };
  const elapsed = daysBetween(range.from, today) + 1;
  return {
    current: { from: range.from, to: today },
    previous: { from: previous.from, to: addDays(previous.from, elapsed - 1) },
  };
}

export function buildSalesReport(allOrders: readonly ReportOrder[], opts: ReportOptions): SalesReport {
  const { range, previous } = resolveRange(opts.preset, opts.today, opts.custom);
  const orders = filterByRange(allOrders, range);
  const products = buildProductPerformance(orders);

  const span = resolveComparison(range, previous, opts.today);
  const comparison = span && {
    ...span,
    currentSales: summarize(filterByRange(allOrders, span.current)).totalSales,
    previousSales: summarize(filterByRange(allOrders, span.previous)).totalSales,
  };

  return {
    range,
    summary: summarize(orders),
    comparison,
    growth: comparison ? growthPercent(comparison.currentSales, comparison.previousSales) : null,
    trend: buildTrend(orders, opts.group),
    products,
    productRevenueTotal: sum(products.map((p) => p.revenue)),
    bakeDays: buildBakeDays(orders),
    customers: buildCustomerInsights(allOrders, range),
    skippedOrders: allOrders.filter((o) => !isIsoDate(o.bakeDate)).length,
  };
}


// ---------- CSV ----------

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  let s = typeof value === "number" ? String(value) : value;
  // Stop spreadsheet apps from running text that starts like a formula.
  if (typeof value === "string" && !/^-?\d+(\.\d+)?$/.test(s) && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const csvRow = (cells: (string | number | null)[]) => cells.map(csvCell).join(",");
const money = (n: number) => n.toFixed(2);
const pct = (n: number | null) => (n === null ? "" : n.toFixed(1));

export function buildReportCsv(report: SalesReport, periodLabel: string, sort: ProductSort = "revenue"): string {
  const s = report.summary;
  const lines: string[] = [
    csvRow(["Ilao's Microbakery - Sales Report"]),
    csvRow(["Period", periodLabel]),
    csvRow(["Dates", formatRange(report.range)]),
    "",
    csvRow(["Summary"]),
    csvRow(["Metric", "Value"]),
    csvRow(["Total Sales (PHP)", money(s.totalSales)]),
    csvRow(["Total Orders", s.totalOrders]),
    csvRow(["Total Products Sold", s.totalProducts]),
    csvRow(["Average Order Value (PHP)", s.averageOrderValue === null ? "" : money(s.averageOrderValue)]),
    csvRow(["Bake Days", s.bakeDays]),
    csvRow([
      "Average Sales per Bake Day (PHP)",
      s.averageSalesPerBakeDay === null ? "" : money(s.averageSalesPerBakeDay),
    ]),
    csvRow(["Sales Growth vs Previous Period (%)", pct(report.growth)]),
    csvRow(["Compared With", report.comparison ? formatRange(report.comparison.previous) : "n/a"]),
  ];

  if (report.customers) {
    const c = report.customers;
    lines.push(
      csvRow(["Unique Customers", c.uniqueCustomers]),
      csvRow(["New Customers", c.newCustomers]),
      csvRow(["Returning Customers", c.returningCustomers]),
      csvRow(["Repeat Customer Rate (%)", pct(c.repeatRate)]),
    );
  }

  lines.push(
    "",
    csvRow(["Product Performance"]),
    csvRow(["Product", "Quantity Sold", "Revenue (PHP)", "% of Revenue", "% of Units"]),
    ...sortProducts(report.products, sort).map((p) =>
      csvRow([p.label, p.quantity, money(p.revenue), pct(p.revenueShare), pct(p.unitShare)]),
    ),
    "",
    csvRow(["Bake Day Performance"]),
    csvRow(["Bake Date", "Orders", "Products Sold", "Sales (PHP)", "Average Order Value (PHP)"]),
    ...report.bakeDays.map((d) =>
      csvRow([d.date, d.orders, d.products, money(d.sales), money(d.averageOrderValue)]),
    ),
  );

  return lines.join("\r\n") + "\r\n";
}
