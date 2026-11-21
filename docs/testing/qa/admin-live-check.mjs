// QA round 5: read-only check of the LIVE admin panel. Run it on your own computer:
//
//   BASE=https://playbawaal.vercel.app \
//   ADMIN_PATH=... ADMIN_USERNAME=... ADMIN_PASSWORD=... ADMIN_TOTP_SECRET=... \
//   node docs/testing/qa/admin-live-check.mjs
//
// It signs in ONCE (correctly, so no failed attempts are recorded), reads each view, and prints
// PASS/FAIL with counts only. It never prints the password, the code, the cookie, or any email.
// It doesn't change data. Paste the output back to the developer if something FAILs.

const BASE = (process.env.BASE || "").replace(/\/+$/, "");
const PATH = (process.env.ADMIN_PATH || "").replace(/^\/+|\/+$/g, "");
const USER = process.env.ADMIN_USERNAME || "";
const PASS = process.env.ADMIN_PASSWORD || "";
const TOTP = process.env.ADMIN_TOTP_SECRET || "";
const out = [];
const pass = (id, name, ok, note = "") => out.push(`${ok ? "PASS" : "FAIL"} ${id} ${name}${note ? ` (${note})` : ""}`);

if (!BASE || !PATH || !USER || !PASS || !TOTP) {
  console.log("Set BASE, ADMIN_PATH, ADMIN_USERNAME, ADMIN_PASSWORD and ADMIN_TOTP_SECRET first.");
  process.exit(2);
}

// RFC 6238 code for the current 30-second step (same algorithm as the app's own check).
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
async function totpNow(secret) {
  const { createHmac } = await import("node:crypto");
  let bits = 0, val = 0; const bytes = [];
  for (const ch of secret.toUpperCase().replace(/[\s=-]/g, "")) {
    val = (val << 5) | ALPHA.indexOf(ch); bits += 5;
    if (bits >= 8) { bytes.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String(((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6)).padStart(6, "0");
}

const host = new URL(BASE).host;
const panel = `${BASE}/${PATH}`;

// 1. Hidden paths look like ordinary missing pages.
for (const p of ["/admin-internal", "/admin"]) {
  const r = await fetch(`${BASE}${p}`, { redirect: "manual" });
  pass(`LIVE-1 ${p}`, "is a normal 404", r.status === 404, `status ${r.status}`);
}

// 2. The panel shell is served at the secret path and has no data in it.
const shell = await fetch(panel, { redirect: "manual" });
const shellText = await shell.text();
pass("LIVE-2", "panel shell is served at the secret path", shell.status === 200, `status ${shell.status}`);
pass("LIVE-2b", "shell contains no e-mail addresses", !/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(shellText));

// 3. Data needs a session.
const anon = await fetch(`${panel}/api/data?view=me`);
pass("LIVE-3", "data without a session is refused", anon.status === 401, `status ${anon.status}`);

// 4. Sign in once, correctly.
const login = await fetch(`${panel}/api/login`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: BASE, host },
  body: JSON.stringify({ username: USER, password: PASS, totp: await totpNow(TOTP) }),
});
const setCookie = login.headers.get("set-cookie") || "";
pass("LIVE-4", "sign-in works", login.status === 200, `status ${login.status}`);
const cookie = setCookie.split(";")[0];
// "Secure" is only sent over HTTPS, which the live site always is.
const needSecure = BASE.startsWith("https:");
pass("LIVE-4b", "session cookie is HttpOnly, SameSite=Strict, scoped to the secret path (and Secure on HTTPS)",
  /HttpOnly/.test(setCookie) && /SameSite=Strict/.test(setCookie) && setCookie.includes(`Path=/${PATH}`) && (!needSecure || /Secure/.test(setCookie)));

async function view(name, extra = "") {
  const r = await fetch(`${panel}/api/data?view=${name}${extra}`, { headers: { cookie } });
  let body = null;
  try { body = await r.json(); } catch { /* not JSON */ }
  return { status: r.status, body, headers: r.headers };
}

// 5. Each view.
const me = await view("me");
pass("VIEW me", "session accepted", me.status === 200 && me.body?.user, `status ${me.status}`);

const ov = await view("overview");
pass("VIEW overview", "loads with counts", ov.status === 200 && typeof ov.body?.users_total === "number", `status ${ov.status}${ov.body?.error ? `, ${ov.body.error}` : ""}`);
if (ov.body && typeof ov.body.users_total === "number") {
  out.push(`     users ${ov.body.users_total} · signups 7d ${ov.body.users_7d} · rooms ${ov.body.rooms_total} · hosts ${ov.body.hosts_total}`);
  out.push(`     sign-in methods: ${Object.entries(ov.body.providers || {}).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}`);
}

const users = await view("users", "&page=0");
pass("VIEW users", "loads a page of accounts", users.status === 200 && Array.isArray(users.body), `status ${users.status}${users.body?.error ? `, ${users.body.error}` : ""}`);
if (Array.isArray(users.body)) out.push(`     first page: ${users.body.length} accounts (emails not printed)`);

const gm = await view("games");
pass("VIEW games", "loads game counts", gm.status === 200 && gm.body && typeof gm.body.totalSample === "number", `status ${gm.status}${gm.body?.error ? `, ${gm.body.error}` : ""}`);
if (gm.body && typeof gm.body.totalSample === "number") {
  out.push(`     games started (30 days): ${gm.body.totalSample}; per game: ${Object.entries(gm.body.byGame || {}).map(([g, v]) => `${g} ${v.d30}`).join(", ") || "none yet"}`);
}

const llm = await view("llm");
pass("VIEW llm", "loads provider stats", llm.status === 200 && llm.body && typeof llm.body.total === "number", `status ${llm.status}${llm.body?.error ? `, ${llm.body.error}` : ""}`);
if (llm.body && typeof llm.body.total === "number") {
  out.push(`     suggestions (7 days): ${llm.body.total}, built-in fallback ${llm.body.fallbackRate}%`);
  out.push(`     per provider: ${Object.entries(llm.body.providers || {}).map(([k, v]) => `${k} ${v.count} (fallback ${v.fallback}, ${v.avgMs} ms)`).join("; ") || "none yet"}`);
  out.push(`     on the instance that answered: ${(llm.body.live || []).map((p) => `${p.name} ${p.configured ? "configured" : "no key"}`).join(", ")}`);
}

const logins = await view("logins");
pass("VIEW logins", "loads the login log", logins.status === 200 && Array.isArray(logins.body), `status ${logins.status}${logins.body?.error ? `, ${logins.body.error}` : ""}`);
if (Array.isArray(logins.body)) out.push(`     last ${logins.body.length} sign-in attempts (IP addresses not printed)`);

// 6. Headers on data responses.
const h = mergedHeaders(ov.headers);
pass("HDR-1", "data responses are no-store and noindex", /no-store/.test(h["cache-control"] || "") && /noindex/.test(h["x-robots-tag"] || ""));

function mergedHeaders(headers) {
  const o = {};
  headers.forEach((v, k) => { o[k] = v; });
  return o;
}

// 7. Sign out.
const out2 = await fetch(`${panel}/api/logout`, { method: "POST", headers: { origin: BASE, host } });
pass("LIVE-7", "sign-out clears the session", out2.status === 200 && /Max-Age=0/.test(out2.headers.get("set-cookie") || ""));

console.log(out.join("\n"));
const failed = out.filter((l) => l.startsWith("FAIL")).length;
console.log(`\n${out.filter((l) => l.startsWith("PASS")).length} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
