"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useBag } from "@/src/lib/store/bag";
import { nextBakeDate } from "@/src/lib/checkout/config";
import { useHydrated, useCheckout } from "@/src/lib/checkout/state";
import { evaluateCoupon } from "@/src/lib/checkout/coupons";

/**
 * Bag + hydration state for checkout pages. Bag and form state live in browser storage, so pages render a
 * skeleton until hydrated. With `requireItems`, an empty bag sends the customer back to the bag page.
 */
export function useCheckoutPage(requireItems: boolean) {
  const hydrated = useHydrated();
  const bag = useBag();
  const { couponCode } = useCheckout();
  const router = useRouter();
  const bakeDate = useMemo(() => (hydrated ? nextBakeDate() : null), [hydrated]);
  const empty = hydrated && bag.lines.length === 0;

  // Re-checked on every bag change, so a coupon drops off if the subtotal falls below its minimum.
  const coupon = useMemo(
    () => (hydrated && couponCode ? evaluateCoupon(couponCode, bag.total) : null),
    [hydrated, couponCode, bag.total],
  );
  const discount = coupon?.ok ? coupon.discount : 0;

  useEffect(() => {
    if (requireItems && empty) router.replace("/checkout/bag");
  }, [requireItems, empty, router]);

  return {
    ...bag,
    subtotal: bag.total,
    discount,
    /** Amount payable after the coupon. */
    total: bag.total - discount,
    couponCode: coupon?.ok ? coupon.coupon.code : null,
    coupon,
    hydrated,
    bakeDate,
    ready: hydrated && !(requireItems && empty),
  };
}

export function PageSkeleton() {
  return (
    <div className="space-y-3" aria-busy aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-chip" />
      ))}
    </div>
  );
}
