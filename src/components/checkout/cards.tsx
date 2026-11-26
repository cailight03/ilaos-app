import type { ReactNode } from "react";
import { CalendarDays, Clock, FlaskConical } from "lucide-react";
import { formatPeso } from "@/src/lib/store/products";
import { formatBakeDate } from "@/src/lib/checkout/config";
import type { OrderLineSnapshot } from "@/src/lib/checkout/order";
import { BakeryImage } from "@/src/components/store/bakery-image";

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-white p-4 ring-1 ring-ink/[0.06] sm:p-5 ${className}`}>
      {title && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export function ScheduleCard({ bakeDate, pickupWindow }: { bakeDate: Date; pickupWindow: string }) {
  return (
    <Card title="Bake date & pickup">
      <dl className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-royal/10 text-royal">
            <CalendarDays className="size-5" />
          </span>
          <div>
            <dt className="text-sm text-ink-muted">Scheduled bake date</dt>
            <dd className="font-semibold">{formatBakeDate(bakeDate)}</dd>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-royal/10 text-royal">
            <Clock className="size-5" />
          </span>
          <div>
            <dt className="text-sm text-ink-muted">Pickup time</dt>
            <dd className="font-semibold">{pickupWindow}</dd>
          </div>
        </div>
      </dl>
    </Card>
  );
}

export function OrderSummary({
  lines,
  total,
  subtotal = total,
  discount = 0,
  couponCode,
  title = "Order summary",
}: {
  lines: OrderLineSnapshot[];
  /** Amount payable after any discount. */
  total: number;
  subtotal?: number;
  discount?: number;
  couponCode?: string | null;
  title?: string;
}) {
  return (
    <Card title={title}>
      <ul className="divide-y divide-ink/10">
        {lines.map((l, i) => (
          <li key={i} className="flex items-center gap-3 py-3 first:pt-0">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-chip">
              <BakeryImage src={l.image} alt={l.name} sizes="56px" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight">{l.name}</p>
              <p className="text-sm text-ink-muted">
                {[l.optionLabel, `Qty ${l.qty}`].filter(Boolean).join(" · ")}
              </p>
            </div>
            <p className="font-semibold tabular-nums">{formatPeso(l.lineTotal)}</p>
          </li>
        ))}
      </ul>
      {discount > 0 && (
        <dl className="space-y-1 border-t border-ink/10 pt-3 text-base">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd className="tabular-nums">{formatPeso(subtotal)}</dd>
          </div>
          <div className="flex justify-between text-green-700">
            <dt>Coupon{couponCode ? ` (${couponCode})` : ""}</dt>
            <dd className="tabular-nums">−{formatPeso(discount)}</dd>
          </div>
        </dl>
      )}
      <div className={`mt-1 flex items-center justify-between text-lg ${discount > 0 ? "pt-2" : "border-t border-ink/10 pt-3"}`}>
        <span className="font-semibold">Total</span>
        <span className="font-bold tabular-nums">{formatPeso(total)}</span>
      </div>
    </Card>
  );
}

/** Makes clear that no real order is created while submissions are mocked. */
export function SimulationNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="note"
      className="flex gap-3 rounded-2xl bg-amber-100/70 p-4 text-sm text-amber-950 ring-1 ring-amber-300/60"
    >
      <FlaskConical className="mt-0.5 size-5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
