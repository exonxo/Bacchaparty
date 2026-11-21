// Content library: can two picks at the same moment give one viewer the same item? Needs a REAL
// local Postgres (PGlite runs one connection at a time). Creates a scratch database, applies 0010 and 0011
// on a minimal Supabase stand-in, fires parallel picks for one viewer over separate connections,
// then drops the scratch database.
//   PG_URL=postgres://user:pass@127.0.0.1:5432/postgres PG_DIR=/path/to/node_modules/pg \
//     node docs/testing/qa/content-library-race.mjs
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

const dbName = `bawaal_library_race_${process.pid}`;
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
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  `);
  await setup.query(migration("0010_content_library.sql"));
  await setup.query(migration("0011_library_theme.sql"));
  const items = Array.from({ length: 40 }, (_, i) => ({ category: "family", key: `Race dare number ${i}`, data: { text: `Race dare number ${i}` } }));
  await setup.query(`select library_add('dare', 'dare', 'en', 'llm:test', $1::jsonb)`, [JSON.stringify(items)]);
  const user = (await setup.query(`insert into auth.users (email) values ('race@example.test') returning id`)).rows[0].id;

  // Same pick, the version without the per-viewer lock, for comparison: the race should show up there.
  await setup.query(`
    create function public.race_pick_unlocked(p_viewer text) returns setof bigint language plpgsql as $$
    declare v bigint;
    begin
      select l.id into v from public.content_library l
      where l.kind = 'dare' and not exists (select 1 from public.content_seen s where s.viewer = p_viewer and s.item_id = l.id)
      order by l.id limit 1;
      perform pg_sleep(0.05);
      insert into public.content_seen (viewer, item_id) values (p_viewer, v) on conflict (viewer, item_id) do update set seen_at = now();
      return next v;
    end $$;
  `);
  await setup.end();

  const N = 20;
  const clients = await Promise.all(Array.from({ length: N }, connect));
  const picks = await Promise.all(clients.map((c) => c.query(`select id from library_pick($1::uuid, null, 'dare', array['family'], 'en', 1, 1)`, [user]).then((r) => r.rows[0]?.id ?? null, (e) => `error: ${e.message}`)));
  const errors = picks.filter((p) => String(p).startsWith("error:"));
  const ids = picks.filter((p) => p != null && !String(p).startsWith("error:"));
  check("RACE-1", `${N} parallel picks for one host all succeed`, errors.length === 0 && ids.length === N, JSON.stringify(errors.slice(0, 2)));
  check("RACE-2", `the ${N} parallel picks return ${N} different items (no repeat)`, new Set(ids.map(String)).size === N, `${new Set(ids.map(String)).size} distinct`);
  const seen = (await clients[0].query(`select count(*)::int n from content_seen where user_id = $1`, [user])).rows[0].n;
  check("RACE-3", `the seen log has exactly ${N} rows for that host`, seen === N, `got ${seen}`);

  const loose = await Promise.all(clients.slice(0, 10).map((c) => c.query(`select race_pick_unlocked('a:guest_race_unlocked_01') id`).then((r) => String(r.rows[0].id), () => "err")));
  check("RACE-4", "control: without the lock, parallel picks DO repeat an item (shows the test can see a race)", new Set(loose).size < loose.length, `${new Set(loose).size} distinct of ${loose.length}`);
  await Promise.all(clients.map((c) => c.end()));
} finally {
  await admin.query(`drop database if exists ${dbName} with (force)`);
  await admin.end();
}
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
