import type { Order } from "@/src/lib/orders";
import {
  displayOrderId,
  formatBakeDate,
  formatPeso,
  isDiscounted,
  productLabel,
} from "@/src/lib/order-view";

/** Desktop (lg+) table view of the same orders shown as cards on mobile. */
export function OrdersTable({
  orders,
  duplicates,
  onOpen,
}: {
  orders: Order[];
  duplicates: Set<string>;
  onOpen: (order: Order) => void;
}) {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-separator bg-card shadow-sm lg:block">
      <table className="w-full text-left text-[15px]">
        <thead className="border-b border-separator text-[13px] text-label2">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Customer</th>
            <th scope="col" className="px-4 py-3 font-medium">Order ID</th>
            <th scope="col" className="px-4 py-3 font-medium">Bake date</th>
            <th scope="col" className="px-4 py-3 font-medium">Items</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr
              key={o.rowNumber}
              tabIndex={0}
              onClick={() => onOpen(o)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(o);
                }
              }}
              className="cursor-pointer border-b border-separator transition-colors last:border-b-0 hover:bg-fill focus-visible:bg-fill focus-visible:outline-none"
            >
              <td className="max-w-56 truncate px-4 py-3 font-medium">
                {o.name}
                {o.archived && <span className="ml-1.5 text-[13px] font-normal text-label2">(archived)</span>}
              </td>
              <td className="px-4 py-3 text-label2 tabular-nums">
                {o.invoiceId ? displayOrderId(o) : "—"}
                {duplicates.has(o.invoiceId) && (
                  <span className="ml-1 text-[13px]" title="ID shared with another order">
                    (shared)
                  </span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{formatBakeDate(o.bakeDate)}</td>
              <td className="px-4 py-3">
                <ul className="flex flex-col">
                  {o.items.map((item, i) => (
                    <li key={`${item.product}-${i}`} className="flex gap-2">
                      <span className="truncate">{productLabel(item.product)}</span>
                      <span className="text-label2 tabular-nums">× {item.quantity}</span>
                    </li>
                  ))}
                </ul>
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {formatPeso(o.total)}
                {o.refund > 0 && (
                  <span className="block text-[13px] font-normal text-red-600">refunded {formatPeso(o.refund)}</span>
                )}
                {o.discount > 0 && (
                  <span className="block text-[13px] font-normal text-label2">saved {formatPeso(o.discount)}</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      o.paid ? "bg-green-500/10 text-green-700" : "bg-ios-orange/15 text-ios-orange"
                    }`}
                  >
                    {o.paid ? "Paid" : "Unpaid"}
                  </span>
                  {isDiscounted(o) && (
                    <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-semibold text-brand">
                      Discounted
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
