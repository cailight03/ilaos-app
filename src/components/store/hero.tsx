import { ArrowRight } from "lucide-react";
import { HeroCarousel } from "./hero-carousel";

export function Hero({ onOrder }: { onOrder: () => void }) {
  return (
    <section className="relative overflow-hidden bg-[#2b1a0f] text-white">
      <HeroCarousel />
      <div className="absolute inset-0 bg-black/35" />
      <div className="relative mx-auto min-h-[30rem] max-w-6xl sm:min-h-[34rem] lg:min-h-[38rem]">
        <div className="relative flex min-h-[30rem] max-w-xl flex-col justify-start px-6 pb-24 pt-14 sm:min-h-[34rem] sm:px-10 sm:pt-20 lg:min-h-[38rem] lg:pt-28">
          <h1 className="animate-ios-in text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Good bread.
            <br />
            Every Sunday.
          </h1>
          <p className="mt-5 max-w-sm text-lg leading-snug text-white/90">
            Artisan sourdough, focaccia, and other bakes, made in small
            batches.
          </p>
          <button
            type="button"
            onClick={onOrder}
            className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-white px-7 py-3.5 text-lg font-semibold text-royal transition active:scale-95"
          >
            Order Now
            <ArrowRight className="size-5" />
          </button>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-8 rounded-t-[2rem] bg-cream" />
    </section>
  );
}
