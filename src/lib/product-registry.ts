/**
 * Recipe products as the order sheet names them (key) with the label the app shows. The admin layout fills it
 * from the database, so order, report and profit screens never hold a product list of their own.
 */
export type ProductRef = { key: string; label: string; active: boolean };

let refs: readonly ProductRef[] = [];

export function setProductRegistry(next: readonly ProductRef[]) {
  refs = next;
}

/** Sheet names of active recipe products, in display order. Always listed in product performance. */
export const knownProducts = (): string[] => refs.filter((r) => r.active).map((r) => r.key);

export const productLabel = (key: string): string => refs.find((r) => r.key === key)?.label ?? key;
