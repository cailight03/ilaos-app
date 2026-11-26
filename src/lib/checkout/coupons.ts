import { formatPeso } from "../store/products.ts";

export type Coupon = {
  code: string;
  /** Shown to the customer once applied. */
  description: string;
  type: "percent" | "fixed";
  /** Percent (1–100) or pesos off, depending on `type`. */
  value: number;
  /** Bag subtotal, in pesos, required to use the coupon. */
  minSubtotal?: number;
  /** Last day the coupon works (YYYY-MM-DD, inclusive, local time). */
  expiresOn?: string;
};

/**
 * MOCK coupons — edit this list to add, change or retire codes.
 * Next phase: load from a Supabase `coupons` table (with usage limits) via `findCoupon`.
 */
export const COUPONS: Coupon[] = [
  { code: "WELCOME10", description: "10% off your order", type: "percent", value: 10, minSubtotal: 500 },
  { code: "SUNDAY50", description: "₱50 off your order", type: "fixed", value: 50, minSubtotal: 800, expiresOn: "2026-12-31" },
];

export type CouponResult =
  | { ok: true; coupon: Coupon; discount: number }
  | { ok: false; error: string };

export function findCoupon(code: string, list: Coupon[] = COUPONS): Coupon | undefined {
  const wanted = code.trim().toUpperCase();
  return list.find((c) => c.code.toUpperCase() === wanted);
}

function endOfDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/** Checks a code against the bag subtotal. The discount never exceeds the subtotal. */
export function evaluateCoupon(
  code: string,
  subtotal: number,
  now: Date = new Date(),
  list: Coupon[] = COUPONS,
): CouponResult {
  if (!code.trim()) return { ok: false, error: "Enter a coupon code." };
  const coupon = findCoupon(code, list);
  if (!coupon) return { ok: false, error: "That coupon code isn’t valid." };
  if (coupon.expiresOn && now > endOfDay(coupon.expiresOn)) {
    return { ok: false, error: "This coupon has expired." };
  }
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
    return {
      ok: false,
      error: `Spend ${formatPeso(coupon.minSubtotal)} or more to use this coupon (add ${formatPeso(coupon.minSubtotal - subtotal)}).`,
    };
  }
  const raw = coupon.type === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
  return { ok: true, coupon, discount: Math.min(subtotal, Math.round(raw)) };
}
