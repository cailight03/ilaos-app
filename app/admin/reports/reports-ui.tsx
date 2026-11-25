export function Section({
  title,
  aside,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className={className}>
      <div className="mb-1.5 flex items-baseline justify-between px-4">
        <h2 className="text-[13px] text-label2 uppercase">{title}</h2>
        {aside}
      </div>
      <div className="overflow-hidden rounded-xl border border-separator bg-card shadow-sm">{children}</div>
    </section>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-[9px] bg-fill p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-8 flex-1 rounded-[7px] px-2 text-[13px] font-medium transition ${
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-label2"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
