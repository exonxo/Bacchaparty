// QA round 6 and 7: power-admin SQL (migrations 0004 to 0008) against an in-process Postgres.
// Simulates the parts of Supabase the migrations rely on (auth.users, anon / authenticated /
// service_role). Not a substitute for testing on the real project.
// Run after: npm i --no-save @electric-sql/pglite   (or set PGLITE_DIR to the package folder)
//   node docs/testing/qa/admin-power-sql.test.mjs
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const pglite = await import(
  process.env.PGLITE_DIR ? path.join(process.env.PGLITE_DIR, "dist/index.js") : "@electric-sql/pglite"
).catch(() => {
  console.log("Install the test database first: npm i --no-save @electric-sql/pglite (or set PGLITE_DIR).");
  process.exit(2);
});
const { PGlite } = pglite;

const results = [];
const check = (id, name, ok, detail = "") => results.push(`${ok ? "PASS" : "FAIL"} ${id} ${name}${!ok && detail ? `\n     ${detail}` : ""}`);
const migration = (f) => readFileSync(path.join(root, "supabase/migrations", f), "utf8");

const db = new PGlite();

// Runs each statement of a seed block on its own. A multi-statement exec can drop later statements.
const execAll = async (sql) => {
  for (const stmt of sql.split(/;\s*\n/).map((x) => x.trim()).filter(Boolean)) await db.exec(stmt.endsWith(';') ? stmt : stmt + ';');
};

// --- Simulated Supabase -----------------------------------------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    created_at timestamptz not null default now(),
    last_sign_in_at timestamptz,
    raw_app_meta_data jsonb not null default '{}'::jsonb,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create table public.rooms (
    id uuid primary key default gen_random_uuid(),
    code text not null,
    host_id uuid not null references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    closed_at timestamptz
  );
  -- content_items as defined in 0001_init.sql (the rest of 0001 is not needed here).
  create table public.content_items (
    id uuid primary key default gen_random_uuid(),
    game_id text not null,
    level text not null check (level in ('kids', 'family', 'adults')),
    data jsonb not null,
    source text not null default 'manual',
    approved boolean not null default false,
    created_at timestamptz not null default now()
  );
  alter table public.content_items enable row level security;
  -- Supabase grants broad table privileges to the public roles by default, TRUNCATE included.
  -- Simulate that here, so the revoke in 0008 is really tested.
  grant truncate on public.rooms, public.content_items to anon, authenticated;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant select, insert, update, delete on all tables in schema public to service_role;
  grant select on auth.users to service_role;
`);
let migrationsOk = true;
for (const f of ["0004_admin_and_events.sql", "0005_admin_stats_and_retention.sql", "0006_lasting_room_counts_and_safe_stats.sql", "0007_power_admin.sql", "0008_review_followups.sql"]) {
  try {
    await db.exec(migration(f));
    check("MIG", `migration ${f} applies cleanly`, true);
  } catch (e) {
    migrationsOk = false;
    check("MIG", `migration ${f} applies cleanly`, false, e.message.split("\n")[0]);
  }
}
check("MIG", "migrations 0004 to 0008 all apply cleanly", migrationsOk);

// --- Seed ---------------------------------------------------------------------------------------
await execAll(`
  insert into auth.users (email, created_at, last_sign_in_at, raw_app_meta_data)
  select 'host' || g || '@example.test',
         case when g <= 3 then now() - interval '40 days' else now() - (g || ' hours')::interval end,
         now() - (g || ' hours')::interval,
         case when g <= 20 then '{"provider":"google"}'::jsonb else '{"provider":"email"}'::jsonb end
  from generate_series(1, 30) g;
`);
// Hosts 1-5 each create rooms, so "created a room" is 5 distinct hosts.
await execAll(`
  insert into public.rooms (code, host_id, created_at)
  select 'R' || g, (select id from auth.users order by email offset ((g % 5)) limit 1), now() - interval '1 day' from generate_series(1, 12) g;
`);
// Audit rows: 4 recent, 2 older than 365 days.
await execAll(`
  insert into public.admin_audit (actor, action, at) select 'owner', 'view.users', now() - interval '1 day' from generate_series(1, 4) g;
  insert into public.admin_audit (actor, action, at) select 'owner', 'user.delete', now() - interval '400 days' from generate_series(1, 2) g;
`);
// Cron runs: 3 recent, 2 older than 90 days.
await execAll(`
  insert into public.cron_runs (job, ok, detail, ran_at) select 'purge', true, '{"rooms":0}', now() - interval '2 days' from generate_series(1, 3) g;
  insert into public.cron_runs (job, ok, detail, ran_at) select 'purge', true, '{"rooms":0}', now() - interval '120 days' from generate_series(1, 2) g;
`);
// Suggestions today: 6 by groq (2 fallback), 4 by gemini. Suggestions yesterday: 9 by groq (should not count today).
await execAll(`
  insert into public.app_events (kind, detail, created_at) select 'suggest', '{"provider":"groq","fallback":false,"ms":300}', now() - interval '1 minute' from generate_series(1, 4) g;
  insert into public.app_events (kind, detail, created_at) select 'suggest', '{"provider":"groq","fallback":true,"ms":0}', now() - interval '2 minutes' from generate_series(1, 2) g;
  insert into public.app_events (kind, detail, created_at) select 'suggest', '{"provider":"gemini","fallback":false,"ms":500}', now() - interval '3 minutes' from generate_series(1, 4) g;
  insert into public.app_events (kind, detail, created_at) select 'suggest', '{"provider":"groq","fallback":false,"ms":300}', now() - interval '1 day' from generate_series(1, 9) g;
  insert into public.app_events (kind, detail, created_at) select 'api_error', '{"route":"suggest","status":500}', now() - interval '5 minutes' from generate_series(1, 3) g;
  insert into public.app_events (kind, detail, created_at) select 'api_error', '{"route":"suggest","status":500}', now() - interval '5 hours' from generate_series(1, 7) g;
`);
// Review bank: 3 pending emoji puzzles, one of them a duplicate key.
await execAll(`
  insert into public.content_items (game_id, level, data, source, approved, rejected, item_key) values
    ('emoji-picture', 'family', '{"answer":"Sholay","emojis":"🤠"}', 'llm:groq', false, false, 'sholay'),
    ('emoji-picture', 'family', '{"answer":"Lagaan","emojis":"🏏"}', 'llm:groq', false, false, 'lagaan'),
    ('emoji-picture', 'family', '{"answer":"Dangal","emojis":"🤼"}', 'llm:gemini', false, false, 'dangal');
`);

const asRole = async (role, sql) => {
  try {
    await db.exec(`set role ${role}`);
    const r = await db.query(sql);
    return { ok: true, rows: r.rows };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    await db.exec("reset role");
  }
};
const scalar = async (sql) => (await db.query(sql)).rows[0];

// --- Access control -----------------------------------------------------------------------------
const newFns = ["admin_funnel()", "admin_quota_today()", "admin_health()", "admin_find_user('x@example.test')", "purge_old_data()"];
for (const role of ["anon", "authenticated"]) {
  for (const fn of newFns) {
    const r = await asRole(role, `select ${fn}`);
    check("ACC-1", `${role} cannot call ${fn}`, !r.ok && /permission denied/i.test(r.error), r.ok ? "call succeeded" : r.error);
  }
  const t = await asRole(role, "select count(*) from public.admin_audit");
  check("ACC-2", `${role} cannot read the audit log`, !t.ok && /permission denied/i.test(t.error), t.ok ? "read succeeded" : t.error);
}
// purge_old_data is destructive, so it is only called in the retention section below.
for (const fn of newFns.filter((f) => !f.startsWith("purge_old_data"))) {
  const r = await asRole("service_role", `select ${fn} as v`);
  check("ACC-3", `service_role can call ${fn}`, r.ok, r.error);
}
const rls = await db.query(`select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname in ('admin_audit','feature_flags','cron_runs','content_items')`);
for (const role of ["anon", "authenticated"]) {
  const t1 = await asRole(role, "truncate public.content_items");
  const t2 = await asRole(role, "truncate public.rooms");
  check("TRU-1", `${role} cannot truncate the review bank or rooms after 0008`, !t1.ok && !t2.ok && /permission denied/i.test(t1.error ?? "") && /permission denied/i.test(t2.error ?? ""), `${t1.error ?? "truncated"} / ${t2.error ?? "truncated"}`);
  const sel = await asRole(role, "select count(*) from public.app_events");
  check("TRU-2", `${role} cannot read app_events (no privilege at all)`, !sel.ok && /permission denied/i.test(sel.error ?? ""), sel.ok ? "read succeeded" : sel.error);
}
check("ACC-4", "new tables have row-level security on", rls.rows.length === 4 && rls.rows.every((r) => r.relrowsecurity === true), JSON.stringify(rls.rows));

// --- Audit, flags, cron_runs, content -----------------------------------------------------------
const auditRows = (await db.query(`select count(*)::int c from public.admin_audit`)).rows[0].c;
check("AUD-1", "audit table accepts rows (6 seeded)", auditRows === 6, `rows ${auditRows}`);
await execAll(`insert into public.feature_flags (key, enabled, note, updated_by) values ('llm:groq', false, 'test', 'owner')`);
const flagRow = (await db.query(`select enabled from public.feature_flags where key='llm:groq'`)).rows[0];
check("FLG-1", "a feature flag row can be switched off", flagRow.enabled === false);
let badKey = false;
try { await execAll(`insert into public.feature_flags (key) values ('Bad Key!')`); } catch { badKey = true; }
check("FLG-2", "flag keys must be lowercase slugs", badKey);
let dupBank = false;
try { await execAll(`insert into public.content_items (game_id, level, data, item_key) values ('emoji-picture','family','{}','sholay')`); } catch { dupBank = true; }
check("CNT-1", "the review bank refuses a duplicate key for the same game", dupBank);
// Old timestamp, so this row doesn't count as a route error in the last hour.
const badEvent = await execAll(`insert into public.app_events (kind, created_at) values ('api_error', now() - interval '3 years')`).then(() => true, () => false);
check("EVT-1", "api_error and cron_run are accepted event kinds", badEvent === true);
let badKind = false;
try { await db.exec(`insert into public.app_events (kind) values ('something_else')`); } catch { badKind = true; }
check("EVT-2", "unknown event kinds are still refused", badKind);

// --- Funnel -----------------------------------------------------------------------------------
const fu = (await asRole("service_role", "select admin_funnel() as v")).rows[0].v;
check("FUN-1", "signed up counts every account (30)", fu.signedUp === 30, JSON.stringify(fu));
check("FUN-2", "created a room counts distinct hosts with rooms (5)", fu.createdRoom === 5, JSON.stringify(fu));
check("FUN-3", "came back after 7 days counts the 3 accounts whose latest sign-in is 7+ days after signup", fu.cameBack7d === 3, JSON.stringify({ cameBack7d: fu.cameBack7d }));
check("FUN-4", "cohorts are weekly and include the last 8 weeks", Array.isArray(fu.cohorts) && fu.cohorts.length >= 1 && fu.cohorts.every((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.week)), JSON.stringify(fu.cohorts));

// --- Quota and health ---------------------------------------------------------------------------
const qt = (await asRole("service_role", "select admin_quota_today() as v")).rows[0].v;
check("QTA-1", "quota counts successful calls today by provider (groq 4, gemini 4)", qt.groq === 4 && qt.gemini === 4, JSON.stringify(qt));
check("QTA-2", "yesterday's calls are not counted today", !("groq" in qt) || qt.groq !== 13);
const hl = (await asRole("service_role", "select admin_health() as v")).rows[0].v;
check("HLT-1", "suggestions in the last hour (10 today, the 9 from yesterday excluded)", hl.suggestionsLastHour === 10, JSON.stringify(hl));
check("HLT-2", "fallbacks in the last hour (2)", hl.fallbacksLastHour === 2, JSON.stringify(hl));
check("HLT-3", "route errors in the last hour (3, not the 7 from 5 hours ago)", hl.errorsLastHour === 3, JSON.stringify(hl));
check("HLT-4", "last purge shows null until the cron has run once", hl.lastPurge === null || typeof hl.lastPurge === "object", JSON.stringify(hl.lastPurge));

// --- Email lookup -------------------------------------------------------------------------------
const found = (await asRole("service_role", "select admin_find_user('HOST7@example.test') as v")).rows[0].v;
check("FND-1", "email lookup is case-insensitive and returns the id", typeof found === "string" && found.length === 36);
const missing = (await asRole("service_role", "select admin_find_user('nobody@example.test') as v")).rows[0].v;
check("FND-2", "an unknown email returns null", missing === null);

// --- Retention -----------------------------------------------------------------------------------
const purged = (await asRole("service_role", "select purge_old_data() as v")).rows[0].v;
check("RET-1", "purge removes audit rows older than 365 days (2)", purged.audit === 2, JSON.stringify(purged));
check("RET-2", "purge removes cron runs older than 90 days (2)", purged.cronRuns === 2, JSON.stringify(purged));
check("RET-3", "purge keeps recent audit rows and host accounts", (await scalar("select count(*)::int c from public.admin_audit")).c === 4 && (await scalar("select count(*)::int c from auth.users")).c === 30);
check("RET-4", "purge reports the old room and login counts it had before", typeof purged.rooms === "number" && typeof purged.loginAttempts === "number", JSON.stringify(purged));

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
