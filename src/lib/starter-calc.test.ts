import test from "node:test";
import assert from "node:assert/strict";
import {
  STARTER_DEFAULTS,
  calculateStarter,
  formatFeedingRatio,
  formatFeedingText,
  parseDecimal,
  roundToTenths,
  totalStarterGrams,
  type StarterFields,
} from "./starter-calc.ts";

const fields = (o: Partial<StarterFields>): StarterFields => ({ ...STARTER_DEFAULTS, ...o });
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("standard feeding follows the spec formulas", () => {
  const r = calculateStarter("standard", fields({ required: "500" }));
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  near(r.target, 600);
  near(r.flour, 600 / 2.3);
  near(r.starter, (600 / 2.3) * 0.6);
  near(r.water, (600 / 2.3) * 0.7);
  near(r.starter + r.flour + r.water, 600);
  assert.equal(r.display.total, 600);
  assert.equal(formatFeedingRatio(r), "1 : 1.7 : 1.2");
});

test("displayed parts always add up to the displayed total", () => {
  for (let n = 1; n <= 2000; n += 7) {
    const r = calculateStarter("standard", fields({ required: String(n), allowance: "13" }));
    if (r.status !== "ok") throw new Error("expected ok");
    const d = r.display;
    assert.equal(Math.round((d.starter + d.flour + d.water) * 10), Math.round(d.total * 10));
    assert.ok(Math.abs(d.total - r.target) <= 0.05 + 1e-9);
  }
  const d = roundToTenths(0.05, 0.05, 0.05);
  assert.equal(Math.round((d.starter + d.flour + d.water) * 10), Math.round(d.total * 10));
});

test("limited starter follows the spec formulas", () => {
  const r = calculateStarter("limited", fields({ required: "500", availableStarter: "50" }));
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  near(r.flour, 550 / 1.7);
  near(r.water, (550 / 1.7) * 0.7);
  near(r.starterPercent, (50 / (550 / 1.7)) * 100);
  near(r.starter + r.flour + r.water, 600);
  assert.equal(r.belowStandard, true);
});

test("limited mode reports when no feeding is needed", () => {
  const r = calculateStarter("limited", fields({ required: "200", availableStarter: "300" }));
  assert.equal(r.status, "enough");
  assert.equal(calculateStarter("limited", fields({ required: "200", availableStarter: "300.0" })).status, "enough");
});

test("limited mode needs a positive available starter", () => {
  assert.equal(calculateStarter("limited", fields({ required: "500" })).status, "waiting");
  const zero = calculateStarter("limited", fields({ required: "500", availableStarter: "0" }));
  assert.equal(zero.status, "invalid");
});

test("rejects negative and non-numeric input; avoids dividing by zero", () => {
  const neg = calculateStarter("standard", fields({ required: "-5" }));
  assert.equal(neg.status, "invalid");
  const bad = calculateStarter("standard", fields({ required: "abc" }));
  assert.equal(bad.status, "invalid");
  const zeroHydration = calculateStarter("limited", fields({ required: "5", hydrationPercent: "0", availableStarter: "1" }));
  assert.equal(zeroHydration.status, "invalid");
  assert.equal(calculateStarter("standard", fields({})).status, "waiting");
});

test("blank allowance counts as zero", () => {
  const r = calculateStarter("standard", fields({ required: "230", allowance: "" }));
  if (r.status !== "ok") throw new Error("expected ok");
  near(r.target, 230);
});

test("parseDecimal", () => {
  assert.equal(parseDecimal("12.5"), 12.5);
  assert.equal(parseDecimal("12,5"), 12.5);
  assert.equal(parseDecimal("12."), 12);
  assert.equal(parseDecimal("1e3"), null);
  assert.equal(parseDecimal(""), null);
});

test("totalStarterGrams sums only Starter ingredients", () => {
  const cards = [
    { ingredients: [{ name: "Starter", grams: 136 }, { name: "Flour", grams: 300 }] },
    { ingredients: [{ name: "Starter", grams: 60 }] },
    { ingredients: [] },
  ];
  assert.equal(totalStarterGrams(cards), 196);
});

test("copy text includes the key figures", () => {
  const r = calculateStarter("standard", fields({ required: "500" }));
  if (r.status !== "ok") throw new Error("expected ok");
  const text = formatFeedingText(r);
  assert.match(text, /Target starter: 600\.0g/);
  assert.match(text, /Existing starter: 156\.5g/);
});

test("flags feedings more dilute than 1:10 starter to flour", () => {
  const lim = calculateStarter("limited", fields({ required: "500", availableStarter: "20" }));
  if (lim.status !== "ok") throw new Error("expected ok");
  assert.equal(lim.beyondMaxRatio, true);
  const ok = calculateStarter("limited", fields({ required: "500", availableStarter: "100" }));
  if (ok.status !== "ok") throw new Error("expected ok");
  assert.equal(ok.beyondMaxRatio, false);
  const std = calculateStarter("standard", fields({ required: "500", starterPercent: "5" }));
  if (std.status !== "ok") throw new Error("expected ok");
  assert.equal(std.beyondMaxRatio, true);
});
