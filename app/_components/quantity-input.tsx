"use client";

import { Minus, Plus } from "lucide-react";
import { MAX_QUANTITY, sanitizeQuantity } from "@/src/lib/recipe-calc";

export function QuantityInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const btn =
    "flex h-9 w-10 shrink-0 items-center justify-center text-brand transition active:bg-fill active:opacity-70 disabled:text-label2/40";

  return (
    <div className="flex min-h-14 items-center justify-between gap-3">
      <label htmlFor={id} className="min-w-0 flex-1 text-[17px] leading-snug">
        {label}
      </label>
      {/* iOS-style stepper: one rounded track holding − / value / + */}
      <div className="flex shrink-0 items-center overflow-hidden rounded-lg bg-fill">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          className={btn}
          disabled={value <= 0}
          onClick={() => onChange(sanitizeQuantity(value - 1))}
        >
          <Minus className="size-5" aria-hidden />
        </button>
        {/* text-base (16px) prevents iOS Safari from zooming on focus */}
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          enterKeyHint="done"
          value={value}
          onChange={(e) => onChange(sanitizeQuantity(e.target.value))}
          onFocus={(e) => e.target.select()}
          className="h-9 w-12 bg-transparent text-center text-base font-semibold tabular-nums outline-none focus-visible:bg-brand-tint"
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          className={btn}
          disabled={value >= MAX_QUANTITY}
          onClick={() => onChange(sanitizeQuantity(value + 1))}
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
