import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

type Props = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: (p: { id: string; className: string; "aria-invalid": boolean; "aria-describedby": string }) => ReactNode;
};

export function Field({ id, label, error, hint, optional, children }: Props) {
  const descId = `${id}-desc`;
  const className = `w-full rounded-xl bg-cream px-4 py-3 text-base outline-none ring-1 transition placeholder:text-ink-muted/60 focus:ring-2 ${
    error ? "ring-red-500 focus:ring-red-500" : "ring-ink/10 focus:ring-royal"
  }`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between text-sm font-semibold">
        {label}
        {optional && <span className="font-normal text-ink-muted">Optional</span>}
      </label>
      {children({ id, className, "aria-invalid": !!error, "aria-describedby": descId })}
      <div id={descId}>
        {error ? (
          <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </p>
        ) : hint ? (
          <p className="mt-1.5 text-sm text-ink-muted">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
