import Image from "next/image";
import { Menu, ShoppingBag } from "lucide-react";

type Props = {
  count: number;
  onOpenBag: () => void;
  onOpenMenu: () => void;
};

export function StoreHeader({ count, onOpenBag, onOpenMenu }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-royal pt-[env(safe-area-inset-top)] text-white">
      <div className="mx-auto flex h-[92px] sm:h-[104px] max-w-6xl items-center justify-between px-5 sm:px-8">
        {/* The logo file is a square with padding; crop it to the wordmark. */}
        <a
          href="#top"
          aria-label="Ilao's Microbakery home"
          className="relative block h-[68px] w-[120px] sm:h-[76px] sm:w-[136px]"
        >
          <Image
            src="/logo.png"
            alt="Ilao's Microbakery"
            fill
            sizes="136px"
            priority
            className="object-cover object-[50%_57%] brightness-0 invert"
          />
        </a>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenBag}
            aria-label={`Open bag, ${count} ${count === 1 ? "item" : "items"}`}
            className="relative flex size-11 items-center justify-center rounded-full transition active:scale-90 active:bg-white/10"
          >
            <ShoppingBag className="size-6" strokeWidth={1.75} />
            {count > 0 && (
              <span
                key={count}
                className="absolute right-0.5 top-0.5 flex min-w-5 animate-store-bump items-center justify-center rounded-full bg-white px-1 text-xs font-bold leading-5 text-royal"
              >
                {count}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open menu"
            className="flex size-11 items-center justify-center rounded-full transition active:scale-90 active:bg-white/10"
          >
            <Menu className="size-7" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </header>
  );
}
