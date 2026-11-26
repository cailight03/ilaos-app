import type { ReactNode } from "react";

/** Fixed bottom action bar; respects the iOS home-indicator safe area. */
export function StickyAction({
  label,
  total,
  children,
}: {
  label?: string;
  total?: string;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-cream pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 sm:px-6">
        {total && (
          <div className="shrink-0 leading-tight">
            <p className="text-sm text-ink-muted">{label ?? "Total"}</p>
            <p className="text-xl font-bold tabular-nums">{total}</p>
          </div>
        )}
        <div className="flex min-w-0 flex-1 justify-end [&>*]:w-full sm:[&>*]:max-w-sm">{children}</div>
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className="flex items-center justify-center gap-2 rounded-full bg-royal py-4 text-lg font-semibold text-white transition hover:bg-royal-dark active:scale-[0.98] disabled:opacity-60"
    >
      {loading && (
        <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {children}
    </button>
  );
}
