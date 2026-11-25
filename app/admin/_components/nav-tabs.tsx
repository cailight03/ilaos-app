"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { LayoutDashboard, User } from "lucide-react";
import { AccountDrawer, type DrawerUser } from "./account-drawer";
import { NAV_ICONS, type NavTab } from "./nav-icons";

export { NAV_ICONS, type NavTab };

/** Modules pinned to the bottom bar; everything else lives in the account drawer. */
const BOTTOM_KEYS = ["dashboard", "orders", "recipe_calculator", "sales_reports"];

const itemClass =
  "flex min-h-[49px] w-full flex-col items-center justify-center gap-0.5 pt-1 text-[10px] font-medium transition-[color,transform] duration-150 active:scale-95";

export function NavTabs({ tabs, user }: { tabs: NavTab[]; user: DrawerUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (pathname === "/admin/login") return null;

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const bottom = BOTTOM_KEYS.map((k) => tabs.find((t) => t.key === k)).filter((t): t is NavTab => !!t);

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-separator bg-card/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
      >
        <ul className="mx-auto flex max-w-md">
          {bottom.map(({ key, href, label }) => {
            const Icon = NAV_ICONS[key] ?? LayoutDashboard;
            const active = isActive(href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  prefetch
                  aria-current={active ? "page" : undefined}
                  className={`${itemClass} ${active ? "text-brand" : "text-label2"}`}
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
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={open}
              className={`${itemClass} ${open ? "text-brand" : "text-label2"}`}
            >
              {user.image ? (
                <Image
                  src={user.image}
                  alt=""
                  width={24}
                  height={24}
                  referrerPolicy="no-referrer"
                  className={`size-6 rounded-full ${open ? "ring-2 ring-brand" : ""}`}
                />
              ) : (
                <User className="size-6" strokeWidth={open ? 2.25 : 1.75} aria-hidden />
              )}
              Account
            </button>
          </li>
        </ul>
      </nav>
      <AccountDrawer open={open} onClose={close} tabs={tabs} user={user} isActive={isActive} />
    </>
  );
}
