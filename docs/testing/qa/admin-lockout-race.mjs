// QA round 8: is the login lockout really atomic? Needs a REAL local Postgres (PGlite runs one
// connection at a time, so it can't show a race). Creates a scratch database, applies the parts
// of the migrations the lockout uses (0004 and 0009), fires parallel attempts from one IP over
// separate connections, then drops the scratch database.
//   PG_URL=postgres://user:pass@127.0.0.1:5432/postgres PG_DIR=/path/to/node_modules/pg \
//     node docs/testing/qa/admin-lockout-race.mjs
// (`npm i --no-save pg` works too, then PG_DIR is not needed.) Local servers only.
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const PG_URL = process.env.PG_URL ?? "";
if (!/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(PG_URL)) {
  console.log("Set PG_URL to a local Postgres (localhost or 127.0.0.1). This test creates and drops a scratch database.");
  process.exit(2);
}
const pgMod = await import(process.env.PG_DIR ? path.join(process.env.PG_DIR, "lib/index.js") : "pg").catch(() => {
  console.log("Install the driver first: npm i --no-save pg (or set PG_DIR).");
  process.exit(2);
});
const { Client } = pgMod.default ?? pgMod;
const migration = (f) => readFileSync(path.join(root, "supabase/migrations", f), "utf8");

const results = [];
const check = (id, name, ok, detail = "") => results.push(`${ok ? "PASS" : "FAIL"} ${id} ${name}${!ok && detail ? `\n     ${detail}` : ""}`);

const dbName = `bawaal_race_${process.pid}`;
const admin = new Client({ connectionString: PG_URL });
await admin.connect();
await admin.query(`create database ${dbName}`);
const url = new URL(PG_URL);
url.pathname = `/${dbName}`;
const connect = async () => {
  const c = new Client({ connectionString: url.toString() });
  await c.connect();
  return c;
};

try {
  const setup = await connect();
  await setup.query(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
    end $$;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, created_at timestamptz not null default now(),
      last_sign_in_at timestamptz, raw_app_meta_data jsonb not null default '{}'::jsonb, raw_user_meta_data jsonb not null default '{}'::jsonb);
    create table public.rooms (id uuid primary key default gen_random_uuid(), code text not null,
      host_id uuid not null references auth.users (id) on delete cascade, created_at timestamptz not null default now(), closed_at timestamptz);
  `);
  await setup.query(migration("0004_admin_and_events.sql"));
  await setup.query(migration("0009_session_revocation_and_atomic_lockout.sql"));
  // The pre-0009 behaviour, for comparison: count, a short pause (the password check), then insert.
  await setup.query(`
    create function public.race_two_step(p_ip text) returns boolean language plpgsql as $$
    begin
      if (select count(*) from public.admin_login_log where ip = p_ip and ok = false and created_at >= now() - interval '15 minutes') >= 5 then
        return false;
      end if;
      perform pg_sleep(0.05);
      insert into public.admin_login_log (ip, ok, reason) values (p_ip, false, 'bad_credentials');
      return true;
    end $$;
  `);
  await setup.end();

  const N = 20;
  const clients = await Promise.all(Array.from({ length: N }, connect));

  const oldWay = await Promise.all(clients.map((c) => c.query("select public.race_two_step('192.0.2.1') as v").then((r) => r.rows[0].v)));
  const oldPassed = oldWay.filter(Boolean).length;
  check("RACE-0", `control: the old two-step check lets more than 5 of ${N} parallel attempts through (${oldPassed})`, oldPassed > 5, `passed ${oldPassed}`);

  const newWay = await Promise.all(clients.map((c) => c.query("select public.admin_login_begin('192.0.2.2', 5, 900) as v").then((r) => r.rows[0].v)));
  const newPassed = newWay.filter((v) => v !== null).length;
  check("RACE-1", `admin_login_begin lets exactly 5 of ${N} parallel attempts through`, newPassed === 5, `passed ${newPassed}`);

  const c0 = clients[0];
  const rows = (await c0.query("select count(*)::int n from public.admin_login_log where ip = '192.0.2.2'")).rows[0].n;
  check("RACE-2", "exactly 5 rows were recorded for that IP (refused attempts write nothing)", rows === 5, `rows ${rows}`);

  // Parallel attempts on two IPs don't block each other's slots.
  const mixed = await Promise.all(clients.map((c, i) => c.query(`select public.admin_login_begin('192.0.2.${10 + (i % 2)}', 5, 900) as v`).then((r) => r.rows[0].v)));
  check("RACE-3", "with two IPs in parallel, each gets exactly 5", mixed.filter((v, i) => v !== null && i % 2 === 0).length === 5 && mixed.filter((v, i) => v !== null && i % 2 === 1).length === 5);

  await Promise.all(clients.map((c) => c.end()));
} catch (e) {
  check("RACE-ERR", "test ran", false, e.message.split("\n")[0]);
} finally {
  await admin.query(`drop database if exists ${dbName} with (force)`).catch(() => {});
  await admin.end();
}

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
