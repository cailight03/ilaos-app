export const UNITS = ["g", "kg", "ml", "L", "pcs"] as const;
export type Unit = (typeof UNITS)[number];
export type BaseUnit = "g" | "ml" | "pcs";

const FACTOR: Record<Unit, number> = { g: 1, kg: 1000, ml: 1, L: 1000, pcs: 1 };
const BASE: Record<Unit, BaseUnit> = { g: "g", kg: "g", ml: "ml", L: "ml", pcs: "pcs" };

export const isUnit = (v: unknown): v is Unit =>
  typeof v === "string" && (UNITS as readonly string[]).includes(v);

export const baseUnitOf = (unit: Unit): BaseUnit => BASE[unit];

/** Converts a quantity in `unit` to its base unit (kg -> g, L -> ml). */
export const toBaseQuantity = (quantity: number, unit: Unit): number => quantity * FACTOR[unit];

/** Price per base unit (g, ml or pcs), or null when the inputs aren't a valid quantity and price. */
export function costPerBaseUnit(quantity: number, unit: Unit, price: number): number | null {
  if (!Number.isFinite(quantity) || !Number.isFinite(price) || quantity <= 0 || price < 0) return null;
  return price / (quantity * FACTOR[unit]);
}

/** Parses user input like "1,250.50"; returns NaN when empty or not a number. */
export function parseAmount(raw: string): number {
  const s = raw.replace(/,/g, "").trim();
  return s === "" ? NaN : Number(s);
}

const peso = (maxDigits: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDigits,
  });

/** Unit cost for display: up to 4 decimals, never fewer than 2 (₱0.05, ₱0.0042). Storage keeps 10. */
export function formatUnitCost(cost: number): string {
  return peso(4).format(cost);
}

export function formatPeso(amount: number): string {
  return peso(2).format(amount);
}

/** Trims trailing zeros from a quantity such as "25.0000". */
export function formatQuantity(q: number): string {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 4 }).format(q);
}
