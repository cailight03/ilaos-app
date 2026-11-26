import { Plus } from "lucide-react";
import { formatPeso, type Product } from "@/src/lib/store/products";
import { BakeryImage } from "./bakery-image";

export function ProductCard({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: (p: Product) => void;
}) {
  return (
    <article className="group flex animate-ios-in flex-col">
      <button
        type="button"
        onClick={() => onOpen(product)}
        aria-label={`View ${product.name}`}
        className="flex flex-col text-left"
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-chip">
          <BakeryImage
            src={product.image}
            alt={product.name}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <h3 className="mt-3 text-base font-bold leading-tight sm:text-lg">
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm leading-snug text-ink-muted">
          {product.description}
        </p>
      </button>
      <div className="mt-auto flex items-center justify-between pt-3">
        <span className="text-lg font-bold">{formatPeso(product.price)}</span>
        <button
          type="button"
          onClick={() => onOpen(product)}
          aria-label={`Add ${product.name} to bag`}
          className="flex size-10 items-center justify-center rounded-full bg-royal text-white transition hover:bg-royal-dark active:scale-90"
        >
          <Plus className="size-5" strokeWidth={2.25} />
        </button>
      </div>
    </article>
  );
}
