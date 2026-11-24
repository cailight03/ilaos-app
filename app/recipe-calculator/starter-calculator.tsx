"use client";

import { useState } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import {
  STARTER_DEFAULTS,
  calculateStarter,
  formatFeedingRatio,
  formatFeedingText,
  formatGrams1,
  formatPercent1,
  type FieldName,
  type StarterFields,
  type StarterMode,
} from "@/src/lib/starter-calc";

/** Bumping `nonce` replaces the required-starter field with `grams`. */
export type StarterRequest = { grams: number; nonce: number };

const MODES: { id: StarterMode; label: string }[] = [
  { id: "standard", label: "Standard Feeding" },
  { id: "limited", label: "Limited Starter" },
];

function toField(grams: number): string {
  return String(Math.round(grams * 10) / 10);
}

export function StarterCalculator({ request }: { request: StarterRequest | null }) {
  const [mode, setMode] = useState<StarterMode>("standard");
  const [fields, setFields] = useState<StarterFields>(STARTER_DEFAULTS);
  const [copied, setCopied] = useState<"ok" | "error" | null>(null);
  const [seenNonce, setSeenNonce] = useState<number | null>(request?.nonce ?? null);

  // Adopt a new request from the Recipe Calculator while rendering (no effect needed).
  if (request && request.nonce !== seenNonce) {
    setSeenNonce(request.nonce);
    setFields((f) => ({ ...f, required: toField(request.grams) }));
    setCopied(null);
  }

  const result = calculateStarter(mode, fields);
  const errors = result.status === "invalid" ? result.errors : {};

  function set(name: FieldName, value: string) {
    setFields((f) => ({ ...f, [name]: value }));
    setCopied(null);
  }

  async function copy() {
    if (result.status !== "ok") return;
    try {
      await navigator.clipboard.writeText(formatFeedingText(result));
      setCopied("ok");
    } catch {
      setCopied("error");
    }
  }

  const secondary =
    "flex h-11 items-center justify-center gap-2 rounded-xl bg-card text-[17px] font-medium text-brand shadow-sm ring-1 ring-separator transition active:scale-[0.97] active:opacity-70 disabled:text-label2/50 disabled:active:scale-100";

  const field = (name: FieldName, id: string, label: string, unit: string, hint?: string) => (
    <div className="py-2.5">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <label htmlFor={id} className="min-w-0 flex-1 text-[17px] leading-snug">
          {label}
          {hint && <span className="block text-[13px] text-label2">{hint}</span>}
        </label>
        <div className="flex shrink-0 items-center overflow-hidden rounded-lg bg-fill">
          {/* text-base (16px) prevents iOS Safari from zooming on focus */}
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="0"
            value={fields[name]}
            aria-invalid={errors[name] ? true : undefined}
            aria-describedby={errors[name] ? `${id}-err` : undefined}
            onChange={(e) => set(name, e.target.value)}
            onFocus={(e) => e.target.select()}
            className="h-9 w-20 bg-transparent px-2 text-right text-base font-semibold tabular-nums outline-none focus-visible:bg-brand-tint"
          />
          <span className="pr-3 text-[15px] text-label2">{unit}</span>
        </div>
      </div>
      {errors[name] && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-right text-[13px] text-red-600">
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <section id="starter-calculator" aria-labelledby="starter-heading" className="flex scroll-mt-4 flex-col gap-3">
      <div className="px-4">
        <h2 id="starter-heading" className="text-[22px] font-bold tracking-tight">
          Starter calculator
        </h2>
        <p className="text-[13px] text-label2">Works on its own, or fed from the recipes above.</p>
      </div>

      <div role="tablist" aria-label="Feeding mode" className="grid grid-cols-2 gap-1 rounded-xl bg-fill p-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`h-9 rounded-lg text-[15px] font-semibold transition ${
              mode === m.id ? "bg-card text-label shadow-sm" : "text-label2"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="divide-y divide-separator rounded-xl border border-separator bg-card px-4 shadow-sm">
        {field("required", "st-required", "Required starter", "g", "What your recipes need")}
        {field("allowance", "st-allowance", "Allowance", "g", "Extra left over for your jar")}
        {mode === "limited" &&
          field("availableStarter", "st-available", "Available starter", "g", "Exactly what you have")}
        {field(
          "starterPercent",
          "st-percent",
          mode === "limited" ? "Standard starter" : "Starter",
          "%",
          mode === "limited" ? "Used only to compare" : "Of flour weight",
        )}
        {field("hydrationPercent", "st-hydration", "Hydration", "%", "Water, and your starter's own")}
      </div>

      <Results result={result} mode={mode} />

      {copied && (
        <p
          role={copied === "error" ? "alert" : "status"}
          className={`rounded-xl border p-3.5 text-[15px] ${
            copied === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-600"
              : "border-green-500/30 bg-green-500/10 text-green-700"
          }`}
        >
          {copied === "error" ? "Couldn't copy. Please try again." : "Feeding recipe copied to clipboard."}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className={secondary}
          onClick={() => {
            setFields(STARTER_DEFAULTS);
            setMode("standard");
            setCopied(null);
          }}
        >
          <RotateCcw className="size-[18px]" aria-hidden />
          Reset
        </button>
        <button type="button" className={secondary} disabled={result.status !== "ok"} onClick={copy}>
          {copied === "ok" ? <Check className="size-[18px]" aria-hidden /> : <Copy className="size-[18px]" aria-hidden />}
          Copy feeding
        </button>
      </div>
    </section>
  );
}

function Results({ result, mode }: { result: ReturnType<typeof calculateStarter>; mode: StarterMode }) {
  const box = "rounded-xl border border-separator bg-card p-4 text-[15px] text-label2 shadow-sm";

  if (result.status === "waiting") {
    return (
      <p className={box} aria-live="polite">
        {mode === "limited"
          ? "Enter the starter you need and the amount you have to see the feeding."
          : "Enter the starter you need to see the feeding."}
      </p>
    );
  }
  if (result.status === "invalid") {
    return (
      <p className={box} aria-live="polite">
        Fix the highlighted fields to see the feeding.
      </p>
    );
  }
  if (result.status === "enough") {
    return (
      <p
        role="status"
        className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-[15px] text-green-700"
      >
        No additional feeding is necessary. You have {formatGrams1(result.available)} and need{" "}
        {formatGrams1(result.target)}.
      </p>
    );
  }

  const d = result.display;
  const rows: [string, string][] = [
    [mode === "limited" ? "Your starter" : "Existing starter", formatGrams1(d.starter)],
    ["Flour", formatGrams1(d.flour)],
    ["Water", formatGrams1(d.water)],
  ];

  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <div className="overflow-hidden rounded-xl border border-separator bg-card shadow-sm">
        <table className="w-full text-[17px]">
          <tbody>
            {rows.map(([name, value]) => (
              <tr key={name} className="border-b border-separator">
                <td className="py-3 pl-4">{name}</td>
                <td className="py-3 pr-4 text-right font-semibold text-label2 tabular-nums">{value}</td>
              </tr>
            ))}
            <tr className="bg-brand-tint">
              <td className="py-3 pl-4 font-semibold">Total starter</td>
              <td className="py-3 pr-4 text-right text-[19px] font-bold text-brand tabular-nums">
                {formatGrams1(d.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-separator bg-card p-4 shadow-sm">
        <p className="text-[13px] text-label2">Feeding ratio (starter : flour : water)</p>
        <p className="text-[19px] font-semibold tabular-nums">{formatFeedingRatio(result)}</p>
        <p className="mt-1 text-[13px] text-label2 tabular-nums">
          Starter {formatPercent1(result.starterPercent)} · Flour 100.0% · Water{" "}
          {formatPercent1(result.hydrationPercent)}
        </p>
      </div>

      {result.beyondMaxRatio && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-[15px] text-red-600">
          Warning: the maximum ratio is 1:10 starter to flour. This feeding is 1:{Math.round((result.flour / result.starter) * 10) / 10}, which
          is too dilute. Use more starter or less flour.
        </p>
      )}

      {mode === "limited" && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-[15px] text-amber-700">
          {result.belowStandard
            ? `This feeding uses ${formatPercent1(result.starterPercent)} starter, below your standard ${formatPercent1(result.configuredStarterPercent ?? 0)}. A lower starter percentage may need a longer fermentation time. Timing depends on temperature and starter activity, so watch the starter rather than the clock.`
            : "A lower starter percentage may need a longer fermentation time. Timing depends on temperature and starter activity, so watch the starter rather than the clock."}
        </p>
      )}
    </div>
  );
}
