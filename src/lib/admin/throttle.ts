import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient } from "../supabase/service";

/**
 * Login throttle: after 5 failed attempts from one IP, that IP is locked out for 15 minutes.
 * Failures are kept in `admin_login_log` when the database is configured, so every serverless
 * instance sees them. Without the database, an in-memory copy is used (per instance only).
 *
 * The login route uses beginAttempt(): it checks the lock and reserves the attempt in one step
 * (migration 0009, admin_login_begin), so parallel requests can't all pass the check before any
 * of them records its failure. isLocked() and recordAttempt() are the older two-step calls, kept
 * as the fallback until 0009 is applied.
 */

export const MAX_FAILS = 5;
export const WINDOW_MS = 15 * 60_000;

const memory = new Map<string, number[]>();

function memoryRecent(ip: string, now: number): number[] {
  const recent = (memory.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length) memory.set(ip, recent);
  else memory.delete(ip);
  return recent;
}

function boundMemory(now: number) {
  if (memory.size <= 5000) return;
  // Bound the in-memory fallback: drop entries that are no longer inside the window.
  for (const [k, times] of memory) if (!times.some((t) => now - t < WINDOW_MS)) memory.delete(k);
}

/** Recent failures for this IP in the database, or null if the database didn't answer. */
async function dbFailures(db: SupabaseClient, ip: string, now: number): Promise<number | null> {
  try {
    const since = new Date(now - WINDOW_MS).toISOString();
    const { count, error } = await db
      .from("admin_login_log")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .eq("ok", false)
      .gte("created_at", since);
    // Supabase reports query errors in `error` instead of throwing. Treat a failed or empty
    // answer like an unreachable database, so a database problem never switches the lockout off.
    if (!error && typeof count === "number") return count;
  } catch {
    // Database unreachable.
  }
  return null;
}

export async function isLocked(ip: string, now = Date.now()): Promise<boolean> {
  const db = getServiceClient();
  if (db) {
    const n = await dbFailures(db, ip, now);
    if (n !== null) return n >= MAX_FAILS;
  }
  return memoryRecent(ip, now).length >= MAX_FAILS;
}

/** Records one attempt. Only the outcome and the reason are stored, never the username or password. */
export async function recordAttempt(ip: string, ok: boolean, reason: string, now = Date.now()): Promise<void> {
  if (!ok) memory.set(ip, [...(memory.get(ip) ?? []), now].slice(-20));
  boundMemory(now);
  const db = getServiceClient();
  if (!db) return;
  try {
    await db.from("admin_login_log").insert({ ip, ok, reason });
  } catch {
    /* logging must not block the login flow */
  }
}

export interface Attempt {
  locked: boolean;
  /** Records the outcome of a reserved attempt. Call it exactly once when not locked. */
  finish(ok: boolean, reason: string): Promise<void>;
}

/**
 * Checks the lock and reserves this attempt as a failure in one step. finish(true) turns the
 * reservation into a success. If the request dies before finish(), the reservation stays a
 * failure, which errs on the side of the lockout.
 */
export async function beginAttempt(ip: string, now = Date.now()): Promise<Attempt> {
  // In memory: check and reserve in the same synchronous step, so two requests on this instance
  // can't both pass the check while the other is still verifying its password.
  const recent = memoryRecent(ip, now);
  const memLocked = recent.length >= MAX_FAILS;
  let reserved = false;
  if (!memLocked) {
    memory.set(ip, [...recent, now].slice(-20));
    reserved = true;
  }
  boundMemory(now);
  const release = () => {
    if (!reserved) return;
    reserved = false;
    const arr = memory.get(ip);
    const i = arr ? arr.indexOf(now) : -1;
    if (arr && i >= 0) arr.splice(i, 1);
  };
  const lockedResult: Attempt = { locked: true, finish: async () => {} };

  const db = getServiceClient();
  if (!db) {
    if (memLocked) return lockedResult;
    return { locked: false, finish: async (ok) => { if (ok) release(); } };
  }

  // Atomic path (migration 0009): one call that takes a per-IP lock, counts and reserves.
  try {
    const { data, error } = await db.rpc("admin_login_begin", { p_ip: ip, p_max: MAX_FAILS, p_window_seconds: WINDOW_MS / 1000 });
    if (!error) {
      if (data === null || data === undefined) {
        release();
        return lockedResult;
      }
      const id = Number(data);
      return {
        locked: false,
        finish: async (ok, reason) => {
          if (ok) release();
          try {
            await db.rpc("admin_login_finish", { p_id: id, p_ok: ok, p_reason: reason });
          } catch {
            /* the reservation stays a failure: safe side */
          }
        },
      };
    }
  } catch {
    // fall through to the two-step check
  }

  // 0009 not applied yet, or the database is down: the older check, then a separate insert.
  const n = await dbFailures(db, ip, now);
  const locked = n !== null ? n >= MAX_FAILS : memLocked;
  if (locked) {
    release();
    return lockedResult;
  }
  return {
    locked: false,
    finish: async (ok, reason) => {
      if (ok) release();
      try {
        await db.from("admin_login_log").insert({ ip, ok, reason });
      } catch {
        /* logging must not block the login flow */
      }
    },
  };
}
