export const STEPS = [
  { href: "/checkout/bag", label: "Bag", title: "Shopping Bag" },
  { href: "/checkout/details", label: "Details", title: "Your Details" },
  { href: "/checkout/payment", label: "Payment", title: "Payment" },
  { href: "/checkout/success", label: "Done", title: "Order Submitted" },
] as const;

export function stepIndex(pathname: string): number {
  const i = STEPS.findIndex((s) => pathname.startsWith(s.href));
  return i < 0 ? 0 : i;
}
