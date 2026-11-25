import "server-only";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { loadProductCosts } from "./product-costing";
import { todayInManila } from "./sales-report";
import type { ProductCost } from "./product-cost";
import type { CostRow } from "./profitability";

type HistoryRow = {
  product_id: string;
  effective_date: string;
  unit_cost: number | string | null;
  is_complete: boolean;
  is_estimate: boolean;
  source_hash: string;
};

const round = (n: number | null) => (n === null ? null : Number(n.toFixed(6)));

/** Fingerprint of everything that decides a product's unit cost, so unchanged products are skipped. */
function fingerprint(p: ProductCost): string {
  const parts = {
    total: round(p.totalCost),
    ingredient: round(p.ingredientCost),
    packaging: round(p.packagingCost),
    complete: p.complete,
    lines: p.lines.map((l) => [l.key, round(l.cost), l.issue, l.ingredientName]),
  };
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);
}

function failed(what: string, error: { message: string }): never {
  throw new Error(`product cost history ${what}: ${error.message}`);
}

/** Every recorded cost, oldest first. */
export async function listCostHistory(): Promise<CostRow[]> {
  const rows: HistoryRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin()
      .from("product_cost_history")
      .select("product_id, effective_date, unit_cost, is_complete, is_estimate, source_hash")
      .order("effective_date", { ascending: true })
      .range(from, from + 999);
    if (error) failed("read", error);
    rows.push(...((data ?? []) as HistoryRow[]));
    if (!data || data.length < 1000) break;
  }
  return rows.map((r) => ({
    productId: r.product_id,
    effectiveDate: r.effective_date,
    unitCost: r.unit_cost === null ? null : Number(r.unit_cost),
    isComplete: r.is_complete,
    isEstimate: r.is_estimate,
  }));
}

/**
 * Records today's cost of every product whose cost changed since its latest history row.
 * Called after every costing change, and when Profitability loads (which also catches recipe edits).
 * Rows for earlier days are never touched, so past reports cannot move. Returns how many were written.
 */
export async function recordCostSnapshot(actor: string, reason: string): Promise<number> {
  const db = supabaseAdmin();
  const [{ products }, existing] = await Promise.all([
    loadProductCosts(),
    db
      .from("product_cost_history")
      .select("product_id, effective_date, source_hash")
      .order("effective_date", { ascending: false })
      .limit(5000),
  ]);
  if (existing.error) failed("read", existing.error);

  const latest = new Map<string, string>(); // product -> hash of its newest row
  for (const r of (existing.data ?? []) as Pick<HistoryRow, "product_id" | "source_hash">[]) {
    if (!latest.has(r.product_id)) latest.set(r.product_id, r.source_hash);
  }

  const today = todayInManila();
  const changed = products
    .map((p) => ({ p, hash: fingerprint(p) }))
    .filter(({ p, hash }) => latest.get(p.productId) !== hash)
    .map(({ p, hash }) => ({
      product_id: p.productId,
      effective_date: today,
      unit_cost: p.totalCost === null ? null : Number(p.totalCost.toFixed(4)),
      ingredient_cost: p.ingredientCost === null ? null : Number(p.ingredientCost.toFixed(4)),
      packaging_cost: p.packagingCost === null ? null : Number(p.packagingCost.toFixed(4)),
      is_complete: p.totalCost !== null,
      is_estimate: false,
      issue_count: p.issueCount,
      breakdown: p.lines.map((l) => ({
        label: l.label,
        kind: l.kind,
        quantity: l.quantity,
        unit: l.unit,
        ingredient: l.ingredientName,
        cost: round(l.cost),
        issue: l.issue,
      })),
      source_hash: hash,
      reason: reason.slice(0, 200),
      created_by: actor,
    }));

  if (changed.length === 0) return 0;
  const { error } = await db.from("product_cost_history").upsert(changed, { onConflict: "product_id,effective_date" });
  if (error) failed("write", error);
  return changed.length;
}

/** For callers that must not fail because history could not be written. */
export async function recordCostSnapshotSafely(actor: string, reason: string): Promise<void> {
  try {
    await recordCostSnapshot(actor, reason);
  } catch (err) {
    console.error("[cost-history]", err);
  }
}
