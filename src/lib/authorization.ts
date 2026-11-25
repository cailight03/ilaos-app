import "server-only";
import { MODULE_KEYS, type ModuleKey } from "./modules";
import { findUserByEmail, type AuthorizedUser, type Role } from "./users";

/**
 * Central authorization rules (what an account may do), kept separate from
 * authentication (Auth.js proving who they are) and from storage (./users).
 *
/**
 * - Owners: every module plus exclusive access to User Management.
 * - Admins: every module, but not User Management.
 * - Staff: only modules explicitly granted to them.
 */
export type Principal = { role: Role; modules: readonly string[] };

const hasAllModules = (role: Role) => role === "owner" || role === "admin";

export function canAccessModule(user: Principal, key: ModuleKey): boolean {
  if (hasAllModules(user.role)) return true;
  return user.modules.includes(key);
}

export function canManageUsers(user: Principal): boolean {
  return user.role === "owner";
}

/** The Audit Log is restricted to owners and admins. */
export function canViewAuditLog(user: Principal): boolean {
  return hasAllModules(user.role);
}

/** Module keys the principal may use (grants for unregistered modules are ignored). */
export function accessibleModuleKeys(user: Principal): string[] {
  return hasAllModules(user.role) ? [...MODULE_KEYS] : MODULE_KEYS.filter((k) => user.modules.includes(k));
}

/** The account for this email if it exists and is active; otherwise null. */
export async function authorizeEmail(email: string | null | undefined): Promise<AuthorizedUser | null> {
  if (!email) return null;
  const user = await findUserByEmail(email);
  return user?.is_active ? user : null;
}
