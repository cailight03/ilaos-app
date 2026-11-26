import { Minus, Plus, Trash2 } from "lucide-react";

type Props = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  /** Show a trash icon instead of minus when the next step would remove. */
  removable?: boolean;
  label?: string;
};

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 20,
  removable,
  label = "quantity",
}: Props) {
  const willRemove = removable && value <= min;
  const btn =
    "flex size-9 items-center justify-center rounded-full text-ink transition active:scale-90 disabled:opacity-30";

  return (
    <div className="inline-flex items-center rounded-full bg-chip p-0.5">
      <button
        type="button"
        className={btn}
        aria-label={willRemove ? `Remove ${label}` : `Decrease ${label}`}
        disabled={!removable && value <= min}
        onClick={() => onChange(value - 1)}
      >
        {willRemove ? (
          <Trash2 className="size-4 text-red-600" />
        ) : (
          <Minus className="size-4" />
        )}
      </button>
      <span
        className="w-8 text-center text-base font-semibold tabular-nums"
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        className={btn}
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
