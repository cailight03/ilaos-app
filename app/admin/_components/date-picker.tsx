"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parse(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
}

function todayIso() {
  const t = new Date();
  return toIso(t.getFullYear(), t.getMonth(), t.getDate());
}

function formatLong(iso: string) {
  const p = parse(iso);
  if (!p) return "Select date";
  return new Date(p.y, p.m, p.d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Settings-style row that opens an iOS-style calendar popover. Value is a YYYY-MM-DD string. */
export function DatePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const initial = parse(value) ?? parse(todayIso())!;
  const [view, setView] = useState({ y: initial.y, m: initial.m });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      const p = parse(value) ?? parse(todayIso())!;
      setDraft(value);
      setView({ y: p.y, m: p.m });
    }
    setOpen((o) => !o);
  }

  function shift(delta: number) {
    setView(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const today = todayIso();
  const monthTitle = new Date(view.y, view.m, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div ref={rootRef} className={`relative ${open ? "z-30" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-separator bg-card px-3.5 text-left shadow-sm transition active:bg-fill"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-brand text-white">
          <CalendarDays className="size-4" aria-hidden />
        </span>
        <span className="text-[17px]">{label}</span>
        <span className="ml-auto rounded-lg bg-fill px-3 py-1 text-[17px] text-brand">
          {formatLong(value)}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`Choose ${label.toLowerCase()}`}
          className="absolute top-full right-0 left-0 mt-2 origin-bottom animate-ios-pop rounded-2xl border border-separator bg-card/95 p-4 shadow-md backdrop-blur-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[17px] font-semibold">{monthTitle}</p>
            <div className="flex items-center gap-1 text-brand">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => shift(-1)}
                className="flex size-9 items-center justify-center rounded-full transition active:bg-fill"
              >
                <ChevronLeft className="size-6" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => shift(1)}
                className="flex size-9 items-center justify-center rounded-full transition active:bg-fill"
              >
                <ChevronRight className="size-6" aria-hidden />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className="pb-1 text-[11px] font-semibold text-label2">
                {w}
              </span>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <span key={`b${i}`} />;
              const iso = toIso(view.y, view.m, d);
              const selected = iso === draft;
              const isToday = iso === today;
              return (
                <button
                  key={iso}
                  type="button"
                  aria-label={formatLong(iso)}
                  aria-pressed={selected}
                  onClick={() => setDraft(iso)}
                  className={`mx-auto flex size-10 items-center justify-center rounded-full text-[20px] tabular-nums transition active:scale-90 ${
                    selected
                      ? "bg-brand font-semibold text-white"
                      : isToday
                        ? "font-semibold text-brand"
                        : ""
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-separator pt-3 text-[17px] text-brand">
            <button
              type="button"
              onClick={() => {
                setDraft(today);
                const p = parse(today)!;
                setView({ y: p.y, m: p.m });
              }}
              className="transition active:opacity-50"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(draft);
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className="font-semibold transition active:opacity-50"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
