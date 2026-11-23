import test from "node:test";
import assert from "node:assert/strict";
import type { Order } from "./orders.ts";
import {
  DEFAULT_FILTERS,
  duplicateInvoiceIds,
  filterAndSortOrders,
  summarizeOrders,
} from "./order-view.ts";

const order = (rowNumber: number, name: string, over: Partial<Order> = {}): Order => ({
  rowNumber,
  name,
  invoiceId: `# INV-${String(rowNumber).padStart(6, "0")}`,
  bakeDate: "2026-11-22",
  paymentMethod: "",
  paid: false,
  items: [{ product: "Plain Sourdough", unitPrice: 250, quantity: 1 }],
  total: 250,
  coupon: null,
  discount: 0,
  ...over,
});

const orders = [
  order(2, "Ana", { total: 600, items: [{ product: "Rosemary Focaccia", unitPrice: 300, quantity: 2 }] }),
  order(3, "Ben", { bakeDate: "2026-11-29" }),
  order(4, "Ana", { invoiceId: "# INV-000002" }), // same name, different order
];

test("summarizes orders, items and sales", () => {
  assert.deepEqual(summarizeOrders(orders), { totalOrders: 3, totalItems: 4, totalSales: 1100 });
});

test("filters by bake date and product", () => {
  const byDate = filterAndSortOrders(orders, { ...DEFAULT_FILTERS, bakeDate: "2026-11-29" });
  assert.deepEqual(byDate.map((o) => o.name), ["Ben"]);
  const byProduct = filterAndSortOrders(orders, { ...DEFAULT_FILTERS, product: "Rosemary Focaccia" });
  assert.equal(byProduct.length, 1);
});

test("searches name and order id, never merging same-name customers", () => {
  const byName = filterAndSortOrders(orders, { ...DEFAULT_FILTERS, query: "ana" });
  assert.equal(byName.length, 2);
  const byId = filterAndSortOrders(orders, { ...DEFAULT_FILTERS, query: "inv-000003" });
  assert.deepEqual(byId.map((o) => o.name), ["Ben"]);
});

test("sorts by newest, oldest, name and amount", () => {
  const rows = (sort: "newest" | "oldest" | "name" | "highest" | "lowest") =>
    filterAndSortOrders(orders, { ...DEFAULT_FILTERS, sort }).map((o) => o.rowNumber);
  assert.deepEqual(rows("newest"), [4, 3, 2]);
  assert.deepEqual(rows("oldest"), [2, 3, 4]);
  assert.deepEqual(rows("name"), [4, 2, 3]);
  assert.deepEqual(rows("highest"), [2, 4, 3]);
  assert.deepEqual(rows("lowest"), [4, 3, 2]);
});

test("detects invoice ids shared by different rows", () => {
  assert.deepEqual(duplicateInvoiceIds(orders), ["# INV-000002"]);
});
