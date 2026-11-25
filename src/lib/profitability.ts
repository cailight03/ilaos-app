import {
  bucketKey,
  bucketLabels,
  formatRange,
  csvRow,
  filterByRange,
  isIsoDate,
  nextBucketKey,
  resolveComparison,
  resolveRange,
  type DateRange,
  type RangePreset,
  type ReportOrder,
  type TrendGroup,
} from "./sales-report.ts";
import { netTotal } from "./order-scope.ts";
import { productLabel } from "./order-view.ts";
import {
  breakdownByCategory,
  operatingExpenseTotal,
  summarize as summarizeExpenses,
  type CategoryBreakdown,
  type ExpenseLike,
  type ExpenseTotals,
} from "./expense-types.ts";

/**
 * Profitability. One pure module, so the report, the CSV and any dashboard figure agree.
 *
 *   Revenue            = Σ (order Total − refund), archived orders and repeated rows excluded
 *   COGS               = Σ quantity × unit cost in effect on the order's bake date
 *   Gross profit       = Revenue − COGS
 *   Net operating profit = Gross profit − operating expenses
 *
 * Only "operating" expenses are deducted. Material purchases are already inside COGS, and capital
 * purchases are shown separately. Taxes and depreciation are not included.
 */

export const PROFIT_NOTE =
  "Operating profit excludes taxes and depreciation. Ingredient and packaging purchases are not deducted again because their use is already in the cost of goods sold. Capital expenses are tracked separately.";

// ---------- Historical costs ----------

export type CostRow = {
  productId: string;
  effectiveDate: string; // ISO date the cost took effect
  unitCost: number | null; // null = could not be fully costed on that date
  isComplete: boolean;
  isEstimate: boolean;
};

export type CostStatus = "costed" | "estimate" | "uncosted";
export type CostBook = ReadonlyMap<string, readonly CostRow[]>;

export function buildCostBook(rows: readonly CostRow[]): CostBook {
  const book = new Map<string, CostRow[]>();
  for (const r of rows) (book.get(r.productId) ?? book.set(r.productId, []).get(r.productId)!).push(r);
  for (const list of book.values()) list.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  return book;
}

/**
 * The cost row in effect on a bake date: the latest one on or before it. Never falls back to a later
 * (or today's) cost, and never treats a missing cost as zero.
 */
export function lookupCost(
  book: CostBook,
  productId: string,
  bakeDate: string,
): { unitCost: number | null; status: CostStatus } {
  const rows = book.get(productId);
  let row: CostRow | undefined;
  for (const r of rows ?? []) {
    if (r.effectiveDate <= bakeDate) row = r;
    else break;
  }
  if (!row || !row.isComplete || row.unitCost === null || !Number.isFinite(row.unitCost) || row.unitCost < 0) {
    return { unitCost: null, status: "uncosted" };
  }
  return { unitCost: row.unitCost, status: row.isEstimate ? "estimate" : "costed" };
}

// ---------- Orders with their costs attached ----------

export type CostedLine = {
  product: string;
  quantity: number;
  unitPrice: number; // as recorded on the order
  unitCost: number | null;
  costStatus: CostStatus;
};

export type CostedOrder = {
  rowNumber: number;
  bakeDate: string;
  net: number; // Total − refund
  lines: CostedLine[];
};

/** Orders without a valid bake date are skipped, as in the Sales Report. */
export function attachCosts(orders: readonly ReportOrder[], book: CostBook): CostedOrder[] {
  const result: CostedOrder[] = [];
  for (const o of orders) {
    if (!isIsoDate(o.bakeDate)) continue;
    const bakeDate = o.bakeDate;
    result.push({
      rowNumber: o.rowNumber,
      bakeDate,
      net: netTotal(o),
      lines: o.items.map((i) => ({
        product: i.product,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        ...(() => {
          const c = lookupCost(book, i.product, bakeDate);
          return { unitCost: c.unitCost, costStatus: c.status };
        })(),
      })),
    });
  }
  return result;
}

// ---------- Cells: revenue and cost per bake date and product ----------

export const UNLISTED = "__unlisted";
export const UNLISTED_LABEL = "Items not listed on the order";

type Cell = {
  bakeDate: string;
  product: string;
  units: number;
  revenueC: number; // cents
  cogsC: number; // cents
  status: CostStatus;
  orders: Set<number>;
};

const cents = (n: number) => Math.round(n * 100);
const validQty = (q: number) => (Number.isFinite(q) && q > 0 ? q : 0);
const validPrice = (p: number) => (Number.isFinite(p) && p >= 0 ? p : 0);

/** Splits `totalC` cents across weights without losing a cent (largest remainder). */
export function allocateCents(totalC: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0 || !(sum > 0) || totalC === 0) return weights.map(() => 0);
  const exact = weights.map((w) => (totalC * w) / sum);
  const floors = exact.map(Math.floor);
  let left = totalC - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors;
}

function buildCells(orders: readonly CostedOrder[]): Cell[] {
  const cells = new Map<string, Cell>();
  const cell = (bakeDate: string, product: string, status: CostStatus) => {
    const key = `${bakeDate}|${product}`;
    return cells.get(key) ?? cells.set(key, { bakeDate, product, units: 0, revenueC: 0, cogsC: 0, status, orders: new Set() }).get(key)!;
  };
  const cogsExact = new Map<Cell, number>();

  for (const o of orders) {
    const netC = cents(o.net);
    const lines = o.lines.filter((l) => validQty(l.quantity) > 0);
    // Weigh by recorded line value; free items share by quantity.
    const byValue = lines.map((l) => validQty(l.quantity) * validPrice(l.unitPrice));
    const weights = byValue.some((w) => w > 0) ? byValue : lines.map((l) => validQty(l.quantity));

    if (lines.length === 0 || !weights.some((w) => w > 0)) {
      // Revenue with no readable items can't be costed; keep it visible rather than dropping it.
      if (netC !== 0) {
        const c = cell(o.bakeDate, UNLISTED, "uncosted");
        c.revenueC += netC;
        c.orders.add(o.rowNumber);
      }
      continue;
    }

    const shares = allocateCents(netC, weights);
    lines.forEach((l, i) => {
      const c = cell(o.bakeDate, l.product, l.costStatus);
      const qty = validQty(l.quantity);
      c.units += qty;
      c.revenueC += shares[i];
      c.orders.add(o.rowNumber);
      if (l.unitCost !== null) cogsExact.set(c, (cogsExact.get(c) ?? 0) + qty * l.unitCost);
    });
  }

  // Cost is rounded to cents once per product per bake date, so breakdowns add up to the totals.
  for (const [c, exact] of cogsExact) c.cogsC = c.status === "uncosted" ? 0 : cents(exact);
  return [...cells.values()];
}

// ---------- Metrics ----------

export type Coverage = "complete" | "estimate" | "incomplete";

export type ProfitMetrics = {
  revenue: number;
  cogs: number;
  /** Null when revenue exists but none of it could be costed. */
  grossProfit: number | null;
  grossMargin: number | null; // %
  operatingExpenses: number;
  netOperatingProfit: number | null;
  operatingMargin: number | null; // %
  /** Margins are measured against this: all revenue when complete, only costed revenue when not. */
  costedRevenue: number;
  uncostedRevenue: number;
  uncostedUnits: number;
  estimateUnits: number;
  orders: number;
  units: number;
  coverage: Coverage;
};

function metricsOf(cells: readonly Cell[], operatingC: number): ProfitMetrics {
  let revenueC = 0;
  let cogsC = 0;
  let costedC = 0;
  let uncostedUnits = 0;
  let estimateUnits = 0;
  let units = 0;
  const orders = new Set<number>();
  for (const c of cells) {
    revenueC += c.revenueC;
    units += c.units;
    c.orders.forEach((r) => orders.add(r));
    if (c.status === "uncosted") {
      uncostedUnits += c.units;
      continue;
    }
    cogsC += c.cogsC;
    costedC += c.revenueC;
    if (c.status === "estimate") estimateUnits += c.units;
  }

  const uncostedC = revenueC - costedC;
  const known = revenueC === 0 || costedC !== 0;
  const grossC = costedC - cogsC;
  const netC = grossC - operatingC;
  const pct = (n: number) => (costedC > 0 ? (n / costedC) * 100 : null);

  return {
    revenue: revenueC / 100,
    cogs: cogsC / 100,
    grossProfit: known ? grossC / 100 : null,
    grossMargin: known ? pct(grossC) : null,
    operatingExpenses: operatingC / 100,
    netOperatingProfit: known ? netC / 100 : null,
    operatingMargin: known ? pct(netC) : null,
    costedRevenue: costedC / 100,
    uncostedRevenue: uncostedC / 100,
    uncostedUnits,
    estimateUnits,
    orders: orders.size,
    units,
    coverage: uncostedC !== 0 || uncostedUnits > 0 ? "incomplete" : estimateUnits > 0 ? "estimate" : "complete",
  };
}

const inSpan = (date: string, r: DateRange) => (r.from === null || date >= r.from) && (r.to === null || date <= r.to);

function expensesIn(expenses: readonly ExpenseLike[], r: DateRange) {
  return expenses.filter((e) => isIsoDate(e.expenseDate) && inSpan(e.expenseDate, r));
}

/** Metrics for one date range. Operating expenses use expense dates; sales use bake dates. */
export function metricsForRange(
  orders: readonly CostedOrder[],
  expenses: readonly ExpenseLike[],
  range: DateRange,
): ProfitMetrics {
  const cells = buildCells(filterByRange(orders, range));
  return metricsOf(cells, cents(operatingExpenseTotal(expensesIn(expenses, range))));
}

export type Change = { amount: number; pct: number | null };

/** Change from previous to current. `pct` is only given when the previous value was positive. */
export function changeOf(current: number | null, previous: number | null): Change | null {
  if (current === null || previous === null) return null;
  const amount = current - previous;
  return { amount, pct: previous > 0 ? (amount / previous) * 100 : null };
}

// ---------- Report ----------

export type ProfitTrendPoint = {
  key: string;
  label: string;
  fullLabel: string;
  revenue: number;
  cogs: number;
  operatingExpenses: number;
  netOperatingProfit: number | null;
  grossProfit: number | null;
  coverage: Coverage;
};

export type BakeDayProfit = {
  date: string;
  orders: number;
  revenue: number;
  cogs: number;
  grossProfit: number | null;
  grossMargin: number | null;
  coverage: Coverage;
};

export type ProductProfit = {
  product: string;
  label: string;
  units: number;
  revenue: number;
  cogs: number;
  grossProfit: number | null;
  grossMargin: number | null;
  uncostedUnits: number;
  coverage: Coverage;
};

export type ProfitReport = {
  range: DateRange;
  metrics: ProfitMetrics;
  /** Like-for-like: a period in progress is compared with the same number of days of the previous one. */
  comparison: { current: DateRange; previous: DateRange; currentMetrics: ProfitMetrics; previousMetrics: ProfitMetrics } | null;
  expenseTotals: ExpenseTotals;
  /** Per category; `type` tells whether it was deducted (operating), excluded (material) or capital. */
  expenseBreakdown: CategoryBreakdown[];
  trend: ProfitTrendPoint[];
  bakeDays: BakeDayProfit[];
  products: ProductProfit[];
  /** Bake dates with sales that could not be fully costed. */
  uncostedBakeDates: string[];
};

export type ProfitOptions = {
  preset: RangePreset;
  today: string;
  custom?: { from: string; to: string };
  group: TrendGroup;
};

export function buildProfitReport(
  allOrders: readonly CostedOrder[],
  allExpenses: readonly ExpenseLike[],
  opts: ProfitOptions,
): ProfitReport {
  const { range, previous } = resolveRange(opts.preset, opts.today, opts.custom);
  const orders = filterByRange(allOrders, range);
  const expenses = expensesIn(allExpenses, range);
  const cells = buildCells(orders);
  const operating = expenses.filter((e) => e.expenseType === "operating");

  const span = resolveComparison(range, previous, opts.today);
  const comparison = span && {
    ...span,
    currentMetrics: metricsForRange(allOrders, allExpenses, span.current),
    previousMetrics: metricsForRange(allOrders, allExpenses, span.previous),
  };

  return {
    range,
    metrics: metricsOf(cells, cents(operatingExpenseTotal(expenses))),
    comparison,
    expenseTotals: summarizeExpenses(expenses),
    expenseBreakdown: breakdownByCategory(expenses),
    trend: buildProfitTrend(cells, operating, opts.group),
    bakeDays: buildBakeDayProfits(cells),
    products: buildProductProfits(cells),
    uncostedBakeDates: [...new Set(cells.filter((c) => c.status === "uncosted" && c.revenueC !== 0).map((c) => c.bakeDate))].sort(),
  };
}

function buildProfitTrend(cells: readonly Cell[], operating: readonly ExpenseLike[], group: TrendGroup): ProfitTrendPoint[] {
  const cellBuckets = new Map<string, Cell[]>();
  for (const c of cells) (cellBuckets.get(bucketKey(c.bakeDate, group)) ?? cellBuckets.set(bucketKey(c.bakeDate, group), []).get(bucketKey(c.bakeDate, group))!).push(c);
  const opexBuckets = new Map<string, number>();
  for (const e of operating) {
    const k = bucketKey(e.expenseDate, group);
    opexBuckets.set(k, (opexBuckets.get(k) ?? 0) + cents(e.amount));
  }

  const keys = [...new Set([...cellBuckets.keys(), ...opexBuckets.keys()])].sort();
  if (keys.length === 0) return [];
  const all = group === "day" ? keys : [];
  if (group !== "day") for (let k = keys[0]; k <= keys[keys.length - 1]; k = nextBucketKey(k, group)) all.push(k);

  return all.map((key) => {
    const m = metricsOf(cellBuckets.get(key) ?? [], opexBuckets.get(key) ?? 0);
    return {
      key,
      ...bucketLabels(key, group),
      revenue: m.revenue,
      cogs: m.cogs,
      operatingExpenses: m.operatingExpenses,
      netOperatingProfit: m.netOperatingProfit,
      grossProfit: m.grossProfit,
      coverage: m.coverage,
    };
  });
}

function buildBakeDayProfits(cells: readonly Cell[]): BakeDayProfit[] {
  const byDate = new Map<string, Cell[]>();
  for (const c of cells) (byDate.get(c.bakeDate) ?? byDate.set(c.bakeDate, []).get(c.bakeDate)!).push(c);
  return [...byDate]
    .map(([date, list]) => {
      const m = metricsOf(list, 0);
      return {
        date,
        orders: m.orders,
        revenue: m.revenue,
        cogs: m.cogs,
        grossProfit: m.grossProfit,
        grossMargin: m.grossMargin,
        coverage: m.coverage,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Gross profit per product, highest first. Products whose profit is unknown go last. */
function buildProductProfits(cells: readonly Cell[]): ProductProfit[] {
  const byProduct = new Map<string, Cell[]>();
  for (const c of cells) (byProduct.get(c.product) ?? byProduct.set(c.product, []).get(c.product)!).push(c);
  return [...byProduct]
    .map(([product, list]) => {
      const m = metricsOf(list, 0);
      return {
        product,
        label: product === UNLISTED ? UNLISTED_LABEL : productLabel(product),
        units: m.units,
        revenue: m.revenue,
        cogs: m.cogs,
        grossProfit: m.grossProfit,
        grossMargin: m.grossMargin,
        uncostedUnits: m.uncostedUnits,
        coverage: m.coverage,
      };
    })
    .sort((a, b) => {
      if (a.grossProfit === null || b.grossProfit === null) {
        return a.grossProfit === b.grossProfit ? b.revenue - a.revenue : a.grossProfit === null ? 1 : -1;
      }
      return b.grossProfit - a.grossProfit || b.revenue - a.revenue;
    });
}

// ---------- CSV ----------

const money = (n: number | null) => (n === null ? "" : n.toFixed(2));
const pct = (n: number | null) => (n === null ? "" : n.toFixed(1));
const COVERAGE_LABEL: Record<Coverage, string> = { complete: "Complete", estimate: "Estimate", incomplete: "Incomplete" };

export function buildProfitCsv(report: ProfitReport, periodLabel: string): string {
  const m = report.metrics;
  const lines: string[] = [
    csvRow(["Profitability report"]),
    csvRow(["Period", periodLabel]),
    csvRow(["Bake dates", formatRange(report.range)]),
    csvRow(["Cost data", COVERAGE_LABEL[m.coverage]]),
    csvRow(["Note", PROFIT_NOTE]),
    "",
    csvRow(["Metric", "Amount"]),
    csvRow(["Total revenue", money(m.revenue)]),
    csvRow(["Cost of goods sold", money(m.cogs)]),
    csvRow(["Gross profit", money(m.grossProfit)]),
    csvRow(["Gross profit margin %", pct(m.grossMargin)]),
    csvRow(["Operating expenses", money(m.operatingExpenses)]),
    csvRow(["Net operating profit", money(m.netOperatingProfit)]),
    csvRow(["Operating profit margin %", pct(m.operatingMargin)]),
    csvRow(["Revenue without cost data", money(m.uncostedRevenue)]),
    csvRow(["Capital expenses (not deducted)", money(report.expenseTotals.capital)]),
    csvRow(["Material purchases (not deducted)", money(report.expenseTotals.material)]),
    "",
    csvRow(["Product", "Units", "Revenue", "COGS", "Gross profit", "Gross margin %", "Cost data"]),
    ...report.products.map((p) =>
      csvRow([p.label, p.units, money(p.revenue), money(p.cogs), money(p.grossProfit), pct(p.grossMargin), COVERAGE_LABEL[p.coverage]]),
    ),
    "",
    csvRow(["Bake date", "Orders", "Revenue", "COGS", "Gross profit", "Gross margin %", "Cost data"]),
    ...report.bakeDays.map((d) =>
      csvRow([d.date, d.orders, money(d.revenue), money(d.cogs), money(d.grossProfit), pct(d.grossMargin), COVERAGE_LABEL[d.coverage]]),
    ),
    "",
    csvRow(["Expense category", "Type", "Total"]),
    ...report.expenseBreakdown.map((c) => csvRow([c.name, c.type, money(c.total)])),
  ];
  return lines.join("\r\n");
}
