import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { CheckoutShell } from "@/src/components/checkout/checkout-shell";
import { loadStorefront } from "@/src/lib/store/catalog";

export const metadata: Metadata = {
  title: "Checkout · Ilao's Microbakery",
  robots: { index: false },
};

export const viewport: Viewport = {
  themeColor: "#0b3ec4",
  viewportFit: "cover",
};

export default function CheckoutLayout({ children }: LayoutProps<"/checkout">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-cream" aria-busy aria-label="Loading" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const { products } = await loadStorefront();
  return <CheckoutShell products={products}>{children}</CheckoutShell>;
}
