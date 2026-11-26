export type CategoryId = string;
export type CategoryFilter = "all" | CategoryId;

export type OptionChoice = {
  id: string;
  label: string;
  /** Added to the base price, in pesos. */
  priceDelta?: number;
};

export type OptionGroup = {
  id: string;
  label: string;
  choices: OptionChoice[];
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: CategoryId;
  /** Path under /public. Falls back to a placeholder tile when missing. */
  image: string;
  options?: OptionGroup[];
};

export type StoreCategory = { id: CategoryId; label: string; image: string };

export const SLICING: OptionGroup = {
  id: "slicing",
  label: "Slicing",
  choices: [
    { id: "unsliced", label: "Unsliced" },
    { id: "sliced", label: "Sliced" },
  ],
};

// The bag looks products up by id outside React. The storefront registers the catalog it was given
// from the server before reading the bag.
let catalog: Product[] = [];

export function setCatalog(products: Product[]) {
  catalog = products;
}

export function getProduct(id: string): Product | undefined {
  return catalog.find((p) => p.id === id);
}

export function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`;
}
