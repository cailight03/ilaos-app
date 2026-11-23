export type OrderItem = {
  product: string;
  unitPrice: number;
  quantity: number;
};

/** Sheet dates are month-day-year (MM-DD-YYYY). Returns ISO yyyy-mm-dd. */
export function parseBakeDate(raw: string | undefined): string | null {
  const m = raw?.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${yyyy}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const ITEM_RE = /^(.+?)\s*\(Amount:\s*([\d.,]+)\s*PHP,\s*Quantity:\s*(\d+)\)/gm;

export function parseItems(raw: string | undefined): OrderItem[] {
  if (!raw) return [];
  return [...raw.matchAll(ITEM_RE)].map((m) => ({
    product: m[1].trim(),
    unitPrice: Number(m[2].replace(/,/g, "")),
    quantity: Number(m[3]),
  }));
}

/** "Coupon used: ILAOS10" line in the products cell. */
export function parseCoupon(raw: string | undefined): string | null {
  const code = raw?.match(/^\s*Coupon used:\s*(.+?)\s*$/im)?.[1];
  return code || null;
}

/** "Discount: -392.00" line in the products cell, returned as a positive amount (0 if absent). */
export function parseDiscount(raw: string | undefined): number {
  const m = raw?.match(/^\s*Discount:\s*-?\s*([\d.,]+)/im);
  const n = m ? Number(m[1].replace(/,/g, "")) : 0;
  return Number.isFinite(n) ? n : 0;
}
