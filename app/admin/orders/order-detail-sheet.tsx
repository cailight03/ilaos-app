"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Circle, X } from "lucide-react";
import type { Order } from "@/src/lib/orders";
import {
  displayOrderId,
  formatBakeDate,
  formatPeso,
  itemsSubtotal,
  productLabel,
} from "@/src/lib/order-view";
import { setOrderPaid } from "./actions";

/** Bottom sheet built on the native <dialog>: focus trap, Esc to close and inert backdrop come for free. */
export function OrderDetailSheet({
  order,
  onClose,
  onPaidChange,
}: {
  order: Order | null;
  onClose: () => void;
  onPaidChange: (rowNumber: number, paid: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (order && !dialog.open) dialog.showModal();
    if (!order && dialog.open) dialog.close();
  }, [order]);

  const [closing, setClosing] = useState(false);

  // Slide down first; the dialog is really closed when that animation ends.
  const requestClose = () => {
    if (ref.current?.open) setClosing(true);
  };

  const adjustment = order ? order.total - (itemsSubtotal(order) - order.discount) : 0;
  const row = "flex items-center justify-between gap-3 px-4 py-3 text-[17px]";

  return (
    <dialog
      ref={ref}
      onClose={() => {
        setClosing(false);
        onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onAnimationEnd={(e) => {
        if (closing && e.target === ref.current) ref.current?.close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) requestClose();
      }}
      aria-labelledby="order-detail-title"
      className={`m-0 mt-auto w-full max-w-none lg:m-auto lg:w-full lg:max-w-md overscroll-contain bg-transparent p-0 backdrop:bg-black/40 backdrop:backdrop-blur-[2px] backdrop:transition-opacity backdrop:duration-150 ${
        closing
          ? "animate-[sheet-down_160ms_cubic-bezier(0.4,0,1,1)_forwards] backdrop:opacity-0"
          : "open:animate-[sheet-up_300ms_cubic-bezier(0.22,1,0.36,1)]"
      }`}
    >
      {order && (
        <div className="mx-auto max-h-[88dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[20px] bg-background lg:rounded-[20px] px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-foreground">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-label2/40" aria-hidden />

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="order-detail-title" className="truncate text-[28px] leading-9 font-bold tracking-tight">
                {order.name}
              </h2>
              {order.invoiceId && (
                <p className="text-[15px] text-label2">Order {displayOrderId(order)}</p>
              )}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={requestClose}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fill text-label2 transition active:scale-90"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-separator bg-card">
            <div className={row}>
              <span>Bake date</span>
              <span className="text-label2">{formatBakeDate(order.bakeDate)}</span>
            </div>
          </div>

          <PaymentSection key={order.rowNumber} order={order} onPaidChange={onPaidChange} />

          <h3 className="mt-5 mb-1.5 px-4 text-[13px] text-label2">Products</h3>
          <ul className="overflow-hidden rounded-xl border border-separator bg-card">
            {order.items.map((item, i) => (
              <li
                key={`${item.product}-${i}`}
                className="flex items-center justify-between gap-3 border-b border-separator px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-[17px]">
                    {productLabel(item.product)} × {item.quantity}
                  </p>
                  <p className="text-[13px] text-label2">{formatPeso(item.unitPrice)} each</p>
                </div>
                <p className="text-[17px] font-semibold tabular-nums">
                  {formatPeso(item.unitPrice * item.quantity)}
                </p>
              </li>
            ))}
          </ul>

          {(order.coupon || order.discount > 0 || Math.abs(adjustment) > 0.005) && (
            <div className="mt-4 divide-y divide-separator overflow-hidden rounded-xl border border-separator bg-card">
              {order.coupon && (
                <div className={row}>
                  <span>Coupon used</span>
                  <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-[15px] font-semibold text-brand">
                    {order.coupon}
                  </span>
                </div>
              )}
              {order.discount > 0 && (
                <div className={row}>
                  <span>Discount</span>
                  <span className="font-semibold tabular-nums">−{formatPeso(order.discount)}</span>
                </div>
              )}
              {Math.abs(adjustment) > 0.005 && (
                <div className={`${row} text-label2`}>
                  <span>Other / adjustment</span>
                  <span className="tabular-nums">
                    {adjustment > 0 ? "+" : "−"}
                    {formatPeso(Math.abs(adjustment))}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between rounded-xl border border-separator bg-card px-4 py-3.5">
            <span className="text-[17px] font-semibold">Order total</span>
            <span className="text-[22px] font-bold tabular-nums">{formatPeso(order.total)}</span>
          </div>
        </div>
      )}
    </dialog>
  );
}

function PaymentSection({
  order,
  onPaidChange,
}: {
  order: Order;
  onPaidChange: (rowNumber: number, paid: boolean) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !order.paid;
    setError(null);
    start(async () => {
      try {
        const res = await setOrderPaid(order.rowNumber, order.invoiceId, next);
        if (res.ok) onPaidChange(order.rowNumber, res.paid);
        else setError(res.error);
      } catch {
        setError("Couldn't save. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-separator bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] text-label2">Payment</p>
          <p
            className={`flex items-center gap-1.5 text-[17px] font-semibold ${
              order.paid ? "text-green-600" : "text-ios-orange"
            }`}
          >
            {order.paid ? (
              <CheckCircle2 className="size-5" aria-hidden />
            ) : (
              <Circle className="size-5" aria-hidden />
            )}
            {order.paid ? "Paid" : "Unpaid"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={`h-11 rounded-xl px-4 text-[15px] font-semibold transition active:scale-[0.97] active:opacity-80 disabled:opacity-60 ${
            order.paid ? "bg-fill text-brand" : "bg-brand text-white"
          }`}
        >
          {pending ? "Saving…" : order.paid ? "Mark as unpaid" : "Mark as paid"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
