import test from "node:test";
import assert from "node:assert/strict";
import { parseCoupon, parseDiscount, parseItems } from "./order-parsing.ts";

const withDiscountLine = `Rosemary Focaccia (Amount: 220.00 PHP, Quantity: 3)
Plain Sourdough (Amount: 250.00 PHP, Quantity: 1)

Discount: -392.00
Total: 1,568.00 PHP

Coupon used: MAU200`;

const couponOnly = `Plain Sourdough (Amount: 225.00 PHP, Quantity: 13)
Total: 2,925.00 PHP

Coupon used: ILAOS10`;

const plain = `Plain Sourdough (Amount: 250.00 PHP, Quantity: 1)
Total: 250.00 PHP`;

test("parses coupon codes", () => {
  assert.equal(parseCoupon(withDiscountLine), "MAU200");
  assert.equal(parseCoupon(couponOnly), "ILAOS10");
  assert.equal(parseCoupon(plain), null);
  assert.equal(parseCoupon(undefined), null);
});

test("parses discount amounts as positive numbers", () => {
  assert.equal(parseDiscount(withDiscountLine), 392);
  assert.equal(parseDiscount(couponOnly), 0);
  assert.equal(parseDiscount("Discount: -1,050.50"), 1050.5);
});

test("coupon and discount lines don't leak into items", () => {
  assert.equal(parseItems(withDiscountLine).length, 2);
  assert.equal(parseItems(couponOnly)[0].quantity, 13);
});
