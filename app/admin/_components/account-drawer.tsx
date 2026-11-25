"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, LayoutDashboard, LogOut, ScrollText, User, X } from "lucide-react";
import { logout } from "../login/actions";
import { NAV_ICONS, type NavTab } from "./nav-icons";

export type DrawerUser = { name: string | null; email: string; image: string | null; role: string };

const ROLE_LABELS: Record<string, string> = { owner: "Owner", admin: "Administrator", staff: "Staff" };
const ADMIN_KEYS = ["audit-log", "users"];
const SWIPE_CLOSE_PX = 80;

function Row({ tab, active, onSelect }: { tab: NavTab; active: boolean; onSelect: () => void }) {
  const Icon = tab.key === "audit-log" ? ScrollText : (NAV_ICONS[tab.key] ?? LayoutDashboard);
  return (
    <li>
      <Link
        href={tab.href}
        onClick={onSelect}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[17px] transition-colors active:bg-fill ${
          active ? "bg-brand-tint font-medium text-brand" : "text-foreground"
        }`}
      >
        <Icon className="size-5 shrink-0 text-brand" strokeWidth={1.75} aria-hidden />
        <span className="flex-1 truncate">{tab.label}</span>
        <ChevronRight className="size-4 text-label2" aria-hidden />
      </Link>
    </li>
  );
}

/** Right-hand slide-in account drawer (mobile). Always mounted so it can animate both ways. */
export function AccountDrawer({
  open,
  onClose,
  tabs,
  user,
  isActive,
}: {
  open: boolean;
  onClose: () => void;
  tabs: NavTab[];
  user: DrawerUser;
  isActive: (href: string) => boolean;
}) {
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);

  // Lock background scroll and allow Escape while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const workspace = tabs.filter((t) => !ADMIN_KEYS.includes(t.key));
  const admin = tabs.filter((t) => ADMIN_KEYS.includes(t.key));
  const dragging = startX.current !== null;

  return (
    <div className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Account"
        inert={!open}
        onTouchStart={(e) => {
          startX.current = e.touches[0].clientX;
        }}
        onTouchMove={(e) => {
          if (startX.current === null) return;
          setDragX(Math.max(0, e.touches[0].clientX - startX.current));
        }}
        onTouchEnd={() => {
          if (dragX > SWIPE_CLOSE_PX) onClose();
          startX.current = null;
          setDragX(0);
        }}
        style={{ transform: open ? `translateX(${dragX}px)` : "translateX(100%)" }}
        className={`absolute inset-y-0 right-0 flex w-[85%] max-w-sm flex-col border-l border-separator bg-card pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ${
          dragging ? "" : "transition-transform duration-300 ease-out"
        }`}
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-[20px] font-semibold">Account</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 items-center justify-center rounded-full bg-fill text-label2 active:opacity-70"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="flex items-center gap-3 border-b border-separator px-5 py-4">
          {user.image ? (
            <Image
              src={user.image}
              alt=""
              width={52}
              height={52}
              referrerPolicy="no-referrer"
              className="size-[52px] shrink-0 rounded-full"
            />
          ) : (
            <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
              <User className="size-6" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold">{user.name ?? user.email}</p>
            {user.name && <p className="truncate text-[13px] text-label2">{user.email}</p>}
            <p className="truncate text-[13px] text-label2">{ROLE_LABELS[user.role] ?? user.role}</p>
          </div>
        </div>

        <nav aria-label="Account menu" className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          <p className="px-3 pb-1 text-[13px] text-label2">Workspace</p>
          <ul>
            {workspace.map((t) => (
              <Row key={t.key} tab={t} active={isActive(t.href)} onSelect={onClose} />
            ))}
          </ul>
          {admin.length > 0 && (
            <>
              <div className="mx-3 my-3 border-t border-separator" />
              <p className="px-3 pb-1 text-[13px] text-label2">Administration</p>
              <ul>
                {admin.map((t) => (
                  <Row key={t.key} tab={t} active={isActive(t.href)} onSelect={onClose} />
                ))}
              </ul>
            </>
          )}
        </nav>

        <form action={logout} className="border-t border-separator p-3">
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-[17px] font-medium text-red-500 active:bg-fill"
          >
            <LogOut className="size-5" aria-hidden />
            Log out
          </button>
        </form>
      </aside>
    </div>
  );
}
