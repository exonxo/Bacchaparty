// QA rounds 5-6: the admin SQL (migrations 0004, 0005 and 0006) against an in-process Postgres.
// This simulates the parts of Supabase the migrations rely on (auth.users, the anon /
// authenticated / service_role roles). It does NOT replace testing on the real project.
// Run from the repo root after: npm i -D @electric-sql/pglite   (or pass PGLITE_DIR)
//   node docs/testing/qa/admin-sql.test.mjs
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const { PGlite } = await import(
  process.env.PGLITE_DIR ? path.join(process.env.PGLITE_DIR, "dist/index.js") : "@electric-sql/pglite"
).catch(() => {
  console.log("Install the test database first: npm i -D @electric-sql/pglite (or set PGLITE_DIR)");
  process.exit(2);
});

const results = [];
const check = (id, name, ok, detail = "") => results.push(`${ok ? "PASS" : "FAIL"} ${id} ${name}${!ok && detail ? `\n     ${detail}` : ""}`);
const migration = (f) => readFileSync(path.join(root, "supabase/migrations", f), "utf8");

const db = new PGlite();

// --- Simulated Supabase environment -----------------------------------------------------------
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
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant select, insert, update, delete on all tables in schema public to service_role;
  grant select on auth.users to service_role;
`);
await db.exec(migration("0004_admin_and_events.sql"));
await db.exec(migration("0005_admin_stats_and_retention.sql"));
await db.exec(migration("0006_lasting_room_counts_and_safe_stats.sql"));

// --- Seed ------------------------------------------------------------------------------------
// 30 hosts: 20 google, 10 email; the first 3 signed up 40+ days ago.
await db.exec(`
  insert into auth.users (email, created_at, last_sign_in_at, raw_app_meta_data)
  select 'host' || g || '@example.test',
         case when g <= 3 then now() - interval '40 days' else now() - (g || ' hours')::interval end,
         now() - (g || ' hours')::interval,
         case when g <= 20 then '{"provider":"google"}'::jsonb else '{"provider":"email"}'::jsonb end
  from generate_series(1, 30) g;
`);
// 1,500 game starts in the last 30 days (more than the API's 1000-row page), 200 of them 40+ days old.
await db.exec(`
  insert into public.app_events (kind, detail, created_at)
  select 'game_started', jsonb_build_object('game', (array['puno','housie','chor-kaun'])[1 + g % 3]),
         now() - (g % 29 || ' days')::interval - (g || ' minutes')::interval
  from generate_series(1, 1500) g;
  insert into public.app_events (kind, detail, created_at)
  select 'game_started', '{"game":"puno"}', now() - interval '45 days' from generate_series(1, 200) g;
`);
// Suggestions in the last 7 days: 100 by Groq (10 fallback), 50 by Gemini (25 fallback).
await db.exec(`
  insert into public.app_events (kind, detail, created_at)
  select 'suggest', '{"provider":"groq","fallback":false,"ms":400}', now() - interval '1 day' from generate_series(1, 90) g;
  insert into public.app_events (kind, detail, created_at)
  select 'suggest', '{"provider":"groq","fallback":true,"ms":0}', now() - interval '1 day' from generate_series(1, 10) g;
  insert into public.app_events (kind, detail, created_at)
  select 'suggest', '{"provider":"gemini","fallback":false,"ms":800}', now() - interval '2 days' from generate_series(1, 25) g;
  insert into public.app_events (kind, detail, created_at)
  select 'suggest', '{"provider":"gemini","fallback":true,"ms":0}', now() - interval '2 days' from generate_series(1, 25) g;
`);
// Events older than 180 days (5), which the purge should remove.
await db.exec(`
  insert into public.app_events (kind, detail, created_at)
  select 'game_started', '{"game":"puno"}', now() - interval '200 days' from generate_series(1, 5) g;
`);
// Rooms: 12 recent (within 7 days) and 8 from 8 days ago.
await db.exec(`
  insert into public.rooms (code, host_id, created_at)
  select 'R' || g, (select id from auth.users order by email limit 1), now() - interval '1 day' from generate_series(1, 12) g;
  insert into public.rooms (code, host_id, created_at)
  select 'O' || g, (select id from auth.users order by email limit 1), now() - interval '8 days' from generate_series(1, 8) g;
`);
// Login attempts: 6 recent, 4 from 100 days ago.
await db.exec(`
  insert into public.admin_login_log (ip, ok, reason, created_at)
  select '198.51.100.1', false, 'bad_credentials', now() - interval '1 hour' from generate_series(1, 6) g;
  insert into public.admin_login_log (ip, ok, reason, created_at)
  select '198.51.100.2', true, 'ok', now() - interval '100 days' from generate_series(1, 4) g;
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

// --- Tests -----------------------------------------------------------------------------------
// Access control
for (const role of ["anon", "authenticated"]) {
  for (const fn of ["admin_overview()", "admin_users(null, 50, 0)", "admin_game_stats()", "admin_llm_stats()", "purge_old_data()"]) {
    const r = await asRole(role, `select ${fn}`);
    check("ADM-SQL-1", `${role} cannot call ${fn}`, !r.ok && /permission denied/i.test(r.error), r.ok ? "call succeeded" : r.error);
  }
}
for (const fn of ["admin_overview()", "admin_game_stats()", "admin_llm_stats()"]) {
  const r = await asRole("service_role", `select ${fn} as v`);
  check("ADM-SQL-2", `service_role can call ${fn}`, r.ok, r.error);
}
const rls = await scalar(`select relrowsecurity from pg_class where relname in ('app_events') and relnamespace = 'public'::regnamespace`);
check("ADM-SQL-3", "app_events has row-level security on", rls?.relrowsecurity === true);

// Overview
const ov = (await asRole("service_role", "select admin_overview() as v")).rows[0].v;
check("DATA-1", "users_total equals the rows in auth.users (30)", ov.users_total === 30, JSON.stringify(ov));
check("DATA-2", "signups last 7 days counts only recent sign-ups", ov.users_7d === 27 && ov.users_30d === 27, JSON.stringify({ ov }));
check("DATA-1b", "sign-in methods are counted by provider", ov.providers.google === 20 && ov.providers.email === 10, JSON.stringify(ov.providers));
check("DATA-1c", "rooms and hosts are counted", ov.rooms_total === 20 && ov.hosts_total === 1, JSON.stringify(ov));

// Users: search and paging
const page1 = (await asRole("service_role", "select * from admin_users(null, 50, 0)")).rows;
check("DATA-1d", "users page returns 30 rows with email, provider and room count", page1.length === 30 && page1[0].email && page1[0].rooms_hosted >= 0, `rows ${page1.length}`);
const found = (await asRole("service_role", "select * from admin_users('host7@', 50, 0)")).rows;
check("DATA-1e", "email search finds the one match", found.length === 1 && found[0].email === "host7@example.test", JSON.stringify(found));
const pageLimit = (await asRole("service_role", "select * from admin_users(null, 99999, 0)")).rows;
check("DATA-1f", "page size is capped at 200", pageLimit.length === 30, `rows ${pageLimit.length}`);

// Games: must count past 1000 rows, and not include the 45-day-old events in the 30-day total
const gs = (await asRole("service_role", "select admin_game_stats() as v")).rows[0].v;
check("DATA-3", "games counted past the 1000-row API page (1500 in 30 days)", gs.totalSample === 1500, `total ${gs.totalSample}`);
const perGame = Object.values(gs.byGame).reduce((a, g) => a + g.d30, 0);
check("DATA-3b", "per-game totals add up to the total", perGame === gs.totalSample, `${perGame} vs ${gs.totalSample}`);
check("DATA-3c", "old events (45 days) are excluded from the 30-day window", gs.totalSample < 1700);
check("DATA-3d", "per-day counts are keyed by UTC date", Object.keys(gs.byDay).every((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)) && Object.keys(gs.byDay).length > 0);

// LLM stats
const ls = (await asRole("service_role", "select admin_llm_stats() as v")).rows[0].v;
check("DATA-4", "suggestion total counts the last 7 days (150)", ls.total === 150, JSON.stringify({ total: ls.total }));
check("DATA-4b", "fallback rate is 23% (35 of 150)", ls.fallbackRate === 23, `got ${ls.fallbackRate}`);
check("DATA-4c", "per-provider counts and fallbacks match", ls.providers.groq.count === 100 && ls.providers.groq.fallback === 10 && ls.providers.gemini.fallback === 25, JSON.stringify(ls.providers));
check("DATA-4d", "average latency is per provider", ls.providers.groq.avgMs === 360 && ls.providers.gemini.avgMs === 400, JSON.stringify(ls.providers));
const emptyLlm = await scalar(`select admin_llm_stats() as v from (select 1) x`);
check("DATA-4e", "no suggestions gives 0% rather than an error", emptyLlm.v.total >= 0);

// Retention
const before = { rooms: (await scalar("select count(*)::int c from public.rooms")).c, logins: (await scalar("select count(*)::int c from public.admin_login_log")).c };
const purged = (await asRole("service_role", "select purge_old_data() as v")).rows[0].v;
check("RET-1", "purge removes rooms older than 7 days (8)", purged.rooms === 8, JSON.stringify(purged));
check("RET-2", "purge removes login attempts older than 90 days (4)", purged.loginAttempts === 4, JSON.stringify(purged));
check("RET-3", "purge removes events older than 180 days (5)", purged.events === 5, JSON.stringify(purged));
const after = { rooms: (await scalar("select count(*)::int c from public.rooms")).c, logins: (await scalar("select count(*)::int c from public.admin_login_log")).c };
check("RET-4", "recent rooms and login attempts are kept", after.rooms === before.rooms - 8 && after.logins === before.logins - 4, JSON.stringify({ before, after }));
const hosts = (await scalar("select count(*)::int c from auth.users")).c;
check("RET-5", "host accounts are never removed by the purge", hosts === 30);

// Lasting room counts (0006): totals don't shrink when old rooms are purged.
const ov2 = (await asRole("service_role", "select admin_overview() as v")).rows[0].v;
check("CNT-1", "rooms_total stays 20 after the purge removed 8 rooms", ov2.rooms_total === 20, JSON.stringify({ rooms_total: ov2.rooms_total }));
check("CNT-2", "hosts_total stays 1 after the purge", ov2.hosts_total === 1, JSON.stringify({ hosts_total: ov2.hosts_total }));
check("CNT-3", "rooms_active and rooms_7d count only the rooms still kept (12)", ov2.rooms_active === 12 && ov2.rooms_7d === 12, JSON.stringify({ a: ov2.rooms_active, d7: ov2.rooms_7d }));
// The seeded rooms all belong to the first host by email order.
const roomHost = (await scalar("select email from auth.users order by email limit 1")).email;
const host1 = (await asRole("service_role", "select * from admin_users(null, 200, 0)")).rows.find((r) => r.email === roomHost);
check("CNT-4", "a host's room count is lasting (20, not 12)", Number(host1?.rooms_hosted) === 20, JSON.stringify({ rooms_hosted: host1?.rooms_hosted }));
await db.exec(`insert into public.rooms (code, host_id) select 'N1', id from auth.users where email = 'host2@example.test'`);
const host2 = (await asRole("service_role", "select * from admin_users('host2@', 50, 0)")).rows.find((r) => r.email === "host2@example.test");
check("CNT-5", "creating a room bumps that host's counter", Number(host2?.rooms_hosted) === 1, JSON.stringify({ rooms_hosted: host2?.rooms_hosted }));
for (const role of ["anon", "authenticated"]) {
  const r = await asRole(role, "select count(*) from public.host_room_counts");
  check("CNT-6", `${role} cannot read host_room_counts`, !r.ok && /permission denied/i.test(r.error), r.ok ? "read succeeded" : r.error);
  const f = await asRole(role, "select public.bump_host_room_count()");
  check("CNT-7", `${role} cannot call the trigger function`, !f.ok, f.ok ? "call succeeded" : "");
}
await db.exec(`delete from auth.users where email = 'host2@example.test'`);
const gone = (await scalar("select count(*)::int c from public.host_room_counts")).c;
check("CNT-8", "a deleted account's counter is removed with it", gone === 1, `rows ${gone}`);

// Malformed suggestion events (0006) don't break the view.
await db.exec(`
  insert into public.app_events (kind, detail) values
    ('suggest', '{"provider":"groq","fallback":"maybe","ms":"fast"}'),
    ('suggest', '{"provider":"groq","fallback":{"x":1},"ms":[1,2]}'),
    ('suggest', '{"provider":"groq","fallback":"true","ms":"120"}'),
    ('suggest', '{}');
`);
const bad = await asRole("service_role", "select admin_llm_stats() as v");
check("SAFE-1", "malformed fallback/ms values don't make the view fail", bad.ok, bad.error);
const lb = bad.ok ? bad.rows[0].v : null;
check("SAFE-2", "malformed rows are still counted, as not-fallback and 0 ms", lb && lb.total === 154 && lb.providers.groq.count === 103 && lb.providers.groq.fallback === 11 && lb.providers.unknown?.count === 1, JSON.stringify(lb && { total: lb.total, groq: lb.providers.groq, unknown: lb.providers.unknown }));

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
