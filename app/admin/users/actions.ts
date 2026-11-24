"use server";

import { revalidatePath } from "next/cache";
import { MODULE_KEYS } from "@/src/lib/modules";
import { getOwner } from "@/src/lib/session";
import {
  DuplicateEmailError,
  LastOwnerError,
  ROLES,
  UserNotFoundError,
  deleteUser,
  saveUser,
  setUserActive,
  type Role,
} from "@/src/lib/users";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type SaveUserPayload = {
  id: string | null;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  modules: string[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v);
const SELF_ERROR = "You can't change your own role or status, or remove yourself.";

// Every action re-checks owner status against the database before doing anything.
async function run(
  work: (actorId: string) => Promise<ActionResult | void>,
): Promise<ActionResult> {
  const owner = await getOwner();
  if (!owner) return { ok: false, error: "You don't have permission to do that." };

  try {
    const result = await work(owner.id);
    if (result && !result.ok) return result;
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    if (
      err instanceof LastOwnerError ||
      err instanceof DuplicateEmailError ||
      err instanceof UserNotFoundError
    ) {
      return { ok: false, error: err.message };
    }
    console.error("[users]", err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

export async function saveUserAction(payload: SaveUserPayload): Promise<ActionResult> {
  const id = payload.id;
  if (id !== null && !UUID_RE.test(id)) return { ok: false, error: "Invalid account." };

  const email = String(payload.email ?? "").trim().toLowerCase();
  const name = String(payload.name ?? "").trim().slice(0, 100);
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!isRole(payload.role)) return { ok: false, error: "Choose a valid role." };
  if (typeof payload.isActive !== "boolean") return { ok: false, error: "Invalid status." };
  const modules = Array.isArray(payload.modules) ? [...new Set(payload.modules.map(String))] : [];
  if (modules.some((m) => !MODULE_KEYS.includes(m))) {
    return { ok: false, error: "Unknown module." };
  }
  const role = payload.role;

  return run(async (actorId) => {
    // Owners and admins have full module access, so their grants are left alone; nobody edits their own access here.
    const isSelf = id === actorId;
    if (isSelf && (role !== "owner" || !payload.isActive)) return { ok: false, error: SELF_ERROR };
    await saveUser({
      id,
      email,
      name: name || null,
      role,
      isActive: payload.isActive,
      modules: role === "staff" && !isSelf ? modules : null,
    });
  });
}

export async function setUserActiveAction(id: string, active: boolean): Promise<ActionResult> {
  if (!UUID_RE.test(String(id))) return { ok: false, error: "Invalid account." };
  if (typeof active !== "boolean") return { ok: false, error: "Invalid request." };
  return run(async (actorId) => {
    if (id === actorId && !active) return { ok: false, error: SELF_ERROR };
    await setUserActive(id, active);
  });
}

export async function removeUserAction(id: string): Promise<ActionResult> {
  if (!UUID_RE.test(String(id))) return { ok: false, error: "Invalid account." };
  return run(async (actorId) => {
    if (id === actorId) return { ok: false, error: SELF_ERROR };
    await deleteUser(id);
  });
}
