"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";

export type DropdownOption = { value: string; label: string; description?: string };

/**
 * Popover menu with radio-style options. `children` is the trigger's content and
 * receives no styling, so callers decide whether it looks like a row or a button.
 */
export function Dropdown({
  title,
  value,
  options,
  onChange,
  disabled,
  triggerClassName,
  ariaLabel,
  children,
}: {
  title: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  triggerClassName?: string;
  ariaLabel: string;
  children: (state: { open: boolean; current: string }) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const current = options.find((o) => o.value === value)?.label ?? options[0]?.label ?? "";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    // Move focus to the selected option so keyboard users land in the menu.
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.key === "ArrowDown" ? i + 1 : i - 1;
      items[(next + items.length) % items.length]?.focus();
    }
  }

  return (
    <div ref={rootRef} className={`relative ${open ? "z-30" : ""}`} onKeyDown={open ? onKeyDown : undefined}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {children({ open, current })}
      </button>

      {open && (
        <div
          className="absolute top-full right-0 left-0 mt-2 origin-bottom animate-ios-pop rounded-2xl border border-separator bg-card/95 p-2 shadow-md backdrop-blur-xl"
        >
          <p id={titleId} className="px-3 pt-2 pb-1 text-[13px] text-label2">
            {title}
          </p>
          <div
            ref={listRef}
            role="listbox"
            aria-labelledby={titleId}
            className="max-h-72 overflow-y-auto overscroll-contain"
          >
            {options.map((o) => {
              const selected = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(o.value);
                    close();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors outline-none focus-visible:bg-fill active:bg-fill"
                >
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
                      selected ? "border-brand bg-brand text-white" : "border-label2/70"
                    }`}
                    aria-hidden
                  >
                    {selected && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[17px] leading-snug">{o.label}</span>
                    {o.description && (
                      <span className="block truncate text-[13px] text-label2">{o.description}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
