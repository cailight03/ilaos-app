import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-separator bg-card p-4 shadow-sm">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-tint text-brand">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <p className="mt-3 text-[28px] leading-8 font-bold tracking-tight tabular-nums">{value}</p>
      <p className="mt-0.5 text-[15px] text-label2">{label}</p>
    </div>
  );
}
