"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { formatPeso } from "@/src/lib/store/products";
import { removeLine, setLineQty } from "@/src/lib/store/bag";
import { PICKUP_WINDOW } from "@/src/lib/checkout/config";
import { BakeryImage } from "@/src/components/store/bakery-image";
import { QuantityStepper } from "@/src/components/store/quantity-stepper";
import { Card, ScheduleCard } from "./cards";
import { CouponBox } from "./coupon-box";
import { PrimaryButton, StickyAction } from "./sticky-action";
import { PageSkeleton, useCheckoutPage } from "./use-checkout-page";

export function BagPage() {
  const router = useRouter();
  const { ready, lines, count, total, subtotal, discount, coupon, bakeDate } = useCheckoutPage(false);

  if (!ready || !bakeDate) return <PageSkeleton />;

  if (lines.length === 0) {
    return (
      <div className="flex animate-ios-in flex-col items-center px-8 py-20 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-chip">
          <ShoppingBag className="size-7 text-ink-muted" strokeWidth={1.5} />
        </div>
        <p className="mt-4 text-lg font-bold">Your bag is empty</p>
        <p className="mt-1 text-base text-ink-muted">Add some fresh bakes for this Sunday.</p>
        <Link
          href="/"
          className="mt-6 rounded-full bg-royal px-7 py-3 text-base font-semibold text-white transition active:scale-95"
        >
          Browse bakes
        </Link>
      </div>
    );
  }

  return (
    <>
    <div className="animate-ios-in lg:grid lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-6">
      <Card className="!p-0">
        <ul className="divide-y divide-ink/10 px-4 sm:px-5">
          {lines.map((l) => (
            <li key={l.key} className="flex gap-3 py-4">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-chip sm:size-24">
                <BakeryImage src={l.product.image} alt={l.product.name} sizes="96px" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold leading-tight">{l.product.name}</p>
                    {l.optionLabel && <p className="text-sm text-ink-muted">{l.optionLabel}</p>}
                    <p className="text-sm text-ink-muted">{formatPeso(l.unitPrice)} each</p>
                  </div>
                  <p className="font-bold tabular-nums" aria-label={`Subtotal ${formatPeso(l.lineTotal)}`}>
                    {formatPeso(l.lineTotal)}
                  </p>
                </div>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <QuantityStepper
                    value={l.qty}
                    label={l.product.name}
                    onChange={(n) => setLineQty(l.key, n)}
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(l.key)}
                    className="rounded-full px-3 py-2 text-sm font-medium text-red-600 transition active:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-4 space-y-4 lg:mt-0">
        <ScheduleCard bakeDate={bakeDate} pickupWindow={PICKUP_WINDOW} />
        <CouponBox subtotal={subtotal} discount={discount} coupon={coupon} />
        <Link          href="/"
          className="block rounded-full bg-chip py-3 text-center text-base font-semibold transition active:scale-[0.98]"
        >
          Continue shopping
        </Link>
      </div>

    </div>
      <StickyAction label={`Total · ${count} ${count === 1 ? "item" : "items"}`} total={formatPeso(total)}>
        <PrimaryButton onClick={() => router.push("/checkout/details")}>
          Continue to Checkout
        </PrimaryButton>
      </StickyAction>
    </>
  );
}
