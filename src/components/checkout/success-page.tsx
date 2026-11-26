"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Hourglass, Mail } from "lucide-react";
import { clearBag } from "@/src/lib/store/bag";
import { formatBakeDate } from "@/src/lib/checkout/config";
import { parseIsoDate } from "@/src/lib/checkout/order";
import { resetAfterOrder, useCheckout, useHydrated } from "@/src/lib/checkout/state";
import { Card, OrderSummary, SimulationNotice } from "./cards";
import { PageSkeleton } from "./use-checkout-page";

export function SuccessPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { placedOrder } = useCheckout();

  useEffect(() => {
    if (!hydrated) return;
    if (!placedOrder) router.replace("/checkout/bag");
    else {
      // The order is safely stored; empty the bag and drop the entered form data.
      clearBag();
      resetAfterOrder(placedOrder);
    }
  }, [hydrated, placedOrder, router]);

  if (!hydrated || !placedOrder) return <PageSkeleton />;

  return (
    <div className="mx-auto max-w-2xl animate-ios-in space-y-4">
      <div className="flex flex-col items-center py-4 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-royal text-white">
          <Check className="size-10" strokeWidth={3} />
        </span>
        <h2 className="mt-4 text-2xl font-bold">Order submitted</h2>
        <p className="mt-1 text-ink-muted">Thank you, {placedOrder.customer.fullName.split(" ")[0]}!</p>
      </div>

      {placedOrder.simulated && (
        <SimulationNotice>
          <p className="font-semibold">Simulated order</p>
          <p>This was a demo submission. No order was placed with the bakery and no email will be sent.</p>
        </SimulationNotice>
      )}

      <Card>
        <dl className="divide-y divide-ink/10">
          <Row label="Order reference">
            <span className="font-bold tabular-nums">{placedOrder.reference}</span>
          </Row>
          <Row label="Name">{placedOrder.customer.fullName}</Row>
          <Row label="Bake date">{formatBakeDate(parseIsoDate(placedOrder.bakeDate))}</Row>
          <Row label="Pickup time">{placedOrder.pickupWindow}</Row>
          <Row label="Status">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
              <Hourglass className="size-4" />
              Pending payment verification
            </span>
          </Row>
        </dl>
      </Card>

      <OrderSummary
        lines={placedOrder.lines}
        total={placedOrder.total}
        subtotal={placedOrder.subtotal}
        discount={placedOrder.discount}
        couponCode={placedOrder.couponCode}
      />

      <div className="flex gap-3 rounded-2xl bg-royal/10 p-4 text-sm">
        <Mail className="mt-0.5 size-5 shrink-0 text-royal" />
        <p>
          Your order isn’t confirmed yet. We’ll email <span className="font-semibold">{placedOrder.customer.email}</span>{" "}
          once the bakery has verified your payment. When your order is ready, you’re welcome to pick it up yourself or book a Lalamove rider to collect it.
        </p>
      </div>

      <div className="pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <Link
          href="/"
          className="block rounded-full bg-royal py-4 text-center text-lg font-semibold text-white transition hover:bg-royal-dark active:scale-[0.98]"
        >
          Return to Homepage
        </Link>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}
