"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

const EXIT_MS = 220;

type Props = {
  title: string;
  onClose: () => void;
  children: (close: () => void) => ReactNode;
  /** Visually hides the title but keeps it for screen readers. */
  hideTitle?: boolean;
};

/**
 * iOS-style bottom sheet (centered dialog on large screens). Mount it only
 * while open; it animates out before calling `onClose`.
 */
export function BottomSheet({ title, onClose, children, hideTitle }: Props) {
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, EXIT_MS);
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

  const onPointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startY.current === null) return;
    setDragY(Math.max(0, e.clientY - startY.current));
  };
  const onPointerUp = () => {
    if (startY.current === null) return;
    startY.current = null;
    setDragging(false);
    if (dragY > 100) close();
    else setDragY(0);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={close}
        className="absolute inset-0 bg-black/40"
        style={{
          animation: `${closing ? "store-fade-out" : "store-fade"} ${EXIT_MS}ms ease both`,
        }}
      />
      <div
        className="relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl bg-cream text-ink sm:rounded-3xl"
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? "none" : "transform 0.2s ease",
          animation: closing
            ? `sheet-down ${EXIT_MS}ms cubic-bezier(0.32,0.72,0,1) both`
            : "sheet-up 0.32s cubic-bezier(0.32,0.72,0,1) both",
        }}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none flex-col items-center pt-2.5 sm:hidden"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="h-1.5 w-10 rounded-full bg-ink/20" />
          <div className="h-3" />
        </div>
        <div
          className={
            hideTitle
              ? "absolute right-4 top-4 z-10 sm:top-4"
              : "flex shrink-0 items-center justify-between px-5 pb-3 sm:pt-5"
          }
        >
          {!hideTitle && (
            <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          )}
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className={`flex size-8 items-center justify-center rounded-full text-ink transition-colors active:scale-95 ${
              hideTitle ? "bg-white/85 hover:bg-white" : "bg-ink/10 hover:bg-ink/15"
            }`}
          >
            <X className="size-4" />
          </button>
        </div>
        {hideTitle && <h2 className="sr-only">{title}</h2>}
        {children(close)}
      </div>
    </div>
  );
}
