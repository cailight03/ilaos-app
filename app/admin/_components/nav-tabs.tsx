"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ChefHat,
  Wallet,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from "lucide-react";

export const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  orders: CalendarDays,
  recipe_calculator: ChefHat,
  sales_reports: BarChart3,
  costing_expenses: Wallet,
  users: Users,
};

export type NavTab = { key: string; href: string; label: string };

export function NavTabs({ tabs }: { tabs: NavTab[] }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-separator bg-card/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {tabs.map(({ key, href, label }) => {
          const Icon = NAV_ICONS[key] ?? LayoutDashboard;
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[49px] flex-col items-center justify-center gap-0.5 pt-1 text-[10px] font-medium transition-[color,transform] duration-150 active:scale-95 ${
                  active ? "text-brand" : "text-label2"
                }`}
              >
                <Icon
                  className="size-6"
                  strokeWidth={active ? 2.25 : 1.75}
                  fill={active && href === "/admin" ? "currentColor" : "none"}
                  aria-hidden
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
