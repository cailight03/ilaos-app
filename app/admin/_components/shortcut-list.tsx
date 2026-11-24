import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

export type ShortcutItem = {
  label: string;
  Icon: LucideIcon;
  href?: string; // omitted = not available yet
};

export function ShortcutList({ items }: { items: ShortcutItem[] }) {
  return (
    <section aria-label="Shortcuts" className="overflow-hidden rounded-xl border border-separator bg-card shadow-sm">
      <ul>
        {items.map(({ label, Icon, href }) => {
          const inner = (
            <>
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-[7px] ${
                  href ? "bg-brand text-white" : "bg-fill text-label2"
                }`}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="flex min-h-11 flex-1 items-center justify-between border-b border-separator pr-3 text-[17px] group-last/row:border-b-0">
                {label}
                {href ? (
                  <ChevronRight className="size-[18px] text-label2/70" aria-hidden />
                ) : (
                  <span className="text-[15px] text-label2">Coming soon</span>
                )}
              </span>
            </>
          );
          return (
            <li key={label} className="group/row">
              {href ? (
                <Link href={href} className="flex items-center gap-3 pl-4 transition-colors hover:bg-fill active:bg-fill">
                  {inner}
                </Link>
              ) : (
                <div className="flex items-center gap-3 pl-4 text-label2" aria-disabled>
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
