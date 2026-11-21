import { providerStatus } from "../suggest/chain";
import { getServiceClient } from "../supabase/service";

/**
 * Read-only admin statistics. Only called from admin routes after a session check, and only
 * with the service role client (server side).
 */

const DAY = 86_400_000;
const isoDaysAgo = (d: number) => new Date(Date.now() - d * DAY).toISOString();
const dayKey = (iso: string) => iso.slice(0, 10);

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

export async function games() {
  const { data, error } = await db()
    .from("app_events")
    .select("detail, created_at")
    .eq("kind", "game_started")
    .gte("created_at", isoDaysAgo(30))
    .order("created_at", { ascending: false })
    .limit(20_000);
  if (error) throw error;
  const byGame: Record<string, { d7: number; d30: number }> = {};
  const byDay: Record<string, number> = {};
  const week = Date.now() - 7 * DAY;
  for (const row of data ?? []) {
    const game = String((row.detail as { game?: unknown })?.game ?? "unknown");
    byGame[game] ??= { d7: 0, d30: 0 };
    byGame[game].d30++;
    if (Date.parse(row.created_at) >= week) byGame[game].d7++;
    byDay[dayKey(row.created_at)] = (byDay[dayKey(row.created_at)] ?? 0) + 1;
  }
  return { totalSample: data?.length ?? 0, byGame, byDay };
}

export async function llm() {
  const { data, error } = await db()
    .from("app_events")
    .select("detail, created_at")
    .eq("kind", "suggest")
    .gte("created_at", isoDaysAgo(7))
    .order("created_at", { ascending: false })
    .limit(20_000);
  if (error) throw error;
  const byProvider: Record<string, { count: number; fallback: number; msSum: number }> = {};
  let total = 0, fallback = 0;
  for (const row of data ?? []) {
    const d = row.detail as { provider?: string; fallback?: boolean; ms?: number };
    const p = String(d.provider ?? "unknown");
    byProvider[p] ??= { count: 0, fallback: 0, msSum: 0 };
    byProvider[p].count++;
    byProvider[p].msSum += Number(d.ms ?? 0);
    total++;
    if (d.fallback) {
      byProvider[p].fallback++;
      fallback++;
    }
  }
  const providers = Object.fromEntries(
    Object.entries(byProvider).map(([k, v]) => [k, { count: v.count, fallback: v.fallback, avgMs: v.count ? Math.round(v.msSum / v.count) : 0 }]),
  );
  return {
    total,
    fallbackRate: total ? Math.round((fallback / total) * 100) : 0,
    providers,
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
