/** Bakery-specific checkout content. Placeholder values are marked MOCK and should be replaced in the next phase. */

export const PICKUP_WINDOW = "9:00 AM – 12:00 PM";

/** Orders close Friday at this hour (24h, local time) for the coming Sunday bake. */
const CUTOFF_HOUR = 12;

/** Next Sunday bake the customer can still order for. */
export function nextBakeDate(now: Date = new Date()): Date {
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7));
  const cutoff = new Date(sunday);
  cutoff.setDate(cutoff.getDate() - 2);
  cutoff.setHours(CUTOFF_HOUR, 0, 0, 0);
  if (now >= cutoff) sunday.setDate(sunday.getDate() + 7);
  return sunday;
}

export function formatBakeDate(d: Date): string {
  return d.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export const PICKUP_STEPS = [
  "Your order is baked fresh on the bake date shown.",
  `Pick up your order yourself, or book your own Lalamove rider to collect it, during the pickup window (${PICKUP_WINDOW}).`,
  "Show your order reference number at pickup, or give it to your rider.",
];

export const POLICIES = [
  `Orders are baked to order for the Sunday bake date. Orders close Friday at ${CUTOFF_HOUR}:00 PM.`,
  "Your order is only confirmed once the bakery has manually verified your GCash payment.",
  "Pickup is either by you in person or via a Lalamove rider that you book and pay for. Ilao’s Microbakery does not arrange delivery.",
  "Uncollected orders outside the pickup window cannot be held or refunded.",
  "Because everything is baked fresh, orders cannot be cancelled or changed after payment is verified.",
];

/** MOCK payment details — not a real account. */
export const GCASH = {
  accountName: "Ilao’s Microbakery (SAMPLE)",
  number: "0917 000 0000",
  qrPayload: "ILAOS-MOCK-GCASH-0000000000",
};

export const PAYMENT_STEPS = [
  "Open GCash and choose Scan QR (or Send Money to the number shown).",
  "Pay the exact total amount shown.",
  "Take a screenshot of your GCash receipt and upload it below as proof of payment.",
];
