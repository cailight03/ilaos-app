import { Check } from "lucide-react";
import { STEPS } from "./steps";

export function CheckoutProgress({ current }: { current: number }) {
  return (
    <nav aria-label="Checkout progress" className="mx-auto max-w-xl px-5 pb-3 pt-5">
      <ol className="flex items-start">
        {STEPS.map((s, i) => {
          const done = i < current || current === STEPS.length - 1;
          const active = i === current;
          return (
            <li key={s.href} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-center">
                <div
                  className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${
                    i === 0 ? "invisible" : i <= current ? "bg-royal" : "bg-ink/15"
                  }`}
                />
                <span
                  aria-current={active ? "step" : undefined}
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-300 ${
                    done
                      ? "bg-royal text-white"
                      : active
                        ? "bg-royal text-white ring-4 ring-royal/20"
                        : "bg-chip text-ink-muted"
                  }`}
                >
                  {done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                </span>
                <div
                  className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${
                    i === STEPS.length - 1 ? "invisible" : i < current ? "bg-royal" : "bg-ink/15"
                  }`}
                />
              </div>
              <span className={`text-xs ${active ? "font-semibold text-royal" : "text-ink-muted"}`}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
