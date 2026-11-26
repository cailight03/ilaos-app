import { ArrowRight, ShoppingBag } from "lucide-react";
import { formatPeso } from "@/src/lib/store/products";

type Props = { count: number; total: number; onOpen: () => void };

export function ViewBagBar({ count, total, onOpen }: Props) {
  if (count === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={onOpen}
        className="pointer-events-auto mx-auto flex w-full max-w-xl animate-ios-in items-center rounded-full bg-royal py-4 pl-6 pr-5 text-lg font-semibold text-white shadow-sm transition hover:bg-royal-dark active:scale-[0.98]"
      >
        <ShoppingBag className="size-6" strokeWidth={1.75} />
        <span className="ml-3">View Bag ({count})</span>
        <span className="ml-auto flex items-center gap-2 border-l border-white/30 pl-4">
          {formatPeso(total)}
          <ArrowRight className="size-5" />
        </span>
      </button>
    </div>
  );
}
