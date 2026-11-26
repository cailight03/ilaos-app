import { ArrowRight } from "lucide-react";
import type { CategoryId, StoreCategory } from "@/src/lib/store/products";
import { BakeryImage } from "./bakery-image";

export function CategoryPreviews({
  categories,
  onSelect,
}: {
  categories: StoreCategory[];
  onSelect: (id: CategoryId) => void;
}) {
  return (
    <section id="bakes" className="mx-auto max-w-6xl scroll-mt-24 px-5 pt-12 sm:px-8">
      <h2 className="text-3xl font-bold tracking-tight">Our Bakes</h2>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className="group relative aspect-[3/2] overflow-hidden rounded-2xl bg-chip text-left text-white transition active:scale-[0.98] last:odd:max-sm:col-span-2 last:odd:max-sm:aspect-[3/1]"
          >
            <BakeryImage
              src={c.image}
              alt=""
              sizes="(min-width: 640px) 33vw, 50vw"
              className="transition-transform duration-500 group-hover:scale-105"
              placeholderClassName="bg-[#8a5a2b] text-white/30"
            />
            <div className="absolute inset-0 bg-black/30" />
            <span className="absolute inset-x-4 bottom-3 flex items-center justify-between text-lg font-semibold">
              {c.label}
              <ArrowRight className="size-5" />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
