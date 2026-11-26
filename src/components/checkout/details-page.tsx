"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Bike, Check } from "lucide-react";
import { formatPeso } from "@/src/lib/store/products";
import { PICKUP_STEPS, PICKUP_WINDOW, POLICIES } from "@/src/lib/checkout/config";
import { snapshotLines } from "@/src/lib/checkout/order";
import { setAcceptedPolicies, setDetails, useCheckout } from "@/src/lib/checkout/state";
import {
  MAX_NOTES,
  validateDetails,
  type CustomerDetails,
  type DetailsErrors,
} from "@/src/lib/checkout/validation";
import { Card, OrderSummary, ScheduleCard } from "./cards";
import { Field } from "./field";
import { PrimaryButton, StickyAction } from "./sticky-action";
import { PageSkeleton, useCheckoutPage } from "./use-checkout-page";

export function DetailsPage() {
  const router = useRouter();
  const { ready, lines, total, subtotal, discount, couponCode, bakeDate } = useCheckoutPage(true);
  const { details, acceptedPolicies } = useCheckout();
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [attempted, setAttempted] = useState(false);

  if (!ready || !bakeDate) return <PageSkeleton />;

  const errors: DetailsErrors = validateDetails(details, acceptedPolicies);
  const show = (k: keyof DetailsErrors) => (attempted || touched.has(k) ? errors[k] : undefined);
  const touch = (k: string) => setTouched((s) => new Set(s).add(k));
  const set = (patch: Partial<CustomerDetails>) => setDetails({ ...details, ...patch });

  const next = () => {
    setAttempted(true);
    if (Object.keys(errors).length > 0) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]')?.focus(),
      );
      return;
    }
    router.push("/checkout/payment");
  };

  return (
    <>
    <div className="animate-ios-in lg:grid lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-6">
      <div className="space-y-4">
        <Card title="Your details">
          <form
            className="space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
          >
            <Field id="fullName" label="Full name" error={show("fullName")}>
              {(p) => (
                <input
                  {...p}
                  type="text"
                  autoComplete="name"
                  placeholder="Juan Dela Cruz"
                  value={details.fullName}
                  onChange={(e) => set({ fullName: e.target.value })}
                  onBlur={() => touch("fullName")}
                />
              )}
            </Field>
            <Field
              id="email"
              label="Email address"
              error={show("email")}
              hint="We’ll email you once your payment is verified."
            >
              {(p) => (
                <input
                  {...p}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={details.email}
                  onChange={(e) => set({ email: e.target.value })}
                  onBlur={() => touch("email")}
                />
              )}
            </Field>
            <Field id="mobile" label="Mobile number" error={show("mobile")}>
              {(p) => (
                <input
                  {...p}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0917 123 4567"
                  value={details.mobile}
                  onChange={(e) => set({ mobile: e.target.value })}
                  onBlur={() => touch("mobile")}
                />
              )}
            </Field>
            <Field
              id="notes"
              label="Order notes"
              optional
              hint={`${details.notes.length}/${MAX_NOTES}`}
            >
              {(p) => (
                <textarea
                  {...p}
                  rows={3}
                  maxLength={MAX_NOTES}
                  placeholder="Allergies, pickup person or rider name, anything we should know"
                  value={details.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                />
              )}
            </Field>
          </form>
        </Card>

        <Card title="Pickup arrangements">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-royal/10 text-royal">
              <Bike className="size-5" />
            </span>
            <p className="text-base">
              <span className="font-semibold">Pick up yourself or book your own Lalamove rider.</span>{" "}
              <span className="text-ink-muted">No delivery fee is charged by us.</span>
            </p>
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 text-ink-muted marker:font-semibold marker:text-ink">
            {PICKUP_STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Card>

        <Card title="Ordering policies">
          <ul className="space-y-2 text-ink-muted">
            {POLICIES.map((p) => (
              <li key={p} className="flex gap-2.5">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-royal" />
                {p}
              </li>
            ))}
          </ul>
          <label
            className={`mt-4 flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 transition ${
              show("policies") ? "bg-red-50 ring-red-400" : "bg-cream ring-ink/10"
            }`}
          >
            <input
              type="checkbox"
              className="peer sr-only"
              checked={acceptedPolicies}
              data-invalid={!!show("policies")}
              onChange={(e) => {
                setAcceptedPolicies(e.target.checked);
                touch("policies");
              }}
            />
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ring-2 ring-ink/25 transition peer-checked:bg-royal peer-checked:ring-royal peer-focus-visible:ring-4 peer-focus-visible:ring-royal/30 [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100">
              <Check className="size-4 text-white" strokeWidth={3} />
            </span>
            <span className="font-medium">I have read and agree to the ordering policies.</span>
          </label>
          {show("policies") && (
            <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle className="size-4 shrink-0" />
              {errors.policies}
            </p>
          )}
        </Card>
      </div>

      <div className="mt-4 space-y-4 lg:sticky lg:top-20 lg:mt-0">
        <ScheduleCard bakeDate={bakeDate} pickupWindow={PICKUP_WINDOW} />
        <OrderSummary
          lines={snapshotLines(lines)}
          total={total}
          subtotal={subtotal}
          discount={discount}
          couponCode={couponCode}
        />
      </div>

    </div>
      <StickyAction total={formatPeso(total)}>
        <PrimaryButton onClick={next}>Continue to Payment</PrimaryButton>
      </StickyAction>
    </>
  );
}
