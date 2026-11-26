"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import { setCatalog, type CategoryFilter, type Product, type StoreCategory } from "@/src/lib/store/products";
import { useBag } from "@/src/lib/store/bag";
import { StoreHeader } from "./store-header";
import { Hero } from "./hero";
import { InfoStrip } from "./info-strip";
import { CategoryPreviews } from "./category-previews";
import { OrderSection } from "./order-section";
import { ProductSheet } from "./product-sheet";
import { MenuSheet } from "./menu-sheet";
import { ViewBagBar } from "./view-bag-bar";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

function scrollToId(id: string) {
  if (id === "top") window.scrollTo({ top: 0, behavior: "smooth" });
  else document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export function Storefront({
  products,
  categories,
}: {
  products: Product[];
  categories: StoreCategory[];
}) {
  // Must run before useBag reads saved lines, which are matched against this catalog.
  setCatalog(products);
  const { count, total } = useBag();
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [product, setProduct] = useState<Product | null>(null);
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      id="top"
      className={`${jakarta.className} min-h-dvh bg-cream pb-32 text-ink [color-scheme:light]`}
    >
      <StoreHeader
        count={count}
        onOpenBag={() => router.push("/checkout/bag")}
        onOpenMenu={() => setMenuOpen(true)}
      />
      <main>
        <Hero onOrder={() => scrollToId("order")} />
        <InfoStrip />
        <CategoryPreviews
          categories={categories}
          onSelect={(id) => {
            setFilter(id);
            scrollToId("order");
          }}
        />
        <OrderSection
          products={products}
          categories={categories}
          filter={filter}
          onFilterChange={setFilter}
          onOpenProduct={setProduct}
        />
      </main>
      <footer className="mx-auto mt-16 max-w-6xl px-5 text-center text-sm text-ink-muted sm:px-8">
        © Ilao’s Microbakery · Baked fresh every Sunday
      </footer>

      <ViewBagBar count={count} total={total} onOpen={() => router.push("/checkout/bag")} />

      {product && (
        <ProductSheet
          key={product.id}
          product={product}
          onClose={() => setProduct(null)}
        />
      )}
      {menuOpen && (
        <MenuSheet onClose={() => setMenuOpen(false)} onNavigate={scrollToId} />
      )}
    </div>
  );
}
