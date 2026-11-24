"use server";

import { signIn, signOut } from "@/src/lib/auth";

export async function loginWithGoogle() {
  await signIn("google", { redirectTo: "/admin" });
}

export async function logout() {
  await signOut({ redirectTo: "/admin/login" });
}
