import { providerStatus } from "../suggest/chain";
import { getServiceClient } from "../supabase/service";

/**
 * Read-only admin statistics. Only called from admin routes after a session check, and only
 * with the service role client (server side).
 */

function db() {
  const client = getServiceClient();
  if (!client) throw new Error("database_not_configured");
  return client;
}

export async function overview() {
  const { data, error } = await db().rpc("admin_overview");
  if (error) throw error;
  return data;
}

export async function users(search: string, page: number) {
  const { data, error } = await db().rpc("admin_users", {
    p_search: search || null,
    p_limit: 50,
    p_offset: Math.max(0, page) * 50,
  });
  if (error) throw error;
  return data;
}

/** Counted in the database (see 0005): the API's 1000-row page limit would undercount here. */
export async function games() {
  const { data, error } = await db().rpc("admin_game_stats");
  if (error) throw error;
  const stats = data as { totalSample: number; byGame: Record<string, { d7: number; d30: number }>; byDay: Record<string, number> };
  return { totalSample: stats.totalSample ?? 0, byGame: stats.byGame ?? {}, byDay: stats.byDay ?? {} };
}

export async function llm() {
  const { data, error } = await db().rpc("admin_llm_stats");
  if (error) throw error;
  const stats = data as { total: number; fallbackRate: number; providers: Record<string, { count: number; fallback: number; avgMs: number }> };
  return {
    total: stats.total ?? 0,
    fallbackRate: stats.fallbackRate ?? 0,
    providers: stats.providers ?? {},
    // Which providers this server instance has configured or is cooling down. No keys are returned.
    live: providerStatus(),
  };
}

export async function logins() {
  const { data, error } = await db()
    .from("admin_login_log")
    .select("created_at, ip, ok, reason")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}
