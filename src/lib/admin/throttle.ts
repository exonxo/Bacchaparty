import { getServiceClient } from "../supabase/service";

/**
 * Login throttle: after 5 failed attempts from one IP, that IP is locked out for 15 minutes.
 * Failures are kept in `admin_login_log` when the database is configured, so every serverless
 * instance sees them. Without the database, an in-memory copy is used (per instance only).
 */

export const MAX_FAILS = 5;
export const WINDOW_MS = 15 * 60_000;

const memory = new Map<string, number[]>();

export async function isLocked(ip: string, now = Date.now()): Promise<boolean> {
  const db = getServiceClient();
  if (db) {
    try {
      const since = new Date(now - WINDOW_MS).toISOString();
      const { count } = await db
        .from("admin_login_log")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip)
        .eq("ok", false)
        .gte("created_at", since);
      return (count ?? 0) >= MAX_FAILS;
    } catch {
      // Database unreachable: fall back to memory rather than locking the owner out.
    }
  }
  const recent = (memory.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  memory.set(ip, recent);
  return recent.length >= MAX_FAILS;
}

/** Records one attempt. Only the outcome and the reason are stored, never the username or password. */
export async function recordAttempt(ip: string, ok: boolean, reason: string, now = Date.now()): Promise<void> {
  if (!ok) memory.set(ip, [...(memory.get(ip) ?? []), now].slice(-20));
  const db = getServiceClient();
  if (!db) return;
  try {
    await db.from("admin_login_log").insert({ ip, ok, reason });
  } catch {
    /* logging must not block the login flow */
  }
}
