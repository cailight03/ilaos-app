import type { BagLine } from "../store/bag";
import type { CustomerDetails } from "./validation";

export type OrderLineSnapshot = {
  name: string;
  image: string;
  optionLabel: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderInput = {
  customer: CustomerDetails;
  lines: BagLine[];
  /** Bag subtotal before any coupon. */
  subtotal: number;
  couponCode: string | null;
  discount: number;
  /** Amount payable after the discount. */
  total: number;
  /** ISO date (YYYY-MM-DD) of the Sunday bake. */
  bakeDate: string;
  pickupWindow: string;
  proof: File;
};

export type PlacedOrder = {
  reference: string;
  /** True while submissions are mocked; real orders will set this to false. */
  simulated: boolean;
  status: "pending_payment_verification";
  placedAt: string;
  customer: CustomerDetails;
  lines: OrderLineSnapshot[];
  subtotal: number;
  couponCode: string | null;
  discount: number;
  /** Amount payable after the discount. */
  total: number;
  bakeDate: string;
  pickupWindow: string;
};

export function snapshotLines(lines: BagLine[]): OrderLineSnapshot[] {
  return lines.map((l) => ({
    name: l.product.name,
    image: l.product.image,
    optionLabel: l.optionLabel,
    qty: l.qty,
    unitPrice: l.unitPrice,
    lineTotal: l.lineTotal,
  }));
}

export function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * The single seam for order submission. Phase 1 simulates it locally; the next phase replaces this body
 * with a server action that uploads the proof, inserts the order into Supabase and queues the email.
 */
export async function submitOrder(input: OrderInput): Promise<PlacedOrder> {
  await new Promise((r) => setTimeout(r, 1200));
  const code = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) =>
    b.toString(36).padStart(2, "0"),
  )
    .join("")
    .toUpperCase()
    .slice(0, 6);
  return {
    reference: `SIM-${code}`,
    simulated: true,
    status: "pending_payment_verification",
    placedAt: new Date().toISOString(),
    customer: input.customer,
    lines: snapshotLines(input.lines),
    subtotal: input.subtotal,
    couponCode: input.couponCode,
    discount: input.discount,
    total: input.total,
    bakeDate: input.bakeDate,
    pickupWindow: input.pickupWindow,
  };
}
