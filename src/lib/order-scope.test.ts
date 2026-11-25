import test from "node:test";
import assert from "node:assert/strict";
import { netTotal, scopeOrders, type ScopeOrder } from "./order-scope.ts";

const o = (rowNumber: number, invoiceId: string, over: Partial<ScopeOrder> = {}): ScopeOrder => ({
  rowNumber,
  name: "Ana",
  invoiceId,
  bakeDate: "2026-11-10",
  total: 500,
  items: [{ product: "Plain Sourdough", unitPrice: 250, quantity: 2 }],
  archived: false,
  refund: 0,
  ...over,
});

test("archived orders are excluded", () => {
  const s = scopeOrders([o(1, "A"), o(2, "B", { archived: true })]);
  assert.deepEqual(s.orders.map((x) => x.rowNumber), [1]);
  assert.equal(s.archived, 1);
});

test("an identical repeated invoice counts once", () => {
  const s = scopeOrders([o(1, "A"), o(2, "A"), o(3, "A")]);
  assert.equal(s.orders.length, 1);
  assert.equal(s.duplicatesRemoved, 2);
  assert.equal(s.orders[0].rowNumber, 1);
  assert.deepEqual(s.conflictingInvoiceIds, []);
});

test("same invoice ID with different content is kept and reported", () => {
  const s = scopeOrders([o(1, "A"), o(2, "A", { total: 900 })]);
  assert.equal(s.orders.length, 2);
  assert.deepEqual(s.conflictingInvoiceIds, ["A"]);
});

test("rows without an invoice ID are never merged", () => {
  assert.equal(scopeOrders([o(1, ""), o(2, "")]).orders.length, 2);
});

test("an archived duplicate does not hide the live row", () => {
  const s = scopeOrders([o(1, "A", { archived: true }), o(2, "A")]);
  assert.deepEqual(s.orders.map((x) => x.rowNumber), [2]);
});

test("netTotal subtracts refunds, clamped to the order total", () => {
  assert.equal(netTotal({ total: 500, refund: 120 }), 380);
  assert.equal(netTotal({ total: 500, refund: 900 }), 0);
  assert.equal(netTotal({ total: 500, refund: -5 }), 500);
});
