export type StarterMode = "standard" | "limited";

/** Raw text from the inputs, so half-typed values like "12." never get lost. */
export type StarterFields = {
  required: string; // starter the recipes need, in grams
  allowance: string; // extra starter to build on top, in grams
  starterPercent: string; // existing starter as a % of flour
  hydrationPercent: string; // water as a % of flour (also the hydration of the existing starter)
  availableStarter: string; // Limited Starter mode only, in grams
};

export type FieldName = keyof StarterFields;
export type FieldErrors = Partial<Record<FieldName, string>>;

export const STARTER_DEFAULTS: StarterFields = {
  required: "",
  allowance: "100",
  starterPercent: "60",
  hydrationPercent: "70",
  availableStarter: "",
};

const MAX_GRAMS = 100_000;
const MAX_PERCENT = 500;
/** Beyond 1 part starter to 10 parts flour, the starter is too dilute to ferment reliably. */
export const MIN_STARTER_PERCENT = 10;

/** Reads a decimal typed by the user. Returns null for anything that isn't a plain number. */
export function parseDecimal(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

type Rule = { min: "positive" | "zero"; max: number; label: string };

const RULES: Record<FieldName, Rule> = {
  required: { min: "positive", max: MAX_GRAMS, label: "Required starter" },
  allowance: { min: "zero", max: MAX_GRAMS, label: "Allowance" },
  starterPercent: { min: "positive", max: MAX_PERCENT, label: "Starter percentage" },
  hydrationPercent: { min: "positive", max: MAX_PERCENT, label: "Hydration" },
  availableStarter: { min: "positive", max: MAX_GRAMS, label: "Available starter" },
};

type Read = { kind: "empty" } | { kind: "error"; message: string } | { kind: "ok"; value: number };

function read(field: FieldName, raw: string): Read {
  if (raw.trim() === "") return { kind: "empty" };
  const rule = RULES[field];
  const n = parseDecimal(raw);
  if (n === null) return { kind: "error", message: "Enter a number." };
  if (n < 0) return { kind: "error", message: "Can't be negative." };
  if (rule.min === "positive" && n === 0) return { kind: "error", message: "Must be more than 0." };
  if (n > rule.max) return { kind: "error", message: `Must be ${rule.max.toLocaleString("en-US")} or less.` };
  return { kind: "ok", value: n };
}

export type Rounded = { starter: number; flour: number; water: number; total: number };

/**
 * Rounds the three ingredients to 0.1g so they add up to the rounded total exactly
 * (largest-remainder), instead of drifting by a tenth from independent rounding.
 */
export function roundToTenths(starter: number, flour: number, water: number): Rounded {
  const parts = [starter, flour, water].map((v) => v * 10);
  const totalTenths = Math.round(parts.reduce((a, b) => a + b, 0));
  const floors = parts.map((p) => Math.floor(p + 1e-9));
  let left = totalTenths - floors.reduce((a, b) => a + b, 0);
  const order = parts
    .map((p, i) => ({ i, frac: p - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  const [s, f, w] = floors.map((t) => t / 10);
  return { starter: s, flour: f, water: w, total: totalTenths / 10 };
}

export type StarterBuild = {
  status: "ok";
  mode: StarterMode;
  required: number;
  allowance: number;
  target: number; // required + allowance, full precision
  starter: number; // existing starter to use, full precision
  flour: number;
  water: number;
  /** Baker's percentages of flour. */
  starterPercent: number;
  hydrationPercent: number;
  /** Limited mode only: true when the starter % ends up below the configured standard. */
  belowStandard: boolean;
  /** True when starter : flour is more dilute than 1 : 10. */
  beyondMaxRatio: boolean;
  configuredStarterPercent: number | null;
  display: Rounded; // rounded to 0.1g, parts sum to the total
};

export type StarterResult =
  | { status: "waiting" } // a needed field is still empty; nothing to show yet
  | { status: "invalid"; errors: FieldErrors }
  | { status: "enough"; target: number; available: number } // Limited mode: no feeding needed
  | StarterBuild;

/**
 * Standard:  Flour = Target / (1 + StarterRatio + Hydration);  Starter = Flour x Ratio;  Water = Flour x Hydration
 * Limited:   Flour = (Target - Available) / (1 + Hydration);  Water = Flour x Hydration
 * All math keeps full precision; only `display` is rounded.
 */
export function calculateStarter(mode: StarterMode, fields: StarterFields): StarterResult {
  const names: FieldName[] = ["required", "allowance", "starterPercent", "hydrationPercent"];
  if (mode === "limited") names.push("availableStarter");

  const errors: FieldErrors = {};
  const values: Partial<Record<FieldName, number>> = {};
  const empty = new Set<FieldName>();

  for (const name of names) {
    const r = read(name, fields[name]);
    if (r.kind === "error") errors[name] = r.message;
    else if (r.kind === "empty") empty.add(name);
    else values[name] = r.value;
  }
  // A cleared allowance just means "no extra".
  if (empty.delete("allowance")) values.allowance = 0;
  // Limited mode only compares against the standard %, so it never blocks the result.
  if (mode === "limited") empty.delete("starterPercent");

  if (Object.keys(errors).length > 0) return { status: "invalid", errors };
  if (empty.size > 0) return { status: "waiting" };

  const required = values.required!;
  const allowance = values.allowance!;
  const hydration = values.hydrationPercent! / 100;
  const target = required + allowance;

  if (mode === "limited") {
    const available = values.availableStarter!;
    if (available >= target) return { status: "enough", target, available };

    const flour = (target - available) / (1 + hydration);
    const water = flour * hydration;
    const starterPercent = (available / flour) * 100;
    const configured = values.starterPercent ?? null;
    return {
      status: "ok",
      mode,
      required,
      allowance,
      target,
      starter: available,
      flour,
      water,
      starterPercent,
      hydrationPercent: values.hydrationPercent!,
      belowStandard: configured !== null && starterPercent < configured,
      beyondMaxRatio: starterPercent < MIN_STARTER_PERCENT - 1e-9,
      configuredStarterPercent: configured,
      display: roundToTenths(available, flour, water),
    };
  }

  const ratio = values.starterPercent! / 100;
  const flour = target / (1 + ratio + hydration);
  const starter = flour * ratio;
  const water = flour * hydration;
  return {
    status: "ok",
    mode,
    required,
    allowance,
    target,
    starter,
    flour,
    water,
    starterPercent: values.starterPercent!,
    hydrationPercent: values.hydrationPercent!,
    belowStandard: false,
    beyondMaxRatio: values.starterPercent! < MIN_STARTER_PERCENT - 1e-9,
    configuredStarterPercent: values.starterPercent!,
    display: roundToTenths(starter, flour, water),
  };
}

/** Starter : flour : water with starter as 1, e.g. "1 : 1.7 : 1.2". */
export function formatFeedingRatio(build: Pick<StarterBuild, "starter" | "flour" | "water">): string {
  const n = (v: number) => String(Math.round((v / build.starter) * 10) / 10);
  return `1 : ${n(build.flour)} : ${n(build.water)}`;
}

const grams = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const formatGrams1 = (g: number) => `${grams.format(g)}g`;
export const formatPercent1 = (p: number) => `${grams.format(p)}%`;

/** Sum of every "Starter" ingredient across the Recipe Calculator's cards. */
export function totalStarterGrams(
  cards: readonly { ingredients: readonly { name: string; grams: number }[] }[],
): number {
  return cards.reduce(
    (sum, card) =>
      sum +
      card.ingredients
        .filter((i) => i.name.trim().toLowerCase() === "starter")
        .reduce((s, i) => s + (Number.isFinite(i.grams) ? i.grams : 0), 0),
    0,
  );
}

export function formatFeedingText(build: StarterBuild): string {
  const d = build.display;
  return [
    `Starter feeding (${build.mode === "standard" ? "Standard feeding" : "Limited starter"})`,
    `Target starter: ${formatGrams1(d.total)}`,
    `(${formatGrams1(build.required)} needed + ${formatGrams1(build.allowance)} extra)`,
    "",
    `Existing starter: ${formatGrams1(d.starter)}`,
    `Flour: ${formatGrams1(d.flour)}`,
    `Water: ${formatGrams1(d.water)}`,
    "",
    `Feeding ratio (starter : flour : water): ${formatFeedingRatio(build)}`,
    `Starter ${formatPercent1(build.starterPercent)} · Flour 100.0% · Water ${formatPercent1(build.hydrationPercent)}`,
  ].join("\n");
}
