import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Storefront } from "@/src/components/store/storefront";
import { loadStorefront } from "@/src/lib/store/catalog";

export const metadata: Metadata = {
  title: "Order · Ilao's Microbakery",
  description:
    "Artisan sourdough, focaccia, and other bakes, made in small batches. Order for this Sunday's bake.",
};

export const viewport: Viewport = {
  themeColor: "#0b3ec4",
  viewportFit: "cover",
};

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-cream" aria-busy aria-label="Loading" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const { products, categories } = await loadStorefront();
  return <Storefront products={products} categories={categories} />;
}
