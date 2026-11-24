import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "./auth";
import {
  accessibleModuleKeys,
  authorizeEmail,
  canAccessModule,
  canManageUsers,
} from "./authorization";
import type { ModuleKey } from "./modules";
import type { Role } from "./users";

export type SessionUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: Role;
  /** Module keys this user may access (all for owners). */
  modules: string[];
};

/**
 * Returns the signed-in user only if their session is valid AND their account is
 * still active in the database. Status, role and module grants are re-read from the
 * database on every request (deduplicated within one request), so changes take effect
 * immediately without the user signing out. Fails closed on lookup errors.
 */
export const getAuthorizedUser = cache(async (): Promise<SessionUser | null> => {
  await connection(); // opt into request-time rendering before Auth.js uses crypto
  const session = await auth();
  if (!session?.user?.email) return null;

  try {
    const account = await authorizeEmail(session.user.email);
    if (!account) return null;
    const principal = { role: account.role, modules: account.modules };
    return {
      id: account.id,
      name: account.name ?? session.user.name ?? null,
      email: account.email,
      image: account.avatar_url ?? session.user.image ?? null,
      role: account.role,
      modules: accessibleModuleKeys(principal),
    };
  } catch (err) {
    console.error("[session] account lookup failed", err);
    return null;
  }
});

export async function hasSession(): Promise<boolean> {
  return (await getAuthorizedUser()) !== null;
}

// Pages: redirect when not allowed.

export async function requireModule(key: ModuleKey): Promise<SessionUser> {
  const user = await getAuthorizedUser();
  if (!user) redirect("/admin/login");
  if (!canAccessModule(user, key)) redirect("/admin/access-denied");
  return user;
}

export async function requireOwner(): Promise<SessionUser> {
  const user = await getAuthorizedUser();
  if (!user) redirect("/admin/login");
  if (!canManageUsers(user)) redirect("/admin/access-denied");
  return user;
}

// Server actions and API routes: return null when not allowed.

export async function getUserForModule(key: ModuleKey): Promise<SessionUser | null> {
  const user = await getAuthorizedUser();
  return user && canAccessModule(user, key) ? user : null;
}

export async function getOwner(): Promise<SessionUser | null> {
  const user = await getAuthorizedUser();
  return user && canManageUsers(user) ? user : null;
}
