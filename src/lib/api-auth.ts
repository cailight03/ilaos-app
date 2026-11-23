import "server-only";
import { timingSafeEqual, createHash } from "node:crypto";
import { hasSession } from "./session";

const digest = (v: string) => createHash("sha256").update(v).digest();

/**
 * Allows either a signed-in browser session (PIN login) or `Authorization: Bearer <API_SECRET>`.
 * Returns an error Response, or null if the request is authorized.
 */
export async function requireApiAuth(request: Request): Promise<Response | null> {
  if (await hasSession()) return null;

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
