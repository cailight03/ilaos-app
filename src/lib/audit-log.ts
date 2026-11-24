import "server-only";
import { supabaseAdmin } from "./supabase";

export type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  module: string;
  createdAt: string;
};

export async function listAudit(limit = 50): Promise<AuditEntry[]> {
  const { data, error } = await supabaseAdmin()
    .from("audit_log")
    .select("id, actor, action, module, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => ({
    id: a.id,
    actor: a.actor,
    action: a.action,
    module: a.module,
    createdAt: a.created_at,
  }));
}

/** Never throws: an audit failure must not fail the change it describes. */
export async function logAudit(actor: string, action: string, module: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin()
      .from("audit_log")
      .insert({ actor, action: action.slice(0, 100), module: module.slice(0, 100) });
    if (error) console.error("[audit-log] failed", error.message);
  } catch (err) {
    console.error("[audit-log] failed", err);
  }
}
