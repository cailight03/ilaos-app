"use client";

import { useEffect, useRef } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProfitTrendPoint } from "@/src/lib/profitability";
import { knownProducts } from "@/src/lib/product-registry";
import type { ProductPerformance, ProductSort, TrendPoint } from "@/src/lib/sales-report";

// Axis labels and grid lines follow the light/dark theme through Tailwind's token classes.
const THEME =
  "[&_.recharts-cartesian-axis-tick-value]:fill-label2 [&_.recharts-cartesian-grid_line]:stroke-separator [&_svg]:outline-none [&_*]:outline-none";

const PRODUCT_COLORS = ["#007aff", "#ff9500", "#34c759", "#af52de", "#ff2d55"];
const OTHER_COLOR = "#8e8e93";

export const productColor = (product: string) => {
  const i = knownProducts().indexOf(product);
  return i === -1 ? OTHER_COLOR : PRODUCT_COLORS[i % PRODUCT_COLORS.length];
};

export function compactPeso(n: number): string {
  if (n >= 1_000_000) return `₱${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₱${+(n / 1_000).toFixed(1)}k`;
  return `₱${Math.round(n)}`;
}

const BAR_SLOT = 34; // px per bar; the chart scrolls sideways when there are many

export function TrendChart({
  points,
  selectedKey,
  onSelect,
}: {
  points: TrendPoint[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  // Newest data is on the right, so open scrolled to it.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [points]);

  return (
    <div ref={scroller} className="-mx-1 overflow-x-auto overscroll-x-contain">
      <div style={{ minWidth: points.length * BAR_SLOT + 48 }} className={THEME}>
        <ResponsiveContainer width="100%" height={220} initialDimension={{ width: 320, height: 220 }}>
          <BarChart
            data={points}
            margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
            onClick={(state) => {
              const i = Number(state?.activeTooltipIndex);
              if (Number.isInteger(i) && points[i]) onSelect(points[i].key);
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} fontSize={11} />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tickFormatter={compactPeso}
              fontSize={11}
              allowDecimals={false}
            />
            <Tooltip content={() => null} cursor={{ className: "fill-fill" }} />
            <Bar dataKey="sales" radius={[5, 5, 0, 0]} maxBarSize={28} isAnimationActive={false}>
              {points.map((p) => (
                <Cell
                  key={p.key}
                  className="fill-brand"
                  fillOpacity={selectedKey === null || selectedKey === p.key ? 1 : 0.35}
                  onClick={() => onSelect(p.key)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ProfitTrendChart({
  points,
  onSelect,
}: {
  points: ProfitTrendPoint[];
  onSelect: (key: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [points]);

  // Unknown profit (no cost data) is left out of the line instead of being drawn as zero.
  const data = points.map((p) => ({ ...p, profit: p.netOperatingProfit }));

  return (
    <div ref={scroller} className="-mx-1 overflow-x-auto overscroll-x-contain">
      <div style={{ minWidth: points.length * BAR_SLOT * 1.6 + 48 }} className={THEME}>
        <ResponsiveContainer width="100%" height={240} initialDimension={{ width: 320, height: 240 }}>
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
            onClick={(state) => {
              const i = Number(state?.activeTooltipIndex);
              if (Number.isInteger(i) && points[i]) onSelect(points[i].key);
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} fontSize={11} />
            <YAxis width={48} tickLine={false} axisLine={false} tickFormatter={compactPeso} fontSize={11} />
            <Tooltip content={() => null} cursor={{ className: "fill-fill" }} />
            <ReferenceLine y={0} className="stroke-separator" />
            <Bar dataKey="revenue" fill="#007aff" radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
            <Bar dataKey="cogs" fill="#ff9500" radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
            <Bar dataKey="operatingExpenses" fill="#af52de" radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
            <Line
              dataKey="profit"
              stroke="#34c759"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[13px] text-label2">
        {[
          ["#007aff", "Revenue"],
          ["#ff9500", "Cost of goods"],
          ["#af52de", "Operating expenses"],
          ["#34c759", "Net operating profit"],
        ].map(([color, label]) => (
          <li key={label} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProductBarChart({
  products,
  metric,
}: {
  products: ProductPerformance[];
  metric: ProductSort;
}) {
  const data = products.map((p) => ({
    ...p,
    value: metric === "quantity" ? p.quantity : p.revenue,
  }));
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className={THEME} role="img" aria-label="Best-selling products">
      <ResponsiveContainer width="100%" height={data.length * 44 + 8} initialDimension={{ width: 320, height: 240 }}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }}>
          <XAxis type="number" hide domain={[0, max]} />
          <YAxis
            type="category"
            dataKey="label"
            width={112}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            interval={0}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.product} fill={productColor(d.product)} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              className="fill-foreground"
              fontSize={12}
              formatter={(v) => (metric === "quantity" ? String(v) : compactPeso(Number(v)))}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RevenueDonut({
  products,
  selected,
  onSelect,
  centerLabel,
  centerValue,
}: {
  products: ProductPerformance[];
  selected: string | null;
  onSelect: (product: string | null) => void;
  centerLabel: string;
  centerValue: string;
}) {
  const data = products.filter((p) => p.revenue > 0);

  return (
    <div className="relative mx-auto h-[220px] w-full max-w-[260px]" role="img" aria-label="Revenue by product">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 240, height: 220 }}>
        <PieChart>
          <Pie
            data={data}
            dataKey="revenue"
            nameKey="label"
            innerRadius={68}
            outerRadius={100}
            paddingAngle={data.length > 1 ? 2 : 0}
            stroke="none"
            isAnimationActive={false}
            onClick={(_, i) => onSelect(data[i]?.product === selected ? null : (data[i]?.product ?? null))}
          >
            {data.map((p) => (
              <Cell
                key={p.product}
                fill={productColor(p.product)}
                fillOpacity={selected === null || selected === p.product ? 1 : 0.3}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="max-w-[110px] truncate text-[13px] text-label2">{centerLabel}</span>
        <span className="text-[22px] font-bold tracking-tight tabular-nums">{centerValue}</span>
      </div>
    </div>
  );
}
