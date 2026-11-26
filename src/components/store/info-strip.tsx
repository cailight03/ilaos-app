import { CalendarDays, Wallet, Bike } from "lucide-react";

const INFO = [
  { icon: CalendarDays, title: "Bake Day", sub: "Sundays" },
  { icon: Bike, title: "Pickup", sub: "Self or Lalamove" },
  { icon: Wallet, title: "Payment", sub: "GCash only" },
];

export function InfoStrip() {
  return (
    <section className="mx-auto max-w-3xl px-5 pt-2 sm:px-8">
      <dl className="grid grid-cols-3 divide-x divide-ink/10">
        {INFO.map(({ icon: Icon, title, sub }) => (
          <div key={title} className="flex flex-col items-center gap-1.5 px-2 text-center">
            <Icon className="size-7 text-ink" strokeWidth={1.5} />
            <dt className="text-base font-semibold">{title}</dt>
            <dd className="text-sm text-ink-muted sm:text-base">{sub}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
