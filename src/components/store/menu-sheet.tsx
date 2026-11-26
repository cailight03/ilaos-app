"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Lock, X } from "lucide-react";

const EXIT_MS = 240;

const LINKS = [
  { id: "top", label: "Home" },
  { id: "bakes", label: "Our Bakes" },
  { id: "order", label: "Order" },
];

/** Right-hand slide-in navigation drawer. Mount only while open. */
export function MenuSheet({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const [closing, setClosing] = useState(false);

  const close = (after?: () => void) => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      onClose();
      after?.();
    }, EXIT_MS);
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
      <div
        onClick={() => close()}
        className="absolute inset-0 bg-black/40"
        style={{
          animation: `${closing ? "store-fade-out" : "store-fade"} ${EXIT_MS}ms ease both`,
        }}
      />
      <aside
        className="absolute inset-y-0 right-0 flex w-[82%] max-w-sm flex-col bg-cream pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-6 pr-5 pt-[max(1rem,env(safe-area-inset-top))] text-ink"
        style={{
          animation: `${closing ? "store-drawer-out" : "store-drawer-in"} ${EXIT_MS}ms cubic-bezier(0.32,0.72,0,1) both`,
        }}
      >
        <div className="flex h-14 items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Menu</h2>
          <button
            type="button"
            onClick={() => close()}
            aria-label="Close menu"
            className="flex size-9 items-center justify-center rounded-full bg-ink/10 transition active:scale-90"
          >
            <X className="size-4" />
          </button>
        </div>
        <nav className="mt-2 flex-1">
          <ul className="divide-y divide-ink/10">
            {LINKS.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => close(() => onNavigate(l.id))}
                  className="flex w-full items-center justify-between py-4 text-lg font-semibold"
                >
                  {l.label}
                  <ChevronRight className="size-5 text-ink-muted" />
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <a href="/admin" className="flex items-center gap-2 text-sm text-ink-muted">
          <Lock className="size-3.5" /> Staff login
        </a>
      </aside>
    </div>
  );
}
