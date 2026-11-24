import "server-only";
import { supabaseAdmin } from "./supabase";

export const ROLES = ["owner", "admin", "staff"] as const;
export type Role = (typeof ROLES)[number];

export type AuthorizedUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
  avatar_url: string | null;
  /** Module keys explicitly granted (meaningful for staff; owners have full access). */
  modules: string[];
};

export class LastOwnerError extends Error {
  constructor() {
    super("There must always be at least one active owner.");
  }
}

export class DuplicateEmailError extends Error {
  constructor() {
    super("That email already has an account.");
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super("That account no longer exists.");
  }
}

const COLUMNS =
  "id, email, name, role, is_active, created_at, last_login, avatar_url, " +
  "user_module_permissions(can_access, modules(module_key, is_active))";
const normalize = (email: string) => email.trim().toLowerCase();

type ModuleRef = { module_key: string; is_active: boolean };
type Row = Omit<AuthorizedUser, "modules"> & {
  user_module_permissions?: { can_access: boolean; modules: ModuleRef | ModuleRef[] | null }[];
};

function toUser(row: Row): AuthorizedUser {
  const { user_module_permissions, ...rest } = row;
  const modules = (user_module_permissions ?? []).flatMap((p) =>
    p.can_access && p.modules
      ? (Array.isArray(p.modules) ? p.modules : [p.modules])
          .filter((m) => m.is_active)
          .map((m) => m.module_key)
      : [],
  );
  return { ...rest, modules };
}

function fail(error: { message: string; code?: string }): never {
  if (error.message.includes("LAST_ACTIVE_OWNER")) throw new LastOwnerError();
  if (error.message.includes("USER_NOT_FOUND")) throw new UserNotFoundError();
  if (error.code === "23505") throw new DuplicateEmailError();
  throw new Error(`authorized_users: ${error.message}`);
}

// The account store. Swap this module to change where accounts live.

export async function findUserByEmail(email: string): Promise<AuthorizedUser | null> {
  const { data, error } = await supabaseAdmin()
    .from("authorized_users")
    .select(COLUMNS)
    .ilike("email", normalize(email).replace(/[%_\\]/g, "\\$&"))
    .maybeSingle();
  if (error) fail(error);
  return data ? toUser(data as unknown as Row) : null;
}

export async function listUsers(): Promise<AuthorizedUser[]> {
  const { data, error } = await supabaseAdmin()
    .from("authorized_users")
    .select(COLUMNS)
    .order("created_at", { ascending: true });
  if (error) fail(error);
  return ((data as unknown as Row[]) ?? []).map(toUser);
}

export type SaveUserInput = {
  id: string | null;
  email: string;
  name: string | null;
  role: Role;
  isActive: boolean;
  /** null leaves existing grants unchanged. */
  modules: string[] | null;
};

/** Creates or updates an account and its module grants atomically. */
export async function saveUser(input: SaveUserInput) {
  const { error } = await supabaseAdmin().rpc("save_authorized_user", {
    p_id: input.id,
    p_email: normalize(input.email),
    p_name: input.name,
    p_role: input.role,
    p_is_active: input.isActive,
    p_modules: input.modules,
  });
  if (error) fail(error);
}

export async function setUserActive(id: string, isActive: boolean) {
  const { error } = await supabaseAdmin()
    .from("authorized_users")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) fail(error);
}

export async function deleteUser(id: string) {
  const { error } = await supabaseAdmin().from("authorized_users").delete().eq("id", id);
  if (error) fail(error);
}

export async function recordLogin(id: string, avatarUrl?: string | null) {
  const { error } = await supabaseAdmin()
    .from("authorized_users")
    .update({
      last_login: new Date().toISOString(),
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    })
    .eq("id", id);
  if (error) fail(error);
}
