import test from "node:test";
import assert from "node:assert/strict";
import { nextBakeDate } from "./config.ts";
import { evaluateCoupon, type Coupon } from "./coupons.ts";
import { normalizeMobile, validateDetails, validatePayment } from "./validation.ts";

test("nextBakeDate picks the coming Sunday until Friday noon", () => {
  // Wed 2026-11-25 -> Sun 2026-11-29
  assert.equal(nextBakeDate(new Date(2026, 10, 25, 10)).getDate(), 29);
  // Fri 11:59 still ok
  assert.equal(nextBakeDate(new Date(2026, 10, 27, 11, 59)).getDate(), 29);
  // Fri 12:00 rolls to Dec 6
  const d = nextBakeDate(new Date(2026, 10, 27, 12));
  assert.deepEqual([d.getMonth(), d.getDate(), d.getDay()], [11, 6, 0]);
  // Sunday itself rolls forward
  assert.equal(nextBakeDate(new Date(2026, 10, 29, 8)).getDate(), 6);
});

test("normalizeMobile accepts PH formats", () => {
  for (const v of ["09171234567", "+63 917 123 4567", "9171234567", "0917-123-4567"]) {
    assert.equal(normalizeMobile(v), "09171234567");
  }
  assert.equal(normalizeMobile("12345"), null);
  assert.equal(normalizeMobile("08171234567"), null);
});

test("validateDetails flags each invalid field", () => {
  const e = validateDetails({ fullName: "Ana", email: "x@y", mobile: "1", notes: "" }, false);
  assert.deepEqual(Object.keys(e).sort(), ["email", "fullName", "mobile", "policies"]);
  const ok = validateDetails(
    { fullName: "Ana Cruz", email: "ana@example.com", mobile: "09171234567", notes: "" },
    true,
  );
  assert.deepEqual(ok, {});
});

test("validatePayment requires an image proof", () => {
  assert.deepEqual(validatePayment({ type: "image/png", size: 100 }), {});
  assert.ok(validatePayment(null).proof);
  assert.ok(validatePayment({ type: "application/pdf", size: 1 }).proof);
  assert.ok(validatePayment({ type: "image/png", size: 6 * 1024 * 1024 }).proof);
});

const LIST: Coupon[] = [
  { code: "PCT", description: "", type: "percent", value: 10, minSubtotal: 500 },
  { code: "FIX", description: "", type: "fixed", value: 900, expiresOn: "2026-11-30" },
];

test("evaluateCoupon applies percent and fixed discounts", () => {
  const now = new Date(2026, 10, 26);
  const pct = evaluateCoupon(" pct ", 1270, now, LIST);
  assert.ok(pct.ok && pct.discount === 127);
  const fix = evaluateCoupon("FIX", 600, now, LIST);
  assert.ok(fix.ok && fix.discount === 600, "discount is capped at the subtotal");
});

test("evaluateCoupon rejects unknown, under-minimum and expired codes", () => {
  const now = new Date(2026, 10, 26);
  assert.equal(evaluateCoupon("NOPE", 1000, now, LIST).ok, false);
  const low = evaluateCoupon("PCT", 400, now, LIST);
  assert.ok(!low.ok && low.error.includes("₱100"));
  assert.equal(evaluateCoupon("FIX", 1000, new Date(2026, 10, 30, 23), LIST).ok, true);
  const late = evaluateCoupon("FIX", 1000, new Date(2026, 11, 1), LIST);
  assert.ok(!late.ok && late.error.includes("expired"));
});
