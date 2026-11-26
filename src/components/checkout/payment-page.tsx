"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Download, ImagePlus, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { formatPeso } from "@/src/lib/store/products";
import { GCASH, PAYMENT_STEPS, PICKUP_WINDOW } from "@/src/lib/checkout/config";
import { snapshotLines, submitOrder, toIsoDate } from "@/src/lib/checkout/order";
import {
  setPlacedOrder,
  setProof,
  useCheckout,
} from "@/src/lib/checkout/state";
import { validateDetails, validatePayment } from "@/src/lib/checkout/validation";
import { Card, OrderSummary, SimulationNotice } from "./cards";
import { downloadQr, MockQr } from "./mock-qr";
import { PrimaryButton, StickyAction } from "./sticky-action";
import { PageSkeleton, useCheckoutPage } from "./use-checkout-page";

export function PaymentPage() {
  const router = useRouter();
  const { ready, lines, total, subtotal, discount, couponCode, bakeDate } = useCheckoutPage(true);
  const { details, acceptedPolicies, proof, proofUrl } = useCheckout();
  const fileRef = useRef<HTMLInputElement>(null);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);

  // Details must be complete before payment; send direct visits back a step.
  const detailsOk =
    Object.keys(validateDetails(details, acceptedPolicies)).length === 0;
  useEffect(() => {
    if (ready && !detailsOk && !submitting) router.replace("/checkout/details");
  }, [ready, detailsOk, submitting, router]);

  if (!ready || !bakeDate || !detailsOk) return <PageSkeleton />;

  const errors = validatePayment(proof);
  const showProof = attempted && errors.proof;

  const place = async () => {
    setAttempted(true);
    setSubmitError(null);
    if (errors.proof || !proof) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]')?.focus(),
      );
      return;
    }
    setSubmitting(true);
    try {
      const order = await submitOrder({
        customer: details,
        lines,
        subtotal,
        couponCode,
        discount,
        total,
        bakeDate: toIsoDate(bakeDate),
        pickupWindow: PICKUP_WINDOW,
        proof,
      });
      setPlacedOrder(order);
      router.replace("/checkout/success");
    } catch {
      setSubmitError("We couldn’t submit your order. Please check your connection and try again.");
      setSubmitting(false);
    }
  };

  return (
    <>
    <div className="animate-ios-in lg:grid lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-6">
      <div className="space-y-4">
        <SimulationNotice>
          <p className="font-semibold">Demo checkout</p>
          <p>
            Payment details below are samples and orders are simulated. Nothing is sent to the bakery,
            so please don’t send real money.
          </p>
        </SimulationNotice>

        <Card title="Pay with GCash">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="size-52 shrink-0 overflow-hidden rounded-2xl p-2 ring-1 ring-ink/10">
              <MockQr seed={GCASH.qrPayload} />
            </div>
            <div className="w-full min-w-0 text-center sm:text-left">
              <p className="text-sm text-ink-muted">Amount to pay</p>
              <p className="text-3xl font-bold tabular-nums">{formatPeso(total)}</p>
              <p className="mt-3 font-semibold">{GCASH.accountName}</p>
              <p className="text-ink-muted tabular-nums">{GCASH.number}</p>
              <button
                type="button"
                onClick={() =>
                  downloadQr(GCASH.qrPayload, "ilaos-gcash-qr.png").then(
                    () => setSaveError(false),
                    () => setSaveError(true),
                  )
                }
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-chip px-5 py-2.5 font-semibold transition active:scale-95"
              >
                <Download className="size-5" />
                Save QR code
              </button>
              {saveError && (
                <p role="alert" className="mt-2 text-sm text-red-600">
                  Couldn’t save the image. Take a screenshot of the QR code instead.
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card title="How to pay">
          <ol className="list-decimal space-y-1.5 pl-5 text-ink-muted marker:font-semibold marker:text-ink">
            {PAYMENT_STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Card>

        <Card title="Payment details">
          <div className="space-y-5">
            <div>
              <p className="mb-1.5 text-sm font-semibold">Proof of payment</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setProof(f);
                  e.target.value = "";
                }}
              />
              {proof && proofUrl ? (
                <div className="flex items-center gap-4 rounded-2xl bg-cream p-3 ring-1 ring-ink/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proofUrl}
                    alt="Proof of payment preview"
                    className="size-24 shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{proof.name}</p>
                    <p className="text-sm text-ink-muted">{(proof.size / 1024).toFixed(0)} KB</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-full bg-chip px-3.5 py-2 text-sm font-semibold transition active:scale-95"
                      >
                        <RefreshCw className="size-4" /> Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => setProof(null)}
                        className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold text-red-600 transition active:bg-red-50"
                      >
                        <Trash2 className="size-4" /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  data-invalid={!!showProof}
                  aria-label={showProof ? "Upload screenshot, required" : undefined}
                  className={`flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition active:scale-[0.99] ${
                    showProof ? "border-red-500 bg-red-50" : "border-ink/20 bg-cream"
                  }`}
                >
                  <ImagePlus className="size-7 text-royal" strokeWidth={1.75} />
                  <span className="font-semibold">Upload screenshot</span>
                  <span className="text-sm text-ink-muted">JPG or PNG, up to 5 MB</span>
                </button>
              )}
              {(proof || showProof) && errors.proof ? (
                <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm text-red-600">
                  <AlertCircle className="size-4 shrink-0" />
                  {errors.proof}
                </p>
              ) : null}
            </div>
          </div>
        </Card>

        <div className="flex gap-3 rounded-2xl bg-royal/10 p-4 text-sm text-ink">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-royal" />
          <p>
            <span className="font-semibold">Placing an order does not confirm it.</span> The bakery will
            manually verify your payment first. Your order is confirmed only after verification, and
            you’ll be emailed at {details.email}.
          </p>
        </div>

        {submitError && (
          <p role="alert" className="flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-red-700 ring-1 ring-red-200">
            <AlertCircle className="size-5 shrink-0" />
            {submitError}
          </p>
        )}
      </div>

      <div className="mt-4 lg:sticky lg:top-20 lg:mt-0">
        <OrderSummary
          lines={snapshotLines(lines)}
          total={total}
          subtotal={subtotal}
          discount={discount}
          couponCode={couponCode}
        />
      </div>

    </div>
      <StickyAction label="Total payable" total={formatPeso(total)}>
        <PrimaryButton onClick={place} loading={submitting}>
          {submitting ? "Placing order…" : "Place Order"}
        </PrimaryButton>
      </StickyAction>
    </>
  );
}
