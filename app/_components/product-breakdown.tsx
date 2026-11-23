const EMOJI: [RegExp, string][] = [
  [/jalape/i, "🌶️"],
  [/tomato/i, "🍅"],
  [/rosemary/i, "🌿"],
  [/wheat|multi/i, "🌾"],
  [/sourdough/i, "🍞"],
];

function emojiFor(name: string) {
  return EMOJI.find(([re]) => re.test(name))?.[1] ?? "🥖";
}

export function ProductBreakdown({ items }: { items: Record<string, number> }) {
  const entries = Object.entries(items);
  const total = entries.reduce((sum, [, qty]) => sum + qty, 0);

  return (
    <section aria-labelledby="products-heading">
      <div className="mb-1.5 flex items-baseline justify-between px-4">
        <h2 id="products-heading" className="text-[13px] text-label2">
          Products to bake
        </h2>
        <span className="text-[13px] text-label2 tabular-nums">{total.toLocaleString()} total</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-separator bg-card shadow-sm">
        {total === 0 ? (
          <p className="px-4 py-6 text-center text-[15px] text-label2">No orders for this date.</p>
        ) : (
          <ul>
            {entries.map(([name, qty]) => (
              <li key={name} className="group/row flex items-center gap-3 pl-4">
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-fill text-[17px] leading-none"
                >
                  {emojiFor(name)}
                </span>
                <div className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 border-b border-separator pr-4 text-[17px] group-last/row:border-b-0">
                  <span className="truncate">{name}</span>
                  <span
                    className={`tabular-nums ${qty > 0 ? "font-semibold text-brand" : "text-label2"}`}
                  >
                    {qty}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
