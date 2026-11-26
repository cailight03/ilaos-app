"use client";

import { useState } from "react";
import { AlertCircle, Tag, X } from "lucide-react";
import { formatPeso } from "@/src/lib/store/products";
import { evaluateCoupon, findCoupon, type CouponResult } from "@/src/lib/checkout/coupons";
import { setCouponCode, useCheckout } from "@/src/lib/checkout/state";
import { Card } from "./cards";

export function CouponBox({
  subtotal,
  discount,
  coupon,
}: {
  subtotal: number;
  discount: number;
  /** Result for the stored code, or null when none is stored. */
  coupon: CouponResult | null;
}) {
  const { couponCode } = useCheckout();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    const result = evaluateCoupon(input, subtotal);
    if (!result.ok) return setError(result.error);
    setError(null);
    setInput("");
    setCouponCode(result.coupon.code);
  };

  const remove = () => {
    setCouponCode(null);
    setError(null);
  };

  if (coupon?.ok) {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700">
            <Tag className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{coupon.coupon.code}</p>
            <p className="text-sm text-green-700">
              {coupon.coupon.description} · −{formatPeso(discount)}
            </p>
          </div>
          <button
            type="button"
            onClick={remove}
            aria-label={`Remove coupon ${coupon.coupon.code}`}
            className="flex size-9 items-center justify-center rounded-full bg-chip transition active:scale-90"
          >
            <X className="size-4" />
          </button>
        </div>
      </Card>
    );
  }

  const stale = coupon && !coupon.ok ? coupon.error : null;
  const shown = error ?? null;

  return (
    <Card title="Coupon code">
      {couponCode && stale && (
        <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p className="flex-1">
            {findCoupon(couponCode)?.code ?? couponCode} isn’t applied. {stale}
          </p>
          <button type="button" onClick={remove} className="font-semibold underline">
            Remove
          </button>
        </div>
      )}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="Enter code"
          aria-label="Coupon code"
          aria-invalid={!!shown}
          className={`min-w-0 flex-1 rounded-xl bg-cream px-4 py-3 text-base uppercase outline-none ring-1 transition placeholder:normal-case placeholder:text-ink-muted/60 focus:ring-2 ${
            shown ? "ring-red-500 focus:ring-red-500" : "ring-ink/10 focus:ring-royal"
          }`}
        />
        <button
          type="submit"
          className="rounded-full bg-royal px-5 text-base font-semibold text-white transition active:scale-95"
        >
          Apply
        </button>
      </form>
      {shown && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-red-600">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {shown}
        </p>
      )}
    </Card>
  );
}
