"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CalendarDays, ChevronsUpDown, RefreshCw } from "lucide-react";
import { Dropdown } from "./dropdown";

export function BakeDateFilter({
  dates,
  value,
}: {
  dates: string[];
  value: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Dropdown
      title="Bake date"
      ariaLabel="Bake date"
      value={value ?? ""}
      options={[
        { value: "", label: "All dates" },
        ...[...dates].reverse().map((d) => ({ value: d, label: formatDate(d) })),
      ]}
      disabled={pending}
      onChange={(v) => start(() => router.push(`/admin?bakeDate=${v || "all"}`))}
      triggerClassName={`flex min-h-11 w-full items-center gap-3 rounded-xl border border-separator bg-card px-3.5 text-left shadow-sm transition active:bg-fill ${
        pending ? "opacity-60" : ""
      }`}
    >
      {({ current }) => (
        <>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-brand text-white">
            <CalendarDays className="size-4" aria-hidden />
          </span>
          <span className="shrink-0 whitespace-nowrap text-[17px]">Bake date</span>
          <span className="ml-auto flex min-w-0 items-center gap-1 text-[17px] text-label2">
            <span className="truncate">{current}</span>
            <ChevronsUpDown className="size-4 shrink-0" aria-hidden />
          </span>
        </>
      )}
    </Dropdown>
  );
}

export function RefreshButton({ variant = "icon" }: { variant?: "icon" | "solid" }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const spinner = (
    <RefreshCw className={`size-5 ${pending ? "animate-spin" : ""}`} aria-hidden />
  );

  if (variant === "solid") {
    return (
      <button
        type="button"
        onClick={() => start(() => router.refresh())}
        disabled={pending}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-[17px] font-semibold text-white transition active:scale-[0.97] active:opacity-80 disabled:opacity-60"
      >
        {spinner}
        {pending ? "Refreshing…" : "Try again"}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={pending ? "Refreshing" : "Refresh data"}
      onClick={() => start(() => router.refresh())}
      disabled={pending}
      className="flex size-11 items-center justify-center rounded-full bg-card text-brand shadow-sm ring-1 ring-separator transition active:scale-90 active:opacity-70 disabled:opacity-60"
    >
      {spinner}
    </button>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
