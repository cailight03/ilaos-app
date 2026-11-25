import { ChevronRight } from "lucide-react";
import type { Order } from "@/src/lib/orders";
import {
  displayOrderId,
  formatBakeDate,
  formatPeso,
  isDiscounted,
  productLabel,
} from "@/src/lib/order-view";

export function OrderCard({
  order,
  duplicateId,
  onOpen,
}: {
  order: Order;
  duplicateId: boolean;
  onOpen: (order: Order) => void;
}) {
  return (
    <article className="rounded-xl border border-separator bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="min-w-0">
          <h3 className="truncate text-[17px] font-semibold">{order.name}</h3>
          <p className="text-[13px] text-label2">
            {order.invoiceId ? `Order ${displayOrderId(order)}` : "No order ID"}
            {duplicateId && " · ID shared with another order"}
          </p>
          <p className="text-[13px] text-label2">Bake: {formatBakeDate(order.bakeDate)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              order.paid ? "bg-green-500/10 text-green-700" : "bg-ios-orange/15 text-ios-orange"
            }`}
          >
            {order.paid ? "Paid" : "Unpaid"}
          </span>
          {order.archived && (
            <span className="rounded-full bg-fill px-2.5 py-1 text-xs font-semibold text-label2">Archived</span>
          )}
          {order.refund > 0 && (
            <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-600">
              Refunded {formatPeso(order.refund)}
            </span>
          )}
          {isDiscounted(order) && (
            <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-semibold text-brand">
              Discounted{order.coupon ? ` · ${order.coupon}` : ""}
            </span>
          )}
        </div>
      </div>

      <ul className="flex flex-col gap-1 px-4 pb-3 text-[15px]">
        {order.items.map((item, i) => (
          <li key={`${item.product}-${i}`} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">{productLabel(item.product)}</span>
            <span className="text-label2 tabular-nums">× {item.quantity}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-separator pl-4">
        <div>
          <span className="text-[17px] font-bold tabular-nums">{formatPeso(order.total)}</span>
          {order.discount > 0 && (
            <span className="ml-2 text-[13px] text-label2">saved {formatPeso(order.discount)}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpen(order)}
          className="flex min-h-11 items-center gap-0.5 rounded-br-xl pr-3 pl-3 text-[15px] font-medium text-brand transition active:opacity-60"
        >
          View details
          <ChevronRight className="size-[18px]" aria-hidden />
        </button>
      </div>
    </article>
  );
}
