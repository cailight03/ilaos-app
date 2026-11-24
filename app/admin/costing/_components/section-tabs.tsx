"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/admin/costing/ingredients", label: "Ingredients" },
  { href: "/admin/costing/products", label: "Product Costing" },
  { href: "/admin/costing/expenses", label: "Expenses" },
] as const;

/** iOS-style segmented control for the sections of Costing & Expenses. */
export function SectionTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Costing sections" className="flex rounded-xl bg-fill p-1 md:w-fit">
      {SECTIONS.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-9 flex-1 items-center justify-center rounded-lg px-4 text-[15px] font-medium whitespace-nowrap transition ${
              active ? "bg-card text-foreground shadow-sm" : "text-label2"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
