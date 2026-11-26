"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { setCatalog, type Product } from "@/src/lib/store/products";
import { CheckoutProgress } from "./checkout-progress";
import { STEPS, stepIndex } from "./steps";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export function CheckoutShell({
  products,
  children,
}: {
  products: Product[];
  children: React.ReactNode;
}) {
  // Must run before useBag reads saved lines, which are matched against this catalog.
  setCatalog(products);
  const pathname = usePathname();
  const index = stepIndex(pathname);
  const step = STEPS[index];
  const back = index === 0 ? "/" : index === STEPS.length - 1 ? null : STEPS[index - 1].href;

  return (
    <div
      className={`${jakarta.className} min-h-dvh bg-cream text-ink [color-scheme:light]`}
    >
      <header className="sticky top-0 z-30 bg-royal pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-2 sm:px-6">
          <div className="w-24">
            {back && (
              <Link
                href={back}
                className="flex h-11 items-center rounded-full pl-1 pr-3 text-base transition active:bg-white/10"
              >
                <ChevronLeft className="size-6" strokeWidth={2} />
                {index === 0 ? "Store" : "Back"}
              </Link>
            )}
          </div>
          <h1 className="flex-1 text-center text-lg font-semibold">{step.title}</h1>
          <div className="w-24" />
        </div>
      </header>
      <CheckoutProgress current={index} />
      <div className="mx-auto max-w-5xl px-4 pb-40 pt-2 sm:px-6">{children}</div>
    </div>
  );
}
