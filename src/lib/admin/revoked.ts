import { getServiceClient } from "../supabase/service";

/**
 * Logged-out admin sessions. Each session token carries a random id (sid). Logging out stores
 * that id until the token would have expired anyway, and every admin request checks the list.
 * Kept in `admin_revoked_sessions` (migration 0009) so every serverless instance sees it, plus
 * an in-memory copy for this instance.
 */

const memory = new Map<string, number>(); // sid -> expiry (ms)

let warnedMissing = false;

/** PostgREST's answer when the table doesn't exist yet (0009 not applied). */
function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST205" || error.code === "42P01" || /schema cache|does not exist/i.test(error.message ?? "");
}

function prune(now: number) {
  for (const [sid, exp] of memory) if (exp < now) memory.delete(sid);
}

export async function revokeSession(sid: string, expSeconds: number, now = Date.now()): Promise<void> {
  prune(now);
  memory.set(sid, expSeconds * 1000);
  const db = getServiceClient();
  if (!db) return;
  try {
    const { error } = await db
      .from("admin_revoked_sessions")
      .upsert({ sid, expires_at: new Date(expSeconds * 1000).toISOString() }, { onConflict: "sid", ignoreDuplicates: true });
    if (error) console.warn("[admin] logout not stored in the database; the session is refused on this instance only");
    // Housekeeping: ids whose tokens have expired are no longer needed.
    else await db.from("admin_revoked_sessions").delete().lt("expires_at", new Date(now).toISOString());
  } catch {
    console.warn("[admin] logout not stored in the database; the session is refused on this instance only");
  }
}

/**
 * True when this session was logged out. If the database can't be asked, the session is refused
 * (fail closed). The one exception is the table not existing yet (0009 not applied): then only
 * this instance's memory is used, so the owner isn't locked out before running the migration.
 */
export async function isRevoked(sid: string, now = Date.now()): Promise<boolean> {
  const exp = memory.get(sid);
  if (exp !== undefined && exp >= now) return true;
  const db = getServiceClient();
  if (!db) return false;
  try {
    const { data, error } = await db.from("admin_revoked_sessions").select("sid").eq("sid", sid).maybeSingle();
    if (!error) return data !== null;
    if (isMissingTable(error)) {
      if (!warnedMissing) {
        warnedMissing = true;
        console.warn("[admin] admin_revoked_sessions is missing (run migration 0009); logout is enforced per instance only");
      }
      return false;
    }
  } catch {
    /* unreachable: fail closed below */
  }
  return true;
}
