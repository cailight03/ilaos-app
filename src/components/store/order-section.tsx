import { type CategoryFilter, type Product, type StoreCategory } from "@/src/lib/store/products";
import { ProductCard } from "./product-card";

type Props = {
  products: Product[];
  categories: StoreCategory[];
  filter: CategoryFilter;
  onFilterChange: (f: CategoryFilter) => void;
  onOpenProduct: (p: Product) => void;
};

export function OrderSection({ products: all, categories, filter, onFilterChange, onOpenProduct }: Props) {
  const products = filter === "all" ? all : all.filter((p) => p.category === filter);
  const filters: { id: CategoryFilter; label: string }[] = [
    { id: "all", label: "All" },
    ...categories.map((c) => ({ id: c.id, label: c.label })),
  ];

  return (
    <section id="order" className="mx-auto max-w-6xl scroll-mt-24 px-5 pt-14 sm:px-8">
      <h2 className="text-4xl font-bold tracking-tight">Order</h2>
      <p className="mt-2 max-w-md text-lg leading-snug text-ink-muted">
        Reserve our freshly baked sourdough, focaccia, and other bakes for
        this week’s bake.
      </p>

      <div
        role="tablist"
        aria-label="Filter by category"
        className="-mx-5 mt-6 flex gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {filters.map((f) => {
          const active = f.id === filter;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onFilterChange(f.id)}
              className={`shrink-0 rounded-full px-6 py-2.5 text-base font-semibold transition active:scale-95 ${
                active
                  ? "bg-royal text-white"
                  : "bg-chip text-ink hover:bg-chip/70"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div
        key={filter}
        className="mt-6 grid grid-cols-2 gap-x-3.5 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4"
      >
        {products.map((p) => (
          <ProductCard key={p.id} product={p} onOpen={onOpenProduct} />
        ))}
      </div>
    </section>
  );
}
