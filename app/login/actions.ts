"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, verifyPin } from "@/src/lib/session";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const pin = String(formData.get("pin") ?? "");
  if (!verifyPin(pin)) {
    // Slow down brute-force attempts
    await new Promise((r) => setTimeout(r, 1000));
    return { error: "Incorrect PIN" };
  }
  await createSession();
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
