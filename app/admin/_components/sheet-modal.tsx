"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Bottom sheet on the native <dialog>, matching the order details sheet: slides up from the bottom
 * (centered on desktop), blurred backdrop, focus trap, Esc and backdrop click to close.
 * Pass dismissible={false} while work is in flight to block closing.
 */
export function SheetModal({
  title,
  onClose,
  dismissible = true,
  children,
}: {
  title: string;
  onClose: () => void;
  dismissible?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // Slide down first; onClose runs when that animation ends.
  const requestClose = () => {
    if (dismissible) setClosing(true);
  };

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onAnimationEnd={(e) => {
        if (closing && e.target === ref.current) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) requestClose();
      }}
      aria-label={title}
      className={`m-0 mt-auto w-full max-w-none overscroll-contain bg-transparent p-0 backdrop:bg-black/40 backdrop:backdrop-blur-[2px] backdrop:transition-opacity backdrop:duration-150 lg:m-auto lg:w-full lg:max-w-md ${
        closing
          ? "animate-[sheet-down_160ms_cubic-bezier(0.4,0,1,1)_forwards] backdrop:opacity-0"
          : "open:animate-[sheet-up_300ms_cubic-bezier(0.22,1,0.36,1)]"
      }`}
    >
      <div className="mx-auto flex max-h-[88dvh] w-full max-w-md flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-[20px] bg-background px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-foreground lg:rounded-[20px]">
        <div className="mx-auto h-1 w-9 shrink-0 rounded-full bg-label2/40" aria-hidden />
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-[28px] leading-9 font-bold tracking-tight">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={requestClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fill text-label2 transition active:scale-90"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
