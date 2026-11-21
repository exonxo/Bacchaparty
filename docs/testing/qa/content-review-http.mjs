// Content review with uuid ids, end to end through the admin route (local server only).
// Starts a small stand-in for Supabase's REST API on 127.0.0.1 (FAKE_PORT, default 54400) and checks
// what the route sends to it: approve and reject work with a content_items uuid, and bad ids are
// refused with bad_id before anything is audited or read. Start the app pointing at the stand-in:
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54400 NEXT_PUBLIC_SUPABASE_ANON_KEY=<throwaway>
//   SUPABASE_SERVICE_ROLE_KEY=<throwaway> plus throwaway ADMIN_* settings, then:
//   BASE=http://localhost:3177 ADMIN_PATH=... ADMIN_USERNAME=... ADMIN_PASSWORD=... ADMIN_TOTP_SECRET=... \
//     node docs/testing/qa/content-review-http.mjs
// The stand-in imitates only the calls these routes make. It is not Supabase.
import pw from "playwright";
import crypto from "node:crypto";
import http from "node:http";

const { request } = pw;
const BASE = process.env.BASE || "http://localhost:3177";
const PATH = process.env.ADMIN_PATH;
const USER = process.env.ADMIN_USERNAME;
const PASS = process.env.ADMIN_PASSWORD;
const TOTP = process.env.ADMIN_TOTP_SECRET;
const FAKE_PORT = Number(process.env.FAKE_PORT || 54400);
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(BASE)) {
  console.log(`Refusing to run against ${BASE}. These checks sign in and send writes; run them against a local server.`);
  process.exit(2);
}

const results = [];
const check = (id, name, ok, detail = "") => results.push(`${ok ? "PASS" : "FAIL"} ${id} ${name}${!ok && detail ? `\n     ${detail}` : ""}`);
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function totpNow(secret) {
  let bits = 0, val = 0; const bytes = [];
  for (const ch of secret.toUpperCase()) {
    val = (val << 5) | ALPHA.indexOf(ch); bits += 5;
    if (bits >= 8) { bytes.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = crypto.createHmac("sha1", Buffer.from(bytes)).update(c).digest();
  const o = h[h.length - 1] & 0xf;
  return String(((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6)).padStart(6, "0");
}

// --- Stand-in for the REST API -------------------------------------------------------------------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const A = crypto.randomUUID();
const B = crypto.randomUUID();
const items = new Map([
  [A, { id: A, game_id: "emoji-picture", data: { answer: "Sholay", emojis: "🤠🔥", hint: "Gabbar", category: "Movie" }, item_key: "sholay", approved: false, rejected: false }],
  [B, { id: B, game_id: "emoji-picture", data: { answer: "Lagaan", emojis: "🏏🌧️", hint: "Tax", category: "Movie" }, item_key: "lagaan", approved: false, rejected: false }],
]);
const log = []; // { method, table, query, body }
const fake = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const u = new URL(req.url, "http://x");
    const m = u.pathname.match(/^\/rest\/v1\/(rpc\/)?([a-z_]+)$/);
    const body = raw ? JSON.parse(raw) : null;
    const send = (status, data) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(data === undefined ? "" : JSON.stringify(data));
    };
    if (!m) return send(404, { message: "not found" });
    const [, rpc, name] = m;
    log.push({ method: req.method, table: rpc ? `rpc:${name}` : name, query: u.search, body });
    if (rpc) return send(200, name === "admin_login_begin" ? 1 : null);
    const object = (req.headers.accept || "").includes("vnd.pgrst.object");
    if (name === "content_items") {
      const idFilter = u.searchParams.get("id");
      const id = idFilter?.startsWith("eq.") ? idFilter.slice(3) : null;
      if (id && !UUID.test(id)) return send(400, { code: "22P02", message: "invalid input syntax for type uuid" });
      const row = id ? items.get(id) : null;
      if (req.method === "GET") {
        if (object) return row ? send(200, row) : send(406, { code: "PGRST116", message: "0 rows" });
        return send(200, row ? [row] : []);
      }
      if (req.method === "PATCH") {
        if (row) Object.assign(row, body);
        return send(204);
      }
    }
    if (req.method === "GET") return object ? send(406, { code: "PGRST116", message: "0 rows" }) : send(200, []);
    if (req.method === "POST") return send(201);
    return send(204);
  });
});
await new Promise((r) => fake.listen(FAKE_PORT, "127.0.0.1", r));

(async () => {
  const api = await request.newContext({ baseURL: BASE });
  const host = new URL(BASE).host;
  const headers = { origin: BASE, host, "content-type": "application/json" };
  const login = await api.post(`/${PATH}/api/login`, { data: { username: USER, password: PASS, totp: totpNow(TOTP) }, headers });
  check("LOGIN", "sign-in works against the stand-in database", login.status() === 200, `status ${login.status()}`);
  const review = (body) => api.post(`/${PATH}/api/action`, { data: { action: "content.review", ...body }, headers });
  const since = () => log.length;
  const after = (n) => log.slice(n);

  // Approve with a uuid, with an edit.
  let n = since();
  const ap = await review({ id: A, decision: "approve", edits: { answer: "Sholay (1975)", hint: "Gabbar Singh" } });
  const apBody = await ap.json();
  const apCalls = after(n);
  const auditIdx = apCalls.findIndex((c) => c.table === "admin_audit" && c.method === "POST");
  const patchIdx = apCalls.findIndex((c) => c.table === "content_items" && c.method === "PATCH");
  const patch = apCalls[patchIdx];
  check("REV-1", "approve with a uuid succeeds (200)", ap.status() === 200 && apBody.ok === true && apBody.id === A && apBody.decision === "approve", `${ap.status()} ${JSON.stringify(apBody)}`);
  check("REV-2", "the update targets that uuid and marks it approved, not rejected", !!patch && patch.query.includes(`id=eq.${A}`) && patch.body.approved === true && patch.body.rejected === false, JSON.stringify(patch));
  check("REV-3", "the edits are saved and the bank key follows the new answer", patch?.body.data?.answer === "Sholay (1975)" && patch?.body.data?.hint === "Gabbar Singh" && patch?.body.item_key === "sholay (1975)", JSON.stringify(patch?.body));
  check("REV-4", "the audit entry (target content:<uuid>) is written before the update", auditIdx >= 0 && auditIdx < patchIdx && apCalls[auditIdx].body.target === `content:${A}` && apCalls[auditIdx].body.action === "content.review", JSON.stringify(apCalls.map((c) => c.table)));
  check("REV-5", "the stand-in now holds the item as approved", items.get(A).approved === true && items.get(A).rejected === false);

  // Reject with an upper-case uuid: accepted and normalised.
  n = since();
  const rj = await review({ id: B.toUpperCase(), decision: "reject" });
  const rjBody = await rj.json();
  const rjPatch = after(n).find((c) => c.table === "content_items" && c.method === "PATCH");
  check("REV-6", "reject with a uuid (upper case) succeeds (200)", rj.status() === 200 && rjBody.ok === true && rjBody.id === B && rjBody.decision === "reject", `${rj.status()} ${JSON.stringify(rjBody)}`);
  check("REV-7", "the update targets that uuid and marks it rejected, not approved", !!rjPatch && rjPatch.query.includes(`id=eq.${B}`) && rjPatch.body.rejected === true && rjPatch.body.approved === false, JSON.stringify(rjPatch));
  check("REV-8", "the stand-in now holds the item as rejected", items.get(B).rejected === true && items.get(B).approved === false);

  // A well-formed uuid that isn't in the bank.
  n = since();
  const missing = await review({ id: crypto.randomUUID(), decision: "approve", edits: { answer: "X" } });
  check("REV-9", "an unknown uuid is 404 not_found, and nothing is audited or updated", missing.status() === 404 && (await missing.json()).error === "not_found" && !after(n).some((c) => c.table === "admin_audit" || c.method === "PATCH"), `${missing.status()}`);

  // Bad ids: refused with bad_id before the database is asked at all.
  const bad = [["a whole number", 1], ["a numeric string", "1"], ["text", "abc"], ["a uuid without dashes", A.replace(/-/g, "")], ["a uuid with extra text", `${A}x`], ["null", null], ["an array", [A]], ["missing", undefined]];
  for (const [label, id] of bad) {
    n = since();
    const r = await review({ ...(id === undefined ? {} : { id }), decision: "approve", edits: { answer: "X" } });
    const b = await r.json();
    const touched = after(n).filter((c) => c.table === "content_items" || c.table === "admin_audit");
    check("BAD", `${label} as the id is 400 bad_id, with no database read or audit`, r.status() === 400 && b.error === "bad_id" && touched.length === 0, `${r.status()} ${JSON.stringify(b)} calls=${touched.length}`);
  }
  n = since();
  const badDecision = await review({ id: A, decision: "maybe" });
  check("BAD", "a uuid with an unknown decision is 400 bad_decision, with no database read", badDecision.status() === 400 && (await badDecision.json()).error === "bad_decision" && !after(n).some((c) => c.table === "content_items"));

  console.log(results.join("\n"));
  const failed = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  await api.dispose();
  fake.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.log("ERR", e.message.split("\n")[0]);
  fake.close();
  process.exit(1);
});
