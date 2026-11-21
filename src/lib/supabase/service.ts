import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only client with the service role key. It bypasses row-level security, so it must
 * never be imported from a client component or returned in a response.
 * Returns null when the key isn't configured.
 */
export function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
