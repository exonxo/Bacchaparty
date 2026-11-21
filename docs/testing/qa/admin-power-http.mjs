// QA round 6: the power-admin HTTP gates (local server only).
// Checks what can be proven without a database: session and origin gates run first, unknown
// actions are refused, destructive actions need a valid authenticator code, and every write or
// sensitive read FAILS CLOSED when the audit log can't be written.
//   BASE=http://localhost:3100 ADMIN_PATH=... ADMIN_USERNAME=... ADMIN_PASSWORD=... ADMIN_TOTP_SECRET=... \
//     node docs/testing/qa/admin-power-http.mjs
import pw from "playwright";
import crypto from "node:crypto";

const { request } = pw;
const BASE = process.env.BASE || "http://localhost:3100";
const PATH = process.env.ADMIN_PATH;
const USER = process.env.ADMIN_USERNAME;
const PASS = process.env.ADMIN_PASSWORD;
const TOTP = process.env.ADMIN_TOTP_SECRET;

const LOCAL_BASE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(BASE);
if (!LOCAL_BASE) {
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
  const host = new URL(BASE).host;
  const anon = await request.newContext({ baseURL: BASE });

  // Flags endpoint is public and must not need a session.
  const flags = await anon.get("/api/flags");
  const fj = await flags.json();
  check("FLG-P1", "GET /api/flags is public and returns the game switches", flags.status() === 200 && typeof fj.games === "object", `status ${flags.status()}`);
  check("FLG-P2", "with no database every game defaults to on", fj.games && Object.values(fj.games).every((v) => v === true));

  // Session gates for actions and sensitive views.
  const noSession = await anon.post(`/${PATH}/api/action`, {
    data: { action: "flag.set", key: "suggest", enabled: false },
    headers: { origin: BASE, host, "content-type": "application/json" },
  });
  check("GATE-1", "action without a session is 401", noSession.status() === 401, `status ${noSession.status()}`);
  const roomNoSession = await anon.get(`/${PATH}/api/data?view=room&code=ABCD`);
  check("GATE-2", "sensitive view without a session is 401", roomNoSession.status() === 401, `status ${roomNoSession.status()}`);

  // Sign in once, correctly (no failed attempts).
  const login = await api.post(`/${PATH}/api/login`, {
    data: { username: USER, password: PASS, totp: totpNow(TOTP) },
    headers: { origin: BASE, host, "content-type": "application/json" },
  });
  check("LOGIN", "sign-in works", login.status() === 200, `status ${login.status()}`);

  const call = (body, headers = {}) =>
    api.post(`/${PATH}/api/action`, { data: body, headers: { origin: BASE, host, "content-type": "application/json", ...headers } });

  const cross = await call({ action: "flag.set", key: "suggest", enabled: false }, { origin: "https://evil.example" });
  check("GATE-3", "action from another site is 403", cross.status() === 403, `status ${cross.status()}`);
  const plain = await call({ action: "flag.set", key: "suggest", enabled: false }, { "content-type": "text/plain" });
  check("GATE-4", "action without JSON content type is 403", plain.status() === 403, `status ${plain.status()}`);
  const unknown = await call({ action: "drop.everything" });
  check("GATE-5", "unknown action is 400 before anything runs", unknown.status() === 400, `status ${unknown.status()}`);

  // Step-up: destructive actions need a valid code.
  const noCode = await call({ action: "user.disable", id: "00000000-0000-0000-0000-000000000000" });
  const noCodeBody = await noCode.json();
  check("STEP-1", "disable without an authenticator code is refused", noCode.status() === 400 && noCodeBody.error === "totp_invalid", JSON.stringify(noCodeBody));
  const badCode = await call({ action: "user.delete", id: "00000000-0000-0000-0000-000000000000", totp: "000000", confirmEmail: "a@b.c", exportAcknowledged: true });
  const badCodeBody = await badCode.json();
  check("STEP-2", "delete with a wrong authenticator code is refused", badCode.status() === 400 && badCodeBody.error === "totp_invalid", JSON.stringify(badCodeBody));

  // Fail closed: with no database the audit log can't be written, so writes are refused and nothing changes.
  const flagWrite = await call({ action: "flag.set", key: "suggest", enabled: false });
  const flagBody = await flagWrite.json();
  check("FAIL-1", "a flag change is refused when the audit log can't be written", flagWrite.status() === 503 && flagBody.error === "audit_unavailable", JSON.stringify(flagBody));
  const review = await call({ action: "content.review", id: 1, decision: "approve", edits: { answer: "Test" } });
  const reviewBody = await review.json();
  check("FAIL-2", "content review is refused when the audit log can't be written", review.status() === 503, JSON.stringify(reviewBody));
  const badFlag = await call({ action: "flag.set", key: "not-a-flag", enabled: false });
  check("VAL-1", "unknown flag keys are refused before the audit step", badFlag.status() === 400 && (await badFlag.json()).error === "unknown_flag");

  // Sensitive views are audited first; without the database they fail closed.
  const room = await api.get(`/${PATH}/api/data?view=room&code=ABCD`);
  check("FAIL-3", "room lookup is refused when the audit log can't be written", room.status() === 503, `status ${room.status()}`);
  const find = await api.get(`/${PATH}/api/data?view=find&email=someone@example.test`);
  check("FAIL-4", "account lookup is refused when the audit log can't be written", find.status() === 503, `status ${find.status()}`);
  const audit = await api.get(`/${PATH}/api/data?view=audit`);
  check("VIEW-1", "audit view needs the database (500, nothing leaked)", audit.status() === 500 && !(await audit.text()).includes("admin_audit"));
  const badRoom = await api.get(`/${PATH}/api/data?view=room&code=ab`);
  check("VAL-2", "an invalid room code is refused before anything is audited", badRoom.status() === 400, `status ${badRoom.status()}`);

  // Headers on every admin response.
  const hdr = await api.get(`/${PATH}/api/data?view=me`);
  check("HDR-1", "admin responses are no-store, noindex and not framed", /no-store/.test(hdr.headers()["cache-control"] || "") && /noindex/.test(hdr.headers()["x-robots-tag"] || "") && hdr.headers()["x-frame-options"] === "DENY");

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
