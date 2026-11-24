import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient<any> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Server-only Supabase client using the secret key. Never import from client components. */
export function supabaseAdmin() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
