"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, TriangleAlert, Info, TrendingDown, TrendingUp } from "lucide-react";
import { formatBakeDate, formatPeso } from "@/src/lib/order-view";
import {
  PROFIT_NOTE,
  buildProfitCsv,
  buildProfitReport,
  changeOf,
  type Change,
  type Coverage,
  type ProfitReport,
} from "@/src/lib/profitability";
import {
  GROUP_LABELS,
  RANGE_LABELS,
  formatRange,
  type RangePreset,
  type TrendGroup,
} from "@/src/lib/sales-report";
import type { ProfitInputs } from "@/src/lib/profitability-service";
import { ProfitTrendChart } from "./charts";
import { Section, Segmented } from "./reports-ui";

const GROUPS: TrendGroup[] = ["day", "week", "month", "year"];
const BAKE_DAY_PAGE = 8;

type Scope = { archived: number; duplicatesRemoved: number; conflictingInvoices: number };

const peso = (n: number | null) => {
  if (n === null) return "—";
  return n < 0 ? `−${formatPeso(Math.abs(n))}` : formatPeso(n);
};
const percent = (n: number | null) => (n === null ? "—" : `${n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}%`);
const tone = (n: number | null) => (n === null ? "" : n < 0 ? "text-red-600" : "");

const COVERAGE: Record<Coverage, { label: string; cls: string } | null> = {
  complete: null,
  estimate: { label: "Estimate", cls: "bg-amber-100 text-amber-800" },
  incomplete: { label: "Incomplete", cls: "bg-amber-100 text-amber-800" },
};

function CoverageBadge({ coverage }: { coverage: Coverage }) {
  const c = COVERAGE[coverage];
  if (!c) return null;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.cls}`}>{c.label}</span>;
}

function Loss({ value }: { value: number | null }) {
  if (value === null || value >= 0) return null;
  return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Loss</span>;
}

/** `goodWhenUp` is false for costs, where an increase is bad news. */
function ChangeNote({ change, unit, goodWhenUp }: { change: Change | null; unit: "pct" | "pts"; goodWhenUp: boolean }) {
  if (!change) return <p className="text-[11px] leading-tight text-label2">No earlier period to compare</p>;
  if (unit === "pct" && change.pct === null) {
    return <p className="text-[11px] leading-tight text-label2">No earlier figure to compare</p>;
  }
  const value = unit === "pct" ? change.pct! : change.amount;
  const flat = Math.abs(value) < 0.05;
  const good = value > 0 === goodWhenUp;
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  return (
    <p className={`flex items-center gap-1 text-[11px] leading-tight font-semibold ${flat ? "text-label2" : good ? "text-green-600" : "text-red-600"}`}>
      {!flat && <Icon className="size-3" aria-hidden />}
      {value > 0 ? "+" : value < 0 ? "−" : ""}
      {Math.abs(value).toFixed(1)}
      {unit === "pct" ? "%" : " pts"} <span className="font-normal text-label2">vs previous</span>
    </p>
  );
}

function MetricCard({
  label,
  value,
  negative,
  change,
  unit = "pct",
  goodWhenUp = true,
  badge,
}: {
  label: string;
  value: string;
  negative?: boolean;
  change: Change | null;
  unit?: "pct" | "pts";
  goodWhenUp?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-separator bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[15px] text-label2">{label}</p>
        {badge}
      </div>
      <p className={`mt-1.5 text-[26px] leading-8 font-bold tracking-tight tabular-nums ${negative ? "text-red-600" : ""}`}>
        {value}
      </p>
      <div className="mt-1">
        <ChangeNote change={change} unit={unit} goodWhenUp={goodWhenUp} />
      </div>
    </div>
  );
}

export function ProfitabilityPanel({
  profit,
  preset,
  custom,
  today,
  scope,
}: {
  profit: ProfitInputs;
  preset: RangePreset;
  custom: { from: string; to: string };
  today: string;
  scope: Scope;
}) {
  const [group, setGroup] = useState<TrendGroup>("day");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [bakeDaysShown, setBakeDaysShown] = useState(BAKE_DAY_PAGE);

  const report = useMemo(
    () => buildProfitReport(profit.orders, profit.expenses, { preset, today, custom, group }),
    [profit, preset, today, custom, group],
  );
  const m = report.metrics;
  const prev = report.comparison?.previousMetrics ?? null;
  const cur = report.comparison?.currentMetrics ?? m;
  const selected = report.trend.find((p) => p.key === selectedKey) ?? null;

  const hasActivity = m.orders > 0 || m.operatingExpenses > 0 || report.expenseTotals.total > 0;

  function exportCsv() {
    const csv = buildProfitCsv(report, RANGE_LABELS[preset]);
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const { from, to } = report.range;
    const a = document.createElement("a");
    a.href = url;
    a.download = from && to ? `ilaos-profitability_${from}_to_${to}.csv` : "ilaos-profitability_all-time.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!hasActivity) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-separator bg-card px-6 py-12 text-center shadow-sm">
        <p className="text-[17px] font-semibold">No sales or expenses in this period</p>
        <p className="text-[15px] text-label2">
          Revenue, costs and profit are all ₱0.00. Try a different date range.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Notices report={report} hasCostHistory={profit.hasCostHistory} scope={scope} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5" aria-label="Financial summary">
        <MetricCard
          label="Total revenue"
          value={peso(m.revenue)}
          change={prev ? changeOf(cur.revenue, prev.revenue) : null}
        />
        <MetricCard
          label="Cost of goods sold"
          value={peso(m.cogs)}
          goodWhenUp={false}
          change={prev ? changeOf(cur.cogs, prev.cogs) : null}
          badge={<CoverageBadge coverage={m.coverage} />}
        />
        <MetricCard
          label="Gross profit"
          value={peso(m.grossProfit)}
          negative={(m.grossProfit ?? 0) < 0}
          change={prev ? changeOf(cur.grossProfit, prev.grossProfit) : null}
          badge={<Loss value={m.grossProfit} />}
        />
        <MetricCard
          label="Gross margin"
          value={percent(m.grossMargin)}
          negative={(m.grossMargin ?? 0) < 0}
          unit="pts"
          change={prev && cur.grossMargin !== null && prev.grossMargin !== null ? changeOf(cur.grossMargin, prev.grossMargin) : null}
        />
        <MetricCard
          label="Operating expenses"
          value={peso(m.operatingExpenses)}
          goodWhenUp={false}
          change={prev ? changeOf(cur.operatingExpenses, prev.operatingExpenses) : null}
        />
        <MetricCard
          label="Net operating profit"
          value={peso(m.netOperatingProfit)}
          negative={(m.netOperatingProfit ?? 0) < 0}
          change={prev ? changeOf(cur.netOperatingProfit, prev.netOperatingProfit) : null}
          badge={<Loss value={m.netOperatingProfit} />}
        />
        <MetricCard
          label="Operating margin"
          value={percent(m.operatingMargin)}
          negative={(m.operatingMargin ?? 0) < 0}
          unit="pts"
          change={prev && cur.operatingMargin !== null && prev.operatingMargin !== null ? changeOf(cur.operatingMargin, prev.operatingMargin) : null}
        />
        <MetricCard
          label="Capital expenses"
          value={peso(report.expenseTotals.capital)}
          goodWhenUp={false}
          change={null}
          badge={<span className="rounded-full bg-fill px-2 py-0.5 text-[11px] font-semibold text-label2">Not deducted</span>}
        />
      </section>

      {report.comparison && (
        <p className="-mt-2 px-1 text-[13px] text-label2">
          Compared with {formatRange(report.comparison.previous)}
        </p>
      )}

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-3 lg:items-start lg:gap-5">
        <Section className="lg:col-span-2" title="Revenue, cost and profit">
          <div className="p-4">
            <Segmented
              label="Group profit by"
              value={group}
              options={GROUPS.map((g) => ({ value: g, label: GROUP_LABELS[g] }))}
              onChange={(g) => {
                setGroup(g);
                setSelectedKey(null);
              }}
            />
            <div className="mt-3 min-h-[64px] rounded-xl bg-fill px-3.5 py-2.5" aria-live="polite">
              {selected ? (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-[15px] font-semibold">{selected.fullLabel}</p>
                    <p className={`text-[17px] font-bold tabular-nums ${tone(selected.netOperatingProfit)}`}>
                      {peso(selected.netOperatingProfit)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[13px] text-label2 tabular-nums">
                    Revenue {peso(selected.revenue)} · Cost {peso(selected.cogs)} · Expenses {peso(selected.operatingExpenses)}
                  </p>
                </>
              ) : (
                <p className="py-1.5 text-[15px] text-label2">Tap a period to see its profit.</p>
              )}
            </div>
            <div className="mt-3">
              <ProfitTrendChart points={report.trend} onSelect={setSelectedKey} />
            </div>
            <p className="mt-2 text-[13px] text-label2">
              Sales count on their bake date. Expenses count on the date they were paid.
            </p>
          </div>
        </Section>

        <Section title="Expenses by category">
          <ExpenseBreakdown report={report} />
        </Section>

        <Section
          className="lg:col-span-2"
          title="Products"
          aside={<span className="text-[13px] text-label2">gross profit</span>}
        >
          <ProductTable report={report} />
        </Section>

        <Section title="Most profitable">
          <MostProfitable report={report} />
        </Section>

        <Section
          className="lg:col-span-3"
          title="Bake dates"
          aside={<span className="text-[13px] text-label2">{report.bakeDays.length} total</span>}
        >
          <BakeDays report={report} shown={bakeDaysShown} onMore={() => setBakeDaysShown((n) => n + BAKE_DAY_PAGE * 3)} />
        </Section>
      </div>

      <button
        type="button"
        onClick={exportCsv}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80 lg:self-end lg:px-6"
      >
        <Download className="size-5" aria-hidden />
        Export profitability CSV
      </button>
    </div>
  );
}

function Notices({ report, hasCostHistory, scope }: { report: ProfitReport; hasCostHistory: boolean; scope: Scope }) {
  const m = report.metrics;
  const dates = report.uncostedBakeDates;
  return (
    <div className="flex flex-col gap-2">
      {m.coverage === "incomplete" && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[14px] text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <strong>Incomplete.</strong>{" "}
            {m.revenue > 0 && m.costedRevenue === 0
              ? "No cost data exists for the sales in this period, so gross profit and margins can't be calculated."
              : `${peso(m.uncostedRevenue)} of revenue has no cost data, so it is left out of gross profit and margins.`}{" "}
            Missing costs are never treated as zero.
            {!hasCostHistory && " Cost history starts when a cost is first recorded; earlier bake dates stay incomplete."}
            {dates.length > 0 && (
              <>
                {" "}
                Affected bake dates: {dates.slice(0, 5).map(formatBakeDate).join(", ")}
                {dates.length > 5 ? ` and ${dates.length - 5} more` : ""}.
              </>
            )}
          </p>
        </div>
      )}
      {m.coverage === "estimate" && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[14px] text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <strong>Estimate.</strong> Some costs in this period are estimates, not recorded costs.
          </p>
        </div>
      )}
      <div className="flex items-start gap-2 rounded-xl bg-fill p-3 text-[13px] text-label2">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          {PROFIT_NOTE} Water is counted in ingredient cost and as a utility expense, so both are kept.
          {(scope.archived > 0 || scope.duplicatesRemoved > 0) &&
            ` Left out of every figure: ${[
              scope.archived > 0 && `${scope.archived} archived order${scope.archived === 1 ? "" : "s"}`,
              scope.duplicatesRemoved > 0 && `${scope.duplicatesRemoved} repeated row${scope.duplicatesRemoved === 1 ? "" : "s"}`,
            ]
              .filter(Boolean)
              .join(" and ")}.`}
          {scope.conflictingInvoices > 0 &&
            ` ${scope.conflictingInvoices} invoice ID${scope.conflictingInvoices === 1 ? " is" : "s are"} shared by different orders; all were counted.`}
        </p>
      </div>
    </div>
  );
}

const TYPE_LABEL = { operating: "Deducted", material: "In cost of goods", capital: "Capital" } as const;

function ExpenseBreakdown({ report }: { report: ProfitReport }) {
  const rows = report.expenseBreakdown;
  const t = report.expenseTotals;
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-center text-[15px] text-label2">No expenses in this period.</p>;
  }
  return (
    <div>
      <ul>
        {rows.map((c) => (
          <li key={c.categoryId} className="border-b border-separator px-4 py-3 last:border-b-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[15px]">{c.name}</span>
              <span className="font-semibold tabular-nums">{peso(c.total)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fill">
              <div
                className={`h-full rounded-full ${c.type === "operating" ? "bg-brand" : "bg-label2/50"}`}
                style={{ width: `${Math.max(2, Math.round(c.share * 100))}%` }}
              />
            </div>
            <p className="mt-1 text-[13px] text-label2">
              {TYPE_LABEL[c.type]} · {c.count} entr{c.count === 1 ? "y" : "ies"}
            </p>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-3 gap-2 border-t border-separator bg-fill/50 px-4 py-3 text-[13px]">
        <div>
          <dt className="text-label2">Deducted</dt>
          <dd className="font-semibold tabular-nums">{peso(t.operating)}</dd>
        </div>
        <div>
          <dt className="text-label2">In cost of goods</dt>
          <dd className="font-semibold tabular-nums">{peso(t.material)}</dd>
        </div>
        <div>
          <dt className="text-label2">Capital</dt>
          <dd className="font-semibold tabular-nums">{peso(t.capital)}</dd>
        </div>
      </dl>
    </div>
  );
}

function ProductTable({ report }: { report: ProfitReport }) {
  const rows = report.products;
  return (
    <>
      <table className="hidden w-full text-left text-[15px] lg:table">
        <thead className="border-b border-separator text-[13px] text-label2">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Product</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Units</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Revenue</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Cost</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Gross profit</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Margin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.product} className="border-b border-separator last:border-b-0">
              <td className="px-4 py-2.5">
                <span className="flex items-center gap-2">
                  {p.label} <CoverageBadge coverage={p.coverage} />
                </span>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{p.units}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{peso(p.revenue)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{p.grossProfit === null ? "—" : peso(p.cogs)}</td>
              <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${tone(p.grossProfit)}`}>{peso(p.grossProfit)}</td>
              <td className={`px-4 py-2.5 text-right tabular-nums ${tone(p.grossMargin)}`}>{percent(p.grossMargin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="lg:hidden">
        {rows.map((p) => (
          <li key={p.product} className="border-b border-separator px-4 py-3 last:border-b-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-[17px]">
                <span className="truncate">{p.label}</span>
                <CoverageBadge coverage={p.coverage} />
              </span>
              <span className={`font-semibold tabular-nums ${tone(p.grossProfit)}`}>{peso(p.grossProfit)}</span>
            </div>
            <p className="mt-0.5 text-[13px] text-label2 tabular-nums">
              {p.units} sold · revenue {peso(p.revenue)} · margin {percent(p.grossMargin)}
            </p>
          </li>
        ))}
      </ul>
      <p className="border-t border-separator px-4 py-3 text-[13px] text-label2">
        Gross profit only. Operating expenses are not shared out to products.
      </p>
    </>
  );
}

function MostProfitable({ report }: { report: ProfitReport }) {
  const ranked = report.products.filter((p) => p.grossProfit !== null).slice(0, 5);
  if (ranked.length === 0) {
    return <p className="px-4 py-6 text-center text-[15px] text-label2">No products with cost data yet.</p>;
  }
  const top = Math.max(...ranked.map((p) => Math.abs(p.grossProfit ?? 0)), 1);
  return (
    <ol className="px-4 py-2">
      {ranked.map((p, i) => (
        <li key={p.product} className="py-2">
          <div className="flex items-baseline justify-between gap-3 text-[15px]">
            <span className="min-w-0 truncate">
              <span className="mr-2 text-label2 tabular-nums">{i + 1}</span>
              {p.label}
            </span>
            <span className={`font-semibold tabular-nums ${tone(p.grossProfit)}`}>{peso(p.grossProfit)}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fill">
            <div
              className={`h-full rounded-full ${(p.grossProfit ?? 0) < 0 ? "bg-red-500" : "bg-brand"}`}
              style={{ width: `${Math.max(2, Math.round((Math.abs(p.grossProfit ?? 0) / top) * 100))}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function BakeDays({ report, shown, onMore }: { report: ProfitReport; shown: number; onMore: () => void }) {
  const rows = report.bakeDays.slice(0, shown);
  if (report.bakeDays.length === 0) {
    return <p className="px-4 py-6 text-center text-[15px] text-label2">No bake days with sales in this period.</p>;
  }
  return (
    <>
      <table className="hidden w-full text-left text-[15px] lg:table">
        <thead className="border-b border-separator text-[13px] text-label2">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Bake date</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Orders</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Revenue</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Cost</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Gross profit</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Margin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.date} className="border-b border-separator last:border-b-0 hover:bg-fill">
              <td className="px-4 py-2.5">
                <span className="flex items-center gap-2">
                  <Link href={`/admin/orders?bakeDate=${d.date}`} className="text-brand hover:underline">
                    {formatBakeDate(d.date)}
                  </Link>
                  <CoverageBadge coverage={d.coverage} />
                </span>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{d.orders}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{peso(d.revenue)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{d.grossProfit === null ? "—" : peso(d.cogs)}</td>
              <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${tone(d.grossProfit)}`}>{peso(d.grossProfit)}</td>
              <td className={`px-4 py-2.5 text-right tabular-nums ${tone(d.grossMargin)}`}>{percent(d.grossMargin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="lg:hidden">
        {rows.map((d) => (
          <li key={d.date} className="border-b border-separator last:border-b-0">
            <Link href={`/admin/orders?bakeDate=${d.date}`} className="block px-4 py-3 transition-colors active:bg-fill">
              <span className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-[17px]">
                  {formatBakeDate(d.date)} <CoverageBadge coverage={d.coverage} />
                </span>
                <span className={`font-semibold tabular-nums ${tone(d.grossProfit)}`}>{peso(d.grossProfit)}</span>
              </span>
              <span className="block text-[13px] text-label2 tabular-nums">
                {d.orders} order{d.orders === 1 ? "" : "s"} · revenue {peso(d.revenue)} · cost {d.grossProfit === null ? "—" : peso(d.cogs)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {report.bakeDays.length > shown && (
        <button type="button" onClick={onMore} className="min-h-11 w-full border-t border-separator text-[17px] text-brand transition active:bg-fill">
          Show more
        </button>
      )}
      <p className="border-t border-separator px-4 py-3 text-[13px] text-label2">
        Expenses are not tied to bake dates, so they appear in the period totals above, not per bake date.
      </p>
    </>
  );
}
