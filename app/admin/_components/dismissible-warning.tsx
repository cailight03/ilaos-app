"use client";

import { useState, type ReactNode } from "react";
import { TriangleAlert, X } from "lucide-react";

export function DismissibleWarning({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-xl border border-ios-orange/30 bg-ios-orange/10 py-3.5 pr-2 pl-3.5 text-[13px] leading-snug"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-ios-orange" aria-hidden />
      <p className="min-w-0 flex-1">{children}</p>
      <button
        type="button"
        aria-label="Dismiss warning"
        onClick={() => setHidden(true)}
        className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-label2 transition active:scale-90 active:bg-fill"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
