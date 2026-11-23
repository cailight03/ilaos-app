import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";

const COOKIE = "ilao_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

const sign = (payload: string) =>
  createHmac("sha256", secret()).update(payload).digest("hex");

export function verifyPin(input: string): boolean {
  const pin = process.env.DASHBOARD_PIN;
  if (!pin) throw new Error("DASHBOARD_PIN is not set");
  const a = createHmac("sha256", "pin").update(input).digest();
  const b = createHmac("sha256", "pin").update(pin).digest();
  return timingSafeEqual(a, b);
}

export async function createSession() {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = String(exp);
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function hasSession(): Promise<boolean> {
  await connection(); // opt into request-time rendering before reading the clock
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (sig.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return Number(payload) > Date.now();
}
