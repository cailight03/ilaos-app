"use client";

import { setProductRegistry, type ProductRef } from "@/src/lib/product-registry";

/** Renders nothing; registers the product list before the screens below it read it. */
export function ProductRegistry({ products }: { products: ProductRef[] }) {
  setProductRegistry(products);
  return null;
}
