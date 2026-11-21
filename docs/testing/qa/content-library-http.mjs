// Content library admin routes over HTTP (local server only).
// Checks what can be proven without a database: session and origin gates, input validation before
// anything is audited or asked of the AI services, and that the export and the write actions FAIL
// CLOSED when the audit log can't be written.
//   BASE=http://localhost:3100 ADMIN_PATH=... ADMIN_USERNAME=... ADMIN_PASSWORD=... ADMIN_TOTP_SECRET=... \
//     node docs/testing/qa/content-library-http.mjs
import pw from "playwright";
import crypto from "node:crypto";

const { request } = pw;
const BASE = process.env.BASE || "http://localhost:3100";
const PATH = process.env.ADMIN_PATH;
const USER = process.env.ADMIN_USERNAME;
const PASS = process.env.ADMIN_PASSWORD;
const TOTP = process.env.ADMIN_TOTP_SECRET;

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

(async () => {
  const api = await request.newContext({ baseURL: BASE });
  const anon = await request.newContext({ baseURL: BASE });
  const host = new URL(BASE).host;
  const json = { origin: BASE, host, "content-type": "application/json" };

  // Gates: no session.
  const v = await anon.get(`/${PATH}/api/data?view=library`);
  check("LGATE-1", "library counts without a session are 401", v.status() === 401, `status ${v.status()}`);
  const csv = await anon.get(`/${PATH}/api/data?view=library_csv`);
  check("LGATE-2", "CSV export without a session is 401 and has no CSV", csv.status() === 401 && !(csv.headers()["content-type"] || "").includes("csv"), `status ${csv.status()}`);
  const gen = await anon.post(`/${PATH}/api/action`, { data: { action: "library.generate", kind: "dare", count: 1 }, headers: json });
  check("LGATE-3", "Generate more without a session is 401", gen.status() === 401, `status ${gen.status()}`);
  const wrongPath = await anon.get(`/not-the-admin-path/api/data?view=library_csv`);
  check("LGATE-4", "the export is not reachable outside the admin path", wrongPath.status() === 404, `status ${wrongPath.status()}`);

  const login = await api.post(`/${PATH}/api/login`, { data: { username: USER, password: PASS, totp: totpNow(TOTP) }, headers: json });
  check("LOGIN", "sign-in works", login.status() === 200, `status ${login.status()}`);
  const call = (body, headers = {}) => api.post(`/${PATH}/api/action`, { data: body, headers: { ...json, ...headers } });

  // Origin and content type.
  const cross = await call({ action: "library.generate", kind: "dare", count: 1 }, { origin: "https://evil.example" });
  check("LGATE-5", "Generate more from another site is 403", cross.status() === 403, `status ${cross.status()}`);
  const plain = await call({ action: "library.generate", kind: "dare", count: 1 }, { "content-type": "text/plain" });
  check("LGATE-6", "Generate more without a JSON content type is 403", plain.status() === 403, `status ${plain.status()}`);

  // Validation happens before the audit step and before any AI call.
  const cases = [
    ["LVAL-1", "an unknown game is refused", { kind: "kbc", count: 1 }, "bad_kind"],
    ["LVAL-2", "next-game suggestions are not a library kind", { kind: "next-game", count: 1 }, "bad_kind"],
    ["LVAL-3", "a batch of 0 is refused", { kind: "dare", count: 0 }, "bad_count"],
    ["LVAL-4", "more than 50 emoji puzzles is refused", { kind: "emoji-puzzle", count: 51 }, "bad_count"],
    ["LVAL-5", "more than 5 topics is refused", { kind: "chor-kaun-topic", count: 6 }, "bad_count"],
    ["LVAL-6", "more than 5 dares is refused", { kind: "dare", count: 6 }, "bad_count"],
    ["LVAL-7", "a fractional batch size is refused", { kind: "dare", count: 2.5 }, "bad_count"],
    ["LVAL-8", "a text batch size is refused", { kind: "dare", count: "5" }, "bad_count"],
  ];
  for (const [id, name, body, error] of cases) {
    const r = await call({ action: "library.generate", ...body });
    const b = await r.json();
    check(id, name, r.status() === 400 && b.error === error, `${r.status()} ${JSON.stringify(b)}`);
  }
  const badId = await call({ action: "library.set_active", id: "abc", active: false });
  check("LVAL-9", "switching an item off needs a numeric id", badId.status() === 400 && (await badId.json()).error === "bad_id");
  const noActive = await call({ action: "library.set_active", id: 1 });
  check("LVAL-10", "switching an item needs true or false", noActive.status() === 400 && (await noActive.json()).error === "active_required");

  // Fail closed without the database: the audit can't be written, so nothing is generated or changed.
  const t0 = Date.now();
  const okGen = await call({ action: "library.generate", kind: "emoji-puzzle", count: 50, level: "kids" });
  const okGenBody = await okGen.json();
  check("LFAIL-1", "a valid Generate more (largest batch) is refused when the audit log can't be written", okGen.status() === 503 && okGenBody.error === "audit_unavailable", JSON.stringify(okGenBody));
  check("LFAIL-2", "it is refused before any AI call (answers in under 3 s)", Date.now() - t0 < 3000, `${Date.now() - t0} ms`);
  const setActive = await call({ action: "library.set_active", id: 1, active: false });
  check("LFAIL-3", "switching an item off is refused when the audit log can't be written", setActive.status() === 503 && (await setActive.json()).error === "audit_unavailable");
  const csvIn = await api.get(`/${PATH}/api/data?view=library_csv`);
  const csvBody = await csvIn.text();
  check("LFAIL-4", "the CSV export is audited first: refused (503) when the audit log can't be written", csvIn.status() === 503 && csvBody.includes("audit_unavailable") && !(csvIn.headers()["content-type"] || "").includes("csv"), `${csvIn.status()} ${csvBody.slice(0, 80)}`);
  const counts = await api.get(`/${PATH}/api/data?view=library`);
  const countsText = await counts.text();
  check("LVIEW-1", "library counts need the database (500 database_not_configured, no table names leaked)", counts.status() === 500 && countsText.includes("database_not_configured") && !countsText.includes("content_library"), `${counts.status()} ${countsText.slice(0, 80)}`);
  check("LHDR-1", "library responses are no-store, noindex and not framed", /no-store/.test(counts.headers()["cache-control"] || "") && /noindex/.test(counts.headers()["x-robots-tag"] || "") && counts.headers()["x-frame-options"] === "DENY");

  // The public suggestion route is unchanged for signed-out callers.
  const sug = await anon.post("/api/suggest", { data: { kind: "dare", context: {}, roomCode: "ABCD" }, headers: { "content-type": "application/json" } });
  check("LSUG-1", "the suggestion route still needs a signed-in host", sug.status() === 401, `status ${sug.status()}`);

  console.log(results.join("\n"));
  const failed = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  await api.dispose();
  await anon.dispose();
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.log("ERR", e.message.split("\n")[0]);
  process.exit(1);
});
