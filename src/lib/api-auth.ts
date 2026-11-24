import "server-only";
import { timingSafeEqual, createHash } from "node:crypto";
import type { ModuleKey } from "./modules";
import { getAuthorizedUser } from "./session";
import { canAccessModule } from "./authorization";

const digest = (v: string) => createHash("sha256").update(v).digest();

/**
 * Allows either a signed-in browser session whose account has access to `moduleKey`, or
 * `Authorization: Bearer <API_SECRET>` (machine access).
 * Returns an error Response, or null if the request is authorized.
 */
export async function requireApiModule(
  request: Request,
  moduleKey: ModuleKey,
): Promise<Response | null> {
  const user = await getAuthorizedUser();
  if (user) {
    return canAccessModule(user, moduleKey)
      ? null
      : Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const secret = process.env.API_SECRET;
  if (!secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token || !timingSafeEqual(digest(token), digest(secret))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
