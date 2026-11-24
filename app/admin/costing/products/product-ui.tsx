import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import type { ProductCost } from "@/src/lib/product-cost";

export const fieldClass =
  "h-11 w-full min-w-0 rounded-xl border border-separator bg-card px-3.5 text-[17px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";

export const formatMargin = (pct: number | null) =>
  pct === null ? "—" : `${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 }).format(pct)}%`;

/** Complete, needs attention (blocking gaps), or complete with archived-ingredient warnings. */
export function StatusBadge({ product }: { product: ProductCost }) {
  const { complete, issueCount, warningCount } = product;
  const text = !complete
    ? `${issueCount} missing`
    : warningCount > 0
      ? `${warningCount} warning${warningCount === 1 ? "" : "s"}`
      : "Complete";
  const tone = !complete ? "bg-red-600/10 text-red-600" : warningCount > 0 ? "bg-orange-500/15 text-orange-600" : "bg-brand-tint text-brand";
  return <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-medium whitespace-nowrap ${tone}`}>{text}</span>;
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[15px] font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-600/10 p-3 text-[15px] text-red-600">
      <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      {children}
    </div>
  );
}
