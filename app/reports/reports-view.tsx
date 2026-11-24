"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  CalendarClock,
  ChevronRight,
  Download,
  Minus,
  Package,
  Receipt,
  ShoppingBag,
  UserCheck,
  Users,
  UserPlus,
  Repeat,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { formatBakeDate, formatPeso } from "@/src/lib/order-view";
import {
  GROUP_LABELS,
  RANGE_LABELS,
  buildReportCsv,
  buildSalesReport,
  formatRange,
  resolveRange,
  sortProducts,
  type ProductSort,
  type RangePreset,
  type ReportOrder,
  type TrendGroup,
} from "@/src/lib/sales-report";
import { DatePicker } from "../_components/date-picker";
import { PageHeader } from "../_components/page-header";
import { RefreshButton } from "../_components/controls";
import { StatCard } from "../_components/stat-card";
import { ProductBarChart, RevenueDonut, TrendChart, compactPeso, productColor } from "./charts";

const PRESETS: RangePreset[] = ["week", "month", "lastMonth", "year", "all", "custom"];
const GROUPS: TrendGroup[] = ["day", "week", "month", "year"];
const BAKE_DAY_PAGE = 8;

const pct = (n: number) => `${n.toFixed(1)}%`;
const signedPct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
const nf = new Intl.NumberFormat("en-PH");

export function ReportsView({ orders, today }: { orders: ReportOrder[]; today: string }) {
  const [preset, setPreset] = useState<RangePreset>("month");
  const [custom, setCustom] = useState({ from: `${today.slice(0, 8)}01`, to: today });
  const [group, setGroup] = useState<TrendGroup>("day");
  const [sort, setSort] = useState<ProductSort>("revenue");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [bakeDaysShown, setBakeDaysShown] = useState(BAKE_DAY_PAGE);

  const report = useMemo(
    () => buildSalesReport(orders, { preset, today, custom, group }),
    [orders, preset, today, custom, group],
  );
  const products = useMemo(() => sortProducts(report.products, sort), [report.products, sort]);

  const { summary } = report;
  const selectedPoint = report.trend.find((p) => p.key === selectedKey) ?? null;
  const donutProduct = products.find((p) => p.product === selectedProduct) ?? null;
  const productDifference = summary.totalSales - report.productRevenueTotal;

  function pickPreset(next: RangePreset) {
    if (next === "custom" && preset !== "custom") {
      // Start from whatever range is on screen so switching to Custom isn't a jump.
      const { range } = resolveRange(preset, today);
      if (range.from && range.to) setCustom({ from: range.from, to: range.to });
    }
    setPreset(next);
    setSelectedKey(null);
    setSelectedProduct(null);
    setBakeDaysShown(BAKE_DAY_PAGE);
  }

  function exportCsv() {
    const csv = buildReportCsv(report, RANGE_LABELS[preset], sort);
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const { from, to } = report.range;
    const a = document.createElement("a");
    a.href = url;
    a.download = from && to ? `ilaos-sales-report_${from}_to_${to}.csv` : "ilaos-sales-report_all-time.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const isEmpty = summary.totalOrders === 0;

  return (
    <div className="flex animate-ios-in flex-col gap-5">
      <PageHeader title="Sales Report" subtitle="Ilao's Microbakery">
        <RefreshButton />
      </PageHeader>

      <section aria-label="Date range" className="-mt-1 flex flex-col gap-3">
        <div
          role="group"
          aria-label="Date range"
          className="-mx-4 -my-1 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={preset === p}
              onClick={() => pickPreset(p)}
              className={`h-9 shrink-0 rounded-full px-4 text-[15px] font-medium transition active:scale-95 ${
                preset === p ? "bg-brand text-white" : "bg-card text-foreground shadow-sm ring-1 ring-separator"
              }`}
            >
              {p === "custom" ? "Custom range" : RANGE_LABELS[p]}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex flex-col gap-2">
            <DatePicker
              label="From"
              value={custom.from}
              onChange={(from) => setCustom((c) => ({ from, to: from > c.to ? from : c.to }))}
            />
            <DatePicker
              label="To"
              value={custom.to}
              onChange={(to) => setCustom((c) => ({ from: to < c.from ? to : c.from, to }))}
            />
          </div>
        )}

        <p className="px-1 text-[13px] text-label2">
          Bake dates: {formatRange(report.range)}
          {report.skippedOrders > 0 && (
            <>
              {" "}
              · {report.skippedOrders} order{report.skippedOrders === 1 ? "" : "s"} without a valid bake date left
              out
            </>
          )}
        </p>
      </section>

      {isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-separator bg-card px-6 py-12 text-center shadow-sm">
          <span className="flex size-12 items-center justify-center rounded-full bg-fill text-label2">
            <BarChart3 className="size-6" aria-hidden />
          </span>
          <p className="text-[17px] font-semibold">No orders in this period</p>
          <p className="text-[15px] text-label2">
            {preset === "all" ? "Orders will show up here once they're in the sheet." : "Try a different date range."}
          </p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3" aria-label="Summary">
            <StatCard label="Total sales" value={formatPeso(summary.totalSales)} Icon={BadgeDollarSign} />
            <StatCard label="Total orders" value={nf.format(summary.totalOrders)} Icon={Receipt} />
            <StatCard label="Products sold" value={nf.format(summary.totalProducts)} Icon={Package} />
            <StatCard
              label="Avg. order value"
              value={summary.averageOrderValue === null ? "—" : formatPeso(summary.averageOrderValue)}
              Icon={ShoppingBag}
            />
            <StatCard
              label={`Avg. per bake day (${summary.bakeDays})`}
              value={summary.averageSalesPerBakeDay === null ? "—" : formatPeso(summary.averageSalesPerBakeDay)}
              Icon={CalendarClock}
            />
            <GrowthCard growth={report.growth} comparison={report.comparison} />
          </section>

          <Section
            title="Sales trend"
            aside={
              report.growth !== null && (
                <span className="text-[13px] text-label2">
                  <Delta value={report.growth} /> vs previous period
                </span>
              )
            }
          >
            <div className="p-4">
              <Segmented
                label="Group sales by"
                value={group}
                options={GROUPS.map((g) => ({ value: g, label: GROUP_LABELS[g] }))}
                onChange={(g) => {
                  setGroup(g);
                  setSelectedKey(null);
                }}
              />
              <div className="mt-3 min-h-[64px] rounded-xl bg-fill px-3.5 py-2.5" aria-live="polite">
                {selectedPoint ? (
                  <>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-[15px] font-semibold">{selectedPoint.fullLabel}</p>
                      <p className="text-[17px] font-bold tabular-nums">{formatPeso(selectedPoint.sales)}</p>
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-label2">
                      <span>
                        {selectedPoint.orders} order{selectedPoint.orders === 1 ? "" : "s"} · {selectedPoint.products}{" "}
                        product{selectedPoint.products === 1 ? "" : "s"}
                      </span>
                      {selectedPoint.change !== null && (
                        <span>
                          <Delta value={selectedPoint.change} /> vs previous {GROUP_LABELS[group].toLowerCase()}
                        </span>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="py-1.5 text-[15px] text-label2">Tap a bar to see its sales.</p>
                )}
              </div>
              <div className="mt-3">
                <TrendChart points={report.trend} selectedKey={selectedKey} onSelect={setSelectedKey} />
              </div>
            </div>
          </Section>

          <Section
            title="Product performance"
            aside={
              <span className="text-[13px] text-label2">{nf.format(summary.totalProducts)} sold</span>
            }
          >
            <div className="border-b border-separator p-4">
              <Segmented
                label="Sort products by"
                value={sort}
                options={[
                  { value: "revenue", label: "Revenue" },
                  { value: "quantity", label: "Quantity sold" },
                ]}
                onChange={setSort}
              />
            </div>
            <ul>
              {products.map((p) => (
                <li key={p.product} className="border-b border-separator px-4 py-3 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-[17px]">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: productColor(p.product) }}
                      />
                      <span className="truncate">{p.label}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{formatPeso(p.revenue)}</span>
                  </div>
                  <p className="mt-0.5 pl-[18px] text-[13px] text-label2 tabular-nums">
                    {nf.format(p.quantity)} sold · {pct(p.revenueShare)} of revenue · {pct(p.unitShare)} of units
                  </p>
                </li>
              ))}
            </ul>
            {Math.abs(productDifference) >= 1 && (
              <p className="border-t border-separator px-4 py-3 text-[13px] text-label2">
                Product revenue uses the price recorded on each order, before discounts. It totals{" "}
                {formatPeso(report.productRevenueTotal)}, which is {formatPeso(Math.abs(productDifference))}{" "}
                {productDifference < 0 ? "more" : "less"} than total sales.
              </p>
            )}
          </Section>

          <Section title="Best sellers" aside={<span className="text-[13px] text-label2">by {sort === "quantity" ? "units" : "revenue"}</span>}>
            <div className="px-4 py-4">
              <ProductBarChart products={products} metric={sort} />
            </div>
          </Section>

          <Section title="Revenue distribution">
            <div className="px-4 py-4">
              <RevenueDonut
                products={products}
                selected={selectedProduct}
                onSelect={setSelectedProduct}
                centerLabel={donutProduct ? donutProduct.label : "Product revenue"}
                centerValue={donutProduct ? pct(donutProduct.revenueShare) : compactPeso(report.productRevenueTotal)}
              />
              <ul className="mt-2 flex flex-col">
                {products
                  .filter((p) => p.revenue > 0)
                  .map((p) => (
                    <li key={p.product}>
                      <button
                        type="button"
                        aria-pressed={selectedProduct === p.product}
                        onClick={() => setSelectedProduct((s) => (s === p.product ? null : p.product))}
                        className="flex min-h-11 w-full items-center gap-2 rounded-lg px-1 text-left text-[15px] transition active:bg-fill"
                      >
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: productColor(p.product) }}
                        />
                        <span className="min-w-0 flex-1 truncate">{p.label}</span>
                        <span className="text-label2 tabular-nums">{pct(p.revenueShare)}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          </Section>

          <Section
            title="Bake days"
            aside={<span className="text-[13px] text-label2">{report.bakeDays.length} total</span>}
          >
            <ul>
              {report.bakeDays.slice(0, bakeDaysShown).map((d) => (
                <li key={d.date} className="border-b border-separator last:border-b-0">
                  <Link
                    href={`/orders?bakeDate=${d.date}`}
                    className="flex min-h-14 items-center gap-3 py-2.5 pr-3 pl-4 transition-colors active:bg-fill"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px]">{formatBakeDate(d.date)}</span>
                      <span className="block truncate text-[13px] text-label2 tabular-nums">
                        {d.orders} order{d.orders === 1 ? "" : "s"} · {d.products} product{d.products === 1 ? "" : "s"}{" "}
                        · avg {formatPeso(d.averageOrderValue)}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{formatPeso(d.sales)}</span>
                    <ChevronRight className="size-[18px] shrink-0 text-label2/70" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            {report.bakeDays.length > bakeDaysShown && (
              <button
                type="button"
                onClick={() => setBakeDaysShown((n) => n + BAKE_DAY_PAGE * 3)}
                className="min-h-11 w-full border-t border-separator text-[17px] text-brand transition active:bg-fill"
              >
                Show more
              </button>
            )}
          </Section>

          <Section title="Customer insights">
            {report.customers ? (
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <Mini Icon={Users} label="Unique customers" value={nf.format(report.customers.uniqueCustomers)} />
                  <Mini Icon={UserPlus} label="New customers" value={nf.format(report.customers.newCustomers)} />
                  <Mini
                    Icon={UserCheck}
                    label="Returning customers"
                    value={nf.format(report.customers.returningCustomers)}
                  />
                  <Mini
                    Icon={Repeat}
                    label="Repeat rate"
                    value={report.customers.repeatRate === null ? "—" : pct(report.customers.repeatRate)}
                  />
                </div>
                <p className="mt-3 text-[13px] text-label2">
                  Customers are matched by email, or by mobile number when there is no email, never by name. New
                  means their first order is in this period; repeat means they ordered on two or more bake days.
                  {report.customers.unidentifiedOrders > 0 &&
                    ` ${report.customers.unidentifiedOrders} order${
                      report.customers.unidentifiedOrders === 1 ? "" : "s"
                    } had no usable email or mobile and aren't counted.`}
                </p>
              </div>
            ) : (
              <p className="px-4 py-6 text-center text-[15px] text-label2">
                Not enough reliable customer details in this period to show insights.
              </p>
            )}
          </Section>

          <button
            type="button"
            onClick={exportCsv}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80"
          >
            <Download className="size-5" aria-hidden />
            Export CSV
          </button>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-1.5 flex items-baseline justify-between px-4">
        <h2 className="text-[13px] text-label2 uppercase">{title}</h2>
        {aside}
      </div>
      <div className="overflow-hidden rounded-xl border border-separator bg-card shadow-sm">{children}</div>
    </section>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-[9px] bg-fill p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-8 flex-1 rounded-[7px] px-2 text-[13px] font-medium transition ${
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-label2"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Delta({ value }: { value: number }) {
  const up = value > 0;
  const flat = value === 0;
  return (
    <span className={`font-semibold ${flat ? "text-label2" : up ? "text-green-600" : "text-red-600"}`}>
      {signedPct(value)}
    </span>
  );
}

function GrowthCard({
  growth,
  comparison,
}: {
  growth: number | null;
  comparison: { previous: { from: string | null; to: string | null }; previousSales: number } | null;
}) {
  const Icon: LucideIcon = growth === null || growth === 0 ? Minus : growth > 0 ? ArrowUpRight : ArrowDownRight;
  const tone = growth === null || growth === 0 ? "text-label2" : growth > 0 ? "text-green-600" : "text-red-600";
  const note = !comparison
    ? "No earlier period to compare"
    : comparison.previousSales <= 0
      ? "No sales in the earlier period"
      : `vs ${formatRange(comparison.previous)}`;

  return (
    <div className="rounded-xl border border-separator bg-card p-4 shadow-sm">
      <span className={`flex size-8 items-center justify-center rounded-lg bg-fill ${tone}`}>
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <p className={`mt-3 text-[28px] leading-8 font-bold tracking-tight tabular-nums ${tone}`}>
        {growth === null ? "—" : signedPct(growth)}
      </p>
      <p className="mt-0.5 text-[15px] text-label2">Sales growth</p>
      <p className="text-[11px] leading-tight text-label2">{note}</p>
    </div>
  );
}

function Mini({ Icon, label, value }: { Icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-fill p-3">
      <Icon className="size-[18px] text-brand" aria-hidden />
      <p className="mt-2 text-[22px] leading-7 font-bold tracking-tight tabular-nums">{value}</p>
      <p className="text-[13px] text-label2">{label}</p>
    </div>
  );
}
