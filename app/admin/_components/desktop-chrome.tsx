"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { logout } from "../login/actions";
import { NAV_ICONS, type NavTab } from "./nav-tabs";
import { ThemeToggle } from "./theme-toggle";

export type ChromeUser = { name: string | null; email: string; image: string | null };

const COLLAPSE_KEY = "ilaos-sidebar-collapsed";
const WIDTH_EXPANDED = "15rem";
const WIDTH_COLLAPSED = "4.5rem";

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
};
const setCollapsed = (value: boolean) => {
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {
    // Storage unavailable: the choice just won't persist.
  }
  listeners.forEach((cb) => cb());
};

const TITLES: [string, string][] = [
  ["/admin/orders", "Orders"],
  ["/admin/recipe-calculator", "Recipe Calculator"],
  ["/admin/reports", "Sales Reports"],
  ["/admin/costing", "Costing & Expenses"],
  ["/admin/users", "User Management"],
];

const isActive = (href: string, pathname: string) =>
  href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

/** Desktop-only (lg+) sidebar and top bar. Hidden on mobile, where the bottom nav is used. */
export function DesktopChrome({ tabs, user }: { tabs: NavTab[]; user: ChromeUser }) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const hidden = pathname === "/admin/login" || pathname === "/admin/access-denied";

  // Pages reserve room for the fixed sidebar through this variable.
  useEffect(() => {
    if (hidden) return;
    const root = document.documentElement;
    root.style.setProperty("--sidebar-w", collapsed ? WIDTH_COLLAPSED : WIDTH_EXPANDED);
    return () => {
      root.style.removeProperty("--sidebar-w");
    };
  }, [collapsed, hidden]);

  if (hidden) return null;

  const title = TITLES.find(([href]) => pathname.startsWith(href))?.[1] ?? "Dashboard";
  const initial = (user.name ?? user.email).charAt(0).toUpperCase();

  return (
    <>
      <aside
        aria-label="Sidebar"
        style={{ width: collapsed ? WIDTH_COLLAPSED : WIDTH_EXPANDED }}
        className="fixed inset-y-0 left-0 z-20 hidden flex-col border-r border-separator bg-card transition-[width] duration-200 lg:flex"
      >
        <div className={`flex h-16 items-center gap-3 border-b border-separator ${collapsed ? "justify-center" : "px-5"}`}>
          <Image
            src="/logo-square.png"
            alt="Ilao's Microbakery"
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-lg"
          />
          {!collapsed && <span className="truncate text-[17px] font-semibold">Ilao&apos;s Microbakery</span>}
        </div>

        <nav aria-label="Main" className="flex-1 overflow-y-auto p-3">
          <ul className="flex flex-col gap-1">
            {tabs.map(({ key, href, label }) => {
              const Icon = NAV_ICONS[key] ?? LayoutDashboard;
              const active = isActive(href, pathname);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    prefetch
                    title={collapsed ? label : undefined}
                    aria-label={collapsed ? label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-10 items-center gap-3 rounded-lg text-[15px] font-medium transition-colors ${
                      collapsed ? "justify-center" : "px-3"
                    } ${active ? "bg-brand-tint text-brand" : "text-foreground hover:bg-fill"}`}
                  >
                    <Icon className="size-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-separator p-3">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className={`flex h-10 w-full items-center gap-3 rounded-lg text-[15px] font-medium text-label2 transition-colors hover:bg-fill ${
              collapsed ? "justify-center" : "px-3"
            }`}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-5" aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="size-5" aria-hidden />
                Collapse
              </>
            )}
          </button>
        </div>
      </aside>

      <div className="sticky top-0 z-10 hidden h-16 items-center justify-between gap-4 border-b border-separator bg-background/80 px-8 backdrop-blur-xl lg:flex">
        <h1 className="truncate text-[22px] font-semibold tracking-tight">{title}</h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="flex items-center gap-3 rounded-full border border-separator bg-card py-1 pr-1 pl-1">
            {user.image ? (
              <Image
                src={user.image}
                alt=""
                width={36}
                height={36}
                referrerPolicy="no-referrer"
                className="size-9 shrink-0 rounded-full"
              />
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-[15px] font-semibold text-white">
                {initial}
              </span>
            )}
            <div className="hidden min-w-0 max-w-48 xl:block">
              {user.name && <p className="truncate text-[13px] leading-4 font-medium">{user.name}</p>}
              <p className="truncate text-[13px] leading-4 text-label2">{user.email}</p>
            </div>
            <form action={logout}>
              <button
                aria-label="Sign out"
                title="Sign out"
                className="flex size-9 items-center justify-center rounded-full bg-fill text-brand transition hover:opacity-80"
              >
                <LogOut className="size-[18px]" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
