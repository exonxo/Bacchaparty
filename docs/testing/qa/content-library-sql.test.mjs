// Content library SQL (migration 0010, applied after 0004 to 0009) against an in-process Postgres.
// Simulates the parts of Supabase the migrations rely on (auth.users, anon / authenticated /
// service_role and Supabase's default privileges). Not a substitute for testing on the real project.
// Run after: npm i --no-save @electric-sql/pglite   (or set PGLITE_DIR to the package folder)
//   node docs/testing/qa/content-library-sql.test.mjs
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

// --- Simulated Supabase (same as admin-power-sql.test.mjs) --------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
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
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant select, insert, update, delete on all tables in schema public to service_role;
  grant select on auth.users to service_role;
`);
const FILES = [
  "0004_admin_and_events.sql", "0005_admin_stats_and_retention.sql", "0006_lasting_room_counts_and_safe_stats.sql",
  "0007_power_admin.sql", "0008_review_followups.sql", "0009_session_revocation_and_atomic_lockout.sql", "0010_content_library.sql",
  "0011_library_theme.sql",
];
let migrationsOk = true;
for (const f of FILES) {
  try {
    await db.exec(migration(f));
  } catch (e) {
    migrationsOk = false;
    check("MIG", `migration ${f} applies cleanly`, false, e.message.split("\n")[0]);
  }
}
check("MIG-1", "migrations 0004 to 0011 apply cleanly in order", migrationsOk);
const rerun = await db.exec(migration("0010_content_library.sql")).then(() => null, (e) => e.message.split("\n")[0]);
check("MIG-2", "0010 can be run a second time", rerun === null, rerun ?? "");
const rerun11 = await db.exec(migration("0011_library_theme.sql")).then(() => null, (e) => e.message.split("\n")[0]);
check("MIG-3", "0011 can be run a second time (after 0010 again too)", rerun11 === null, rerun11 ?? "");

const asRole = async (role, sql, params) => {
  try {
    await db.exec(`set role ${role}`);
    const r = await db.query(sql, params);
    return { ok: true, rows: r.rows };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    await db.exec("reset role");
  }
};
const svc = (sql, params) => asRole("service_role", sql, params);

// Two hosts.
const [hostA, hostB] = (await db.query(`insert into auth.users (email) values ('a@example.test'), ('b@example.test') returning id`)).rows.map((r) => r.id);
const ANON = "guest_1234567890abcdef";

// --- Access control -----------------------------------------------------------------------------
const rls = (await db.query(`select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname in ('content_library', 'content_seen')`)).rows;
check("ACC-1", "row-level security is on for both library tables", rls.length === 2 && rls.every((r) => r.relrowsecurity), JSON.stringify(rls));
const privs = (await db.query(`
  select c.relname, r.rolname, p.priv from pg_class c
  cross join (values ('anon'), ('authenticated')) r(rolname)
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(priv)
  where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname in ('content_library', 'content_seen')
    and has_table_privilege(r.rolname, c.oid, p.priv)`)).rows;
check("ACC-2", "anon and authenticated hold no privilege on content_library or content_seen", privs.length === 0, JSON.stringify(privs));
const seqPrivs = (await db.query(`
  select r.rolname from (values ('anon'), ('authenticated')) r(rolname)
  where has_sequence_privilege(r.rolname, 'public.content_library_id_seq', 'USAGE') or has_sequence_privilege(r.rolname, 'public.content_library_id_seq', 'SELECT')
     or has_sequence_privilege(r.rolname, 'public.content_library_id_seq', 'UPDATE')`)).rows;
check("ACC-3", "anon and authenticated can't use the library id sequence", seqPrivs.length === 0, JSON.stringify(seqPrivs));
const FNS = [
  "library_norm('x')",
  `library_viewer(null, '${ANON}')`,
  `library_pick(null, '${ANON}', 'dare', array['family'])`,
  `library_add('dare', 'dare', 'en', 'llm:test', '[]'::jsonb)`,
  "admin_library_counts()",
];
for (const role of ["anon", "authenticated"]) {
  for (const fn of FNS) {
    const r = await asRole(role, `select ${fn}`);
    check("ACC-4", `${role} cannot call ${fn.split("(")[0]}`, !r.ok && /permission denied/i.test(r.error), r.ok ? "call succeeded" : r.error);
  }
  const read = await asRole(role, "select count(*) from public.content_library");
  const write = await asRole(role, "insert into public.content_seen (viewer, item_id) values ('a:guest_1234567890abcdef', 1)");
  check("ACC-5", `${role} can neither read the library nor write the seen log`, !read.ok && !write.ok && /permission denied/i.test(read.error) && /permission denied/i.test(write.error), `${read.error ?? "read"} / ${write.error ?? "wrote"}`);
}
const openFns = (await db.query(`
  select p.proname, r.rolname from pg_proc p cross join (values ('anon'), ('authenticated')) r(rolname)
  where p.pronamespace = 'public'::regnamespace and (p.proname like 'library_%' or p.proname = 'admin_library_counts')
    and has_function_privilege(r.rolname, p.oid, 'EXECUTE')`)).rows;
check("ACC-6", "no library function is executable by anon or authenticated (generic check)", openFns.length === 0, JSON.stringify(openFns));
const definer = (await db.query(`select proname, prosecdef, proconfig from pg_proc where pronamespace = 'public'::regnamespace and proname in ('library_pick', 'library_add', 'admin_library_counts')`)).rows;
check("ACC-7", "the serving, saving and counting functions are security definer with a fixed search_path", definer.length === 3 && definer.every((r) => r.prosecdef && (r.proconfig ?? []).some((c) => c.startsWith("search_path="))), JSON.stringify(definer));

// --- Normalising and de-duplication ---------------------------------------------------------------
const norm = (await svc(`select library_norm('  Sholay!!  ') a, library_norm('SHOLAY') b, library_norm('Dil  Chahta-Hai') c`)).rows[0];
check("DUP-1", "normalising ignores case, punctuation and extra spaces", norm.a === "sholay" && norm.b === "sholay" && norm.c === "dil chahta hai", JSON.stringify(norm));
const emoji = (answer, level) => ({ category: level, key: answer, data: { emojis: "🎬", answer, hint: "film", category: "Movie", level } });
const add = async (kind, game, items, extra = "null, null, false") =>
  svc(`select library_add('${kind}', '${game}', 'en', 'llm:groq', $1::jsonb, ${extra}) as n`, [JSON.stringify(items)]);
const first = await add("emoji-puzzle", "emoji-picture", [emoji("Sholay", "family"), emoji(" sholay! ", "family"), emoji("Lagaan", "family")]);
check("DUP-2", "a batch with the same answer twice stores it once", first.ok && first.rows[0].n === 2, first.error ?? JSON.stringify(first.rows));
const second = await add("emoji-puzzle", "emoji-picture", [emoji("SHOLAY", "kids"), emoji("Dangal", "family")]);
check("DUP-3", "an answer already in the library (any case, any level) is skipped", second.ok && second.rows[0].n === 1, second.error ?? JSON.stringify(second.rows));
const total = (await svc("select count(*)::int n from content_library where kind = 'emoji-puzzle'")).rows[0].n;
check("DUP-4", "exactly 3 distinct emoji items are stored", total === 3, `got ${total}`);
const dupInsert = await svc(`insert into content_library (kind, game_id, text_key, text_norm, data, source) values ('emoji-puzzle', 'emoji-picture', 'Lagaan', 'lagaan', '{}', 'manual')`);
check("DUP-5", "the unique index refuses a direct duplicate", !dupInsert.ok && /duplicate key|unique/i.test(dupInsert.error), dupInsert.error ?? "inserted");
const badKind = await svc(`insert into content_library (kind, game_id, text_key, text_norm, data, source) values ('quiz', 'x', 'k', 'k', '{}', 'manual')`);
check("DUP-6", "an unknown kind is refused by the check constraint", !badKind.ok && /content_library_kind_check/.test(badKind.error), badKind.error ?? "inserted");
const tooMany = await add("dare", "dare", Array.from({ length: 51 }, (_, i) => ({ category: "family", key: `dare ${i}`, data: { text: `dare ${i}` } })));
check("DUP-7", "more than 50 items in one call are refused", !tooMany.ok && /at most 50/.test(tooMany.error), tooMany.error ?? "accepted");
const source = (await svc("select distinct source, created_for from content_library")).rows;
check("DUP-8", "the generation source is stored on every item", source.length === 1 && source[0].source === "llm:groq", JSON.stringify(source));

// --- Serving rules ----------------------------------------------------------------------------------
// 6 family dares, 2 mixed dares.
await add("dare", "dare", Array.from({ length: 6 }, (_, i) => ({ category: "family", key: `Family dare number ${i}`, data: { text: `Family dare number ${i}` } })));
await add("dare", "dare", Array.from({ length: 2 }, (_, i) => ({ category: "mixed", key: `Mixed dare number ${i}`, data: { text: `Mixed dare number ${i}` } })));
const pick = (user, anon, cats, count = 1, min = 1, exNorms = "{}", exIds = "{}") =>
  svc(`select id, category, data from library_pick(${user ? `'${user}'` : "null"}, ${anon ? `'${anon}'` : "null"}, 'dare', $1::text[], 'en', ${count}, ${min}, $2::text[], $3::text[])`, [cats, exNorms, exIds]);

const p1 = await pick(hostA, null, ["family"], 4);
check("SRV-1", "a viewer gets the number asked for, all from the requested category", p1.ok && p1.rows.length === 4 && p1.rows.every((r) => r.category === "family"), p1.error ?? JSON.stringify(p1.rows));
const p2 = await pick(hostA, null, ["family"], 4);
const overlap = p2.ok ? p2.rows.filter((r) => p1.rows.some((x) => x.id === r.id)).length : -1;
check("SRV-2", "the next pick only returns items not yet shown (2 left of 6)", p2.ok && p2.rows.length === 2 && overlap === 0, p2.error ?? JSON.stringify({ n: p2.rows.length, overlap }));
const p3 = await pick(hostA, null, ["family"], 4);
check("SRV-3", "with everything shown, nothing is returned (no repeats within 30 days)", p3.ok && p3.rows.length === 0, p3.error ?? JSON.stringify(p3.rows));
const pB = await pick(hostB, null, ["family"], 10);
check("SRV-4", "another host's seen log is separate: they get all 6", pB.ok && pB.rows.length === 6, pB.error ?? `${pB.rows.length}`);
const seenA = (await svc(`select count(*)::int n from content_seen where viewer = 'u:${hostA}' and user_id = '${hostA}'`)).rows[0].n;
check("SRV-5", "the seen log is keyed by account id (6 rows for host A, no email)", seenA === 6, `got ${seenA}`);
const emailCols = (await db.query(`select table_name, column_name from information_schema.columns where table_schema = 'public' and table_name in ('content_library', 'content_seen') and column_name ilike '%mail%'`)).rows;
check("SRV-6", "neither table has an email column", emailCols.length === 0, JSON.stringify(emailCols));

// 29 days: still blocked. 31 days: eligible again.
await db.exec(`update content_seen set seen_at = now() - interval '29 days' where viewer = 'u:${hostA}'`);
const p29 = await pick(hostA, null, ["family"], 10);
check("SRV-7", "items shown 29 days ago are still not repeated", p29.ok && p29.rows.length === 0, p29.error ?? `${p29.rows.length} returned`);
await db.exec(`update content_seen set seen_at = now() - interval '31 days' where viewer = 'u:${hostA}' and item_id in (select id from content_library where text_key in ('Family dare number 0', 'Family dare number 1'))`);
const p31 = await pick(hostA, null, ["family"], 10);
const p31keys = p31.ok ? p31.rows.map((r) => r.data.text).sort() : [];
check("SRV-8", "items shown more than 30 days ago come back, and only those", p31.ok && p31.rows.length === 2 && p31keys.join("|") === "Family dare number 0|Family dare number 1", p31.error ?? JSON.stringify(p31keys));
const refreshed = (await svc(`select count(*)::int n from content_seen where viewer = 'u:${hostA}' and seen_at > now() - interval '1 minute'`)).rows[0].n;
check("SRV-9", "serving them again restarts their 30 days", refreshed === 2, `got ${refreshed}`);
const stale = (await svc(`select count(*)::int n from content_seen where seen_at < now() - interval '30 days'`)).rows[0].n;
check("SRV-10", "the viewer's expired seen rows are cleared when they ask again", stale === 0, `got ${stale}`);

// Minimum: fewer eligible than p_min returns nothing and records nothing.
const before = (await svc("select count(*)::int n from content_seen")).rows[0].n;
const pMin = await pick(null, ANON, ["mixed"], 5, 3);
const after = (await svc("select count(*)::int n from content_seen")).rows[0].n;
check("SRV-11", "when fewer than the minimum are eligible, nothing is served or recorded", pMin.ok && pMin.rows.length === 0 && before === after, pMin.error ?? JSON.stringify({ rows: pMin.rows.length, before, after }));
const pAnon = await pick(null, ANON, ["mixed"], 5, 2);
check("SRV-12", "a guest (anonymous id) is served and logged without an account", pAnon.ok && pAnon.rows.length === 2, pAnon.error ?? `${pAnon.rows.length}`);
const anonRows = (await svc(`select count(*)::int n from content_seen where viewer = 'a:${ANON}' and user_id is null`)).rows[0].n;
check("SRV-13", "the guest's seen rows carry no account id", anonRows === 2, `got ${anonRows}`);
const noViewer = await pick(null, null, ["family"]);
check("SRV-14", "a pick with no viewer is refused", !noViewer.ok && /viewer/.test(noViewer.error), noViewer.error ?? "served");
const badAnon = await pick(null, "short", ["family"]);
check("SRV-15", "a malformed anonymous id is refused", !badAnon.ok && /viewer/.test(badAnon.error), badAnon.error ?? "served");

// Exclusions and inactive items. A fresh guest sees the 6 family dares.
const G2 = "guest_abcdefabcdef0002";
await db.exec(`update content_library set active = false where text_key = 'Family dare number 5'`);
const pEx = await pick(null, G2, ["family"], 10, 1, "{family dare number 0}");
const exKeys = pEx.ok ? pEx.rows.map((r) => r.data.text) : [];
check("SRV-16", "excluded texts and switched-off items are never served", pEx.ok && exKeys.length === 4 && !exKeys.includes("Family dare number 0") && !exKeys.includes("Family dare number 5"), pEx.error ?? JSON.stringify(exKeys));
await add("chor-kaun-topic", "chor-kaun", [
  { category: "any", key: "Rivers", data: { id: "rivers", label: "Rivers", emoji: "🌊", words: [] } },
  { category: "any", key: "Spices", data: { id: "spices", label: "Spices", emoji: "🌶️", words: [] } },
]);
const pIds = await svc(`select data from library_pick(null, '${G2}', 'chor-kaun-topic', array['any'], 'en', 5, 1, '{}', array['rivers'])`);
check("SRV-17", "excluded topic ids are never served", pIds.ok && pIds.rows.length === 1 && pIds.rows[0].data.id === "spices", pIds.error ?? JSON.stringify(pIds.rows));
const pCap = await svc(`select count(*)::int n from library_pick(null, 'guest_capcapcapcapcap03', 'dare', array['family','mixed'], 'en', 9999, 1)`);
check("SRV-18", "a pick is capped at 30 items", pCap.ok && pCap.rows[0].n <= 30, pCap.error ?? "");
const served = (await svc(`select served_count::int n from content_library where text_key = 'Family dare number 0'`)).rows[0].n;
check("SRV-19", "served counts go up each time an item is served", served >= 3, `got ${served}`);

// Random order: over 30 picks from 5 items, more than one item comes first.
const firsts = new Set();
for (let i = 0; i < 30; i++) {
  const r = await svc(`select data->>'text' t from library_pick(null, 'guest_random${String(i).padStart(10, "0")}', 'dare', array['family'], 'en', 1, 1)`);
  if (r.ok && r.rows[0]) firsts.add(r.rows[0].t);
}
check("SRV-20", "the item served is picked at random", firsts.size > 1, `only ${[...firsts].join(", ")}`);

// Saving with mark-seen: what a host was just shown is recorded for them, new or already known.
const marked = await add("dare", "dare", [{ category: "family", key: "Family dare number 1", data: { text: "Family dare number 1" } }, { category: "family", key: "Brand new dare", data: { text: "Brand new dare" } }], `'${hostB}', null, true`);
const bSeen = (await svc(`select l.text_key from content_seen s join content_library l on l.id = s.item_id where s.viewer = 'u:${hostB}' and l.text_key in ('Family dare number 1', 'Brand new dare') order by 1`)).rows.map((r) => r.text_key);
check("SRV-21", "saving with a viewer stores only the new item but records both as shown", marked.ok && marked.rows[0].n === 1 && bSeen.join("|") === "Brand new dare|Family dare number 1", marked.error ?? JSON.stringify({ n: marked.rows[0]?.n, bSeen }));
const owner = (await svc(`select created_for from content_library where text_key = 'Brand new dare'`)).rows[0].created_for;
check("SRV-22", "the host whose game made an item is recorded by account id", owner === hostB, String(owner));

// --- Counts -----------------------------------------------------------------------------------------
const counts = (await svc("select admin_library_counts() c")).rows[0].c;
const row = (k, c) => counts.rows.find((r) => r.kind === k && r.category === c);
check("CNT-1", "counts: 14 items in total, 13 switched on", counts.total === 14 && counts.active === 13, JSON.stringify({ t: counts.total, a: counts.active }));
check("CNT-2", "counts per game and category are exact", row("dare", "family")?.total === 7 && row("dare", "family")?.active === 6 && row("dare", "mixed")?.total === 2 && row("emoji-puzzle", "family")?.total === 3 && row("chor-kaun-topic", "any")?.total === 2, JSON.stringify(counts.rows));
const emptyCounts = await (async () => {
  await db.exec("begin");
  try {
    await db.exec("delete from content_library");
    return (await svc("select admin_library_counts() c")).rows[0].c;
  } finally {
    await db.exec("rollback");
  }
})();
check("CNT-3", "counts on an empty library are zero and an empty list", emptyCounts.total === 0 && emptyCounts.servedTotal === 0 && Array.isArray(emptyCounts.rows) && emptyCounts.rows.length === 0, JSON.stringify(emptyCounts));

// --- Themes (0011) ------------------------------------------------------------------------------------
const themed = await add("emoji-puzzle", "emoji-picture", [
  { ...emoji("Taare Zameen Par", "family"), theme: "Bollywood movies" },
  { ...emoji("Swades", "family"), theme: "  Bollywood\n movies\t " },
  { ...emoji("Ghajini", "family"), theme: "x".repeat(80) },
  emoji("Dhoom", "family"),
]);
check("THEME-1", "items with themes are stored (4 new)", themed.ok && themed.rows[0].n === 4, themed.error ?? JSON.stringify(themed.rows));
const themes = Object.fromEntries((await svc(`select text_key, theme from content_library where text_key in ('Taare Zameen Par', 'Swades', 'Ghajini', 'Dhoom')`)).rows.map((r) => [r.text_key, r.theme]));
check("THEME-2", "the theme is saved on the item", themes["Taare Zameen Par"] === "Bollywood movies", JSON.stringify(themes));
check("THEME-3", "line breaks and tabs in a theme are turned into single spaces, not refused", themes["Swades"] === "Bollywood movies", JSON.stringify(themes));
check("THEME-4", "a theme is cut to 60 characters", themes["Ghajini"]?.length === 60, JSON.stringify(themes));
check("THEME-5", "an item without a theme keeps theme = null", themes["Dhoom"] === null, JSON.stringify(themes));
const rawLong = await svc(`insert into content_library (kind, game_id, category, lang, text_key, text_norm, data, source, theme) values ('dare', 'dares', 'family', 'en', 'x', 'x-theme-test', '{}', 'qa', repeat('y', 61))`);
check("THEME-6", "the table refuses a theme over 60 characters", !rawLong.ok && /content_library_theme_check/.test(rawLong.error), rawLong.error ?? "inserted");
const themeGrants = await svc(`select grantee, privilege_type from information_schema.column_privileges where table_name = 'content_library' and column_name = 'theme' and grantee in ('anon', 'authenticated')`);
check("THEME-7", "anon and authenticated have no access to the theme column", themeGrants.ok && themeGrants.rows.length === 0, JSON.stringify(themeGrants.rows));
const addFn = await svc(`select p.prosecdef, p.proconfig, has_function_privilege('anon', p.oid, 'execute') anon_exec, has_function_privilege('authenticated', p.oid, 'execute') auth_exec from pg_proc p where p.proname = 'library_add'`);
check("THEME-8", "library_add is still one security-definer function anon and authenticated can't call", addFn.rows.length === 1 && addFn.rows[0].prosecdef && !addFn.rows[0].anon_exec && !addFn.rows[0].auth_exec, JSON.stringify(addFn.rows));

// --- Account deletion ---------------------------------------------------------------------------------
await db.exec(`delete from auth.users where id = '${hostB}'`);
const bLeft = (await svc(`select count(*)::int n from content_seen where user_id = '${hostB}' or viewer = 'u:${hostB}'`)).rows[0].n;
const kept = (await svc(`select count(*)::int n, count(created_for)::int owned from content_library where text_key = 'Brand new dare'`)).rows[0];
check("DEL-1", "deleting an account removes its seen log", bLeft === 0, `got ${bLeft}`);
check("DEL-2", "deleting an account keeps the items but clears who they were made for", kept.n === 1 && kept.owned === 0, JSON.stringify(kept));
const mismatch = await svc(`insert into content_seen (viewer, user_id, item_id) values ('u:${hostA}', null, (select min(id) from content_library))`);
check("DEL-3", "a seen row can't claim an account viewer without the account id", !mismatch.ok && /check constraint/i.test(mismatch.error), mismatch.error ?? "inserted");

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
