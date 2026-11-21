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

/* ---------------- Power admin views (round 6) ---------------- */

export async function funnel() {
  const { data, error } = await db().rpc("admin_funnel");
  if (error) throw error;
  return data;
}

export async function quotaToday() {
  const { data, error } = await db().rpc("admin_quota_today");
  if (error) throw error;
  const counts = (data ?? {}) as Record<string, number>;
  // The limit for each provider comes from the environment (QUOTA_<NAME>_DAILY). Empty means "not set".
  const limits = Object.fromEntries(
    ["GEMINI", "GROQ", "OPENROUTER", "CLOUDFLARE"].map((n) => [n.toLowerCase(), Number(process.env[`QUOTA_${n}_DAILY`]) || null]),
  );
  return { day: new Date().toISOString().slice(0, 10), counts, limits };
}

export async function health() {
  const { data, error } = await db().rpc("admin_health");
  if (error) throw error;
  return data;
}

/** Room inspector: database facts only. Live game state is on the host's phone and is not stored. */
export async function room(code: string) {
  const { data, error } = await db()
    .from("rooms")
    .select("id, code, host_id, created_at, closed_at")
    .eq("code", code)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  const hosts = new Map<string, string | null>();
  for (const row of data ?? []) {
    if (!hosts.has(row.host_id)) {
      const { data: u } = await db().auth.admin.getUserById(row.host_id);
      hosts.set(row.host_id, u?.user?.email ?? null);
    }
  }
  return {
    rooms: (data ?? []).map((r) => ({ ...r, host_email: hosts.get(r.host_id) ?? null })),
    note: "Live game state (players, answers, scores) is held by the host's phone and the realtime service. It is not stored here.",
  };
}

/** One account, with its rooms. Used for the detail panel and the data export. */
export async function user(id: string) {
  const { data, error } = await db().auth.admin.getUserById(id);
  if (error || !data?.user) throw new Error("not_found");
  const u = data.user;
  const { data: rooms } = await db().from("rooms").select("code, created_at, closed_at").eq("host_id", id).order("created_at", { ascending: false });
  return {
    id: u.id,
    email: u.email ?? null,
    provider: (u.app_metadata as { provider?: string } | null)?.provider ?? "email",
    name: (u.user_metadata as { full_name?: string; name?: string } | null)?.full_name ?? (u.user_metadata as { name?: string } | null)?.name ?? null,
    signedUp: u.created_at,
    lastSignIn: u.last_sign_in_at ?? null,
    bannedUntil: (u as { banned_until?: string | null }).banned_until ?? null,
    rooms: rooms ?? [],
  };
}

export async function audit() {
  const { data, error } = await db()
    .from("admin_audit")
    .select("at, actor, action, target, details, ip")
    .order("at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function flags() {
  const { knownFlags } = await import("./flags");
  const { loadFlagRows } = await import("./flags");
  const rows = await loadFlagRows(true);
  return knownFlags().map((key) => ({ key, enabled: rows[key]?.enabled ?? true, note: rows[key]?.note ?? null }));
}

export async function content() {
  const [pending, counts] = await Promise.all([
    db()
      .from("content_items")
      .select("id, game_id, level, data, source, created_at")
      .eq("approved", false)
      .eq("rejected", false)
      .order("created_at", { ascending: false })
      .limit(100),
    db().from("content_items").select("approved, rejected"),
  ]);
  if (pending.error) throw pending.error;
  const all = counts.data ?? [];
  return {
    pending: pending.data ?? [],
    approved: all.filter((r) => r.approved).length,
    rejected: all.filter((r) => r.rejected).length,
  };
}

export async function findUser(email: string): Promise<string | null> {
  const { data, error } = await db().rpc("admin_find_user", { p_email: email });
  if (error) throw error;
  return (data as string | null) ?? null;
}
