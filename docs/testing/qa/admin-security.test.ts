// QA rounds 4-8: admin panel security building blocks (ADM-3, ADM-4, ADM-6..10, ADM-15).
// Run from the repo root:  npx -y tsx docs/testing/qa/admin-security.test.ts
import assert from "node:assert/strict";
import { adminConfig, isCompleteScryptHash } from "../../../src/lib/admin/config";
import { hashPassword, signToken, totpAt, verifyPassword, verifyToken, verifyTotp, randomSecretBase32, base32Decode } from "../../../src/lib/admin/crypto";
import { adminSession, clientIp, clearedCookie, COOKIE, newSessionToken, sameOrigin, sessionCookie } from "../../../src/lib/admin/session";
import { beginAttempt, isLocked, recordAttempt, MAX_FAILS } from "../../../src/lib/admin/throttle";
import { revokeSession } from "../../../src/lib/admin/revoked";

let passed = 0;
const lines: string[] = [];
async function check(id: string, name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    lines.push(`PASS ${id} ${name}`);
  } catch (e) {
    lines.push(`FAIL ${id} ${name}\n     ${(e as Error).message.split("\n")[0]}`);
  }
}

const SECRET = "x".repeat(40);
const req = (headers: Record<string, string> = {}, url = "https://example.test/x") => new Request(url, { headers });

(async () => {
  // A real hash for the config fixtures (the old fake value was too short to be a real hash).
  const VALID_HASH = await hashPassword("correct horse battery");
  await check("ADM-15a", "TOTP matches the RFC 6238 SHA-1 test vector (T=59 → 287082)", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // base32 of "12345678901234567890"
    assert.equal(totpAt(secret, 59_000), "287082");
    assert.equal(totpAt(secret, 1_111_111_109_000), "081804");
  });

  await check("ADM-15b", "TOTP accepts the current step and one either side, refuses two steps away", () => {
    const secret = randomSecretBase32();
    const now = 1_700_000_000_000;
    assert.ok(verifyTotp(totpAt(secret, now), secret, now));
    assert.ok(verifyTotp(totpAt(secret, now - 30_000), secret, now));
    assert.ok(verifyTotp(totpAt(secret, now + 30_000), secret, now));
    assert.ok(!verifyTotp(totpAt(secret, now - 60_000), secret, now));
    assert.ok(!verifyTotp("12345", secret, now), "codes must be six digits");
    assert.ok(!verifyTotp("abcdef", secret, now));
  });

  await check("ADM-15c", "base32 decoding ignores spaces and case", () => {
    assert.deepEqual(base32Decode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq"), Buffer.from("12345678901234567890"));
  });

  await check("ADM-6a", "password hash verifies the right password and only that", async () => {
    const stored = await hashPassword("correct horse battery");
    assert.ok(stored.startsWith("scrypt$16384$8$1$"));
    assert.equal(await verifyPassword("correct horse battery", stored), true);
    assert.equal(await verifyPassword("correct horse batterY", stored), false);
    assert.equal(await verifyPassword("anything", undefined), false);
    assert.equal(await verifyPassword("anything", "not-a-hash"), false);
  });

  await check("ADM-8a", "session token: valid signature and expiry accepted", () => {
    const now = Date.now();
    const token = newSessionToken({ path: "p", username: "u", passwordHash: "", totpSecret: "", sessionSecret: SECRET }, now);
    const payload = verifyToken(token, SECRET, now);
    assert.equal(payload?.sub, "admin");
  });

  await check("ADM-9a", "tampered payload, wrong secret, expired and malformed tokens are refused", () => {
    const now = 1_700_000_000_000;
    const good = signToken({ sub: "admin", exp: Math.floor(now / 1000) + 60 }, SECRET);
    assert.ok(verifyToken(good, SECRET, now));
    const [body, sig] = good.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "admin", exp: 9_999_999_999 })).toString("base64url");
    assert.equal(verifyToken(`${forged}.${sig}`, SECRET, now), null, "payload swap must fail");
    assert.equal(verifyToken(`${body}.AAAA`, SECRET, now), null, "bad signature must fail");
    assert.equal(verifyToken(good, "y".repeat(40), now), null, "another server's secret must fail");
    assert.equal(verifyToken(good, SECRET, now + 120_000), null, "expired must fail");
    assert.equal(verifyToken(undefined, SECRET, now), null);
    assert.equal(verifyToken("a.b.c", SECRET, now), null);
    assert.equal(verifyToken("x".repeat(3000), SECRET, now), null, "oversized cookies are refused early");
  });

  await check("ADM-8b", "session cookie: HttpOnly, SameSite=Strict, path = secret path, 2 h, Secure on https", () => {
    const cfg = { path: "abc", username: "u", passwordHash: "", totpSecret: "", sessionSecret: SECRET };
    const c = sessionCookie("TOKEN", cfg, true);
    assert.ok(c.startsWith("bp_admin=TOKEN;"));
    for (const flag of ["HttpOnly", "SameSite=Strict", "Path=/abc", "Max-Age=7200", "Secure"]) assert.ok(c.includes(flag), `missing ${flag}`);
    assert.ok(!sessionCookie("T", cfg, false).includes("Secure"), "plain http in dev: no Secure flag");
    const cleared = clearedCookie(cfg, true);
    assert.ok(cleared.includes("Max-Age=0") && cleared.startsWith("bp_admin=;"));
  });

  await check("ADM-10", "cross-site POSTs are refused: origin must match host", () => {
    assert.equal(sameOrigin(req({ origin: "https://example.test", host: "example.test" })), true);
    assert.equal(sameOrigin(req({ origin: "https://evil.example", host: "example.test" })), false);
    assert.equal(sameOrigin(req({ host: "example.test" })), false, "no Origin header: refused");
    assert.equal(sameOrigin(req({ origin: "not a url", host: "example.test" })), false);
  });

  await check("ADM-6b", "a truncated password hash never matches and is refused by the config check", async () => {
    const truncated = VALID_HASH.slice(0, VALID_HASH.lastIndexOf("$") + 1);
    assert.equal(await verifyPassword("anything", truncated), false, "truncated hash must not verify");
    assert.equal(await verifyPassword("", truncated), false, "empty password must not verify against a truncated hash");
    assert.equal(isCompleteScryptHash(truncated), false);
    assert.equal(isCompleteScryptHash("scrypt$16384$8$1$aaaa$bbbb"), false);
    assert.equal(isCompleteScryptHash(VALID_HASH), true);
  });

  await check("ADM-3", "admin is off without ADMIN_PATH", () => {
    const saved = { ...process.env };
    delete process.env.ADMIN_PATH;
    assert.equal(adminConfig(), null);
    Object.assign(process.env, saved);
  });

  await check("ADM-4", "admin is off when the secret path is shorter than 24 characters", () => {
    const saved = { ...process.env };
    process.env.ADMIN_PATH = "short";
    process.env.ADMIN_USERNAME = "owner";
    process.env.ADMIN_PASSWORD_HASH = VALID_HASH;
    process.env.ADMIN_TOTP_SECRET = randomSecretBase32();
    process.env.ADMIN_SESSION_SECRET = SECRET;
    assert.equal(adminConfig(), null);
    process.env.ADMIN_PATH = randomSecretBase32(24).toLowerCase();
    assert.ok(adminConfig(), "a 24+ character path with all settings enables the panel");
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  });

  await check("ADM-7", "five failures lock the IP; other IPs are unaffected", async () => {
    const ip = `10.0.0.${Math.floor(Math.random() * 200) + 1}`;
    for (let i = 0; i < MAX_FAILS; i++) await recordAttempt(ip, false, "bad_credentials");
    assert.equal(await isLocked(ip), true);
    assert.equal(await isLocked("10.9.9.9"), false);
  });

  await check("ADM-7b", "the lock lifts after 15 minutes", async () => {
    const ip = `10.1.0.${Math.floor(Math.random() * 200) + 1}`;
    const t0 = Date.now();
    for (let i = 0; i < MAX_FAILS; i++) await recordAttempt(ip, false, "bad_totp", t0);
    assert.equal(await isLocked(ip, t0 + 60_000), true);
    assert.equal(await isLocked(ip, t0 + 16 * 60_000), false);
  });

  await check("ADM-7d", "if the database query fails, the lockout still works from memory", async () => {
    const saved = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
    // A configured but unreachable database: supabase-js returns an error instead of throwing.
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:9";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-not-a-real-key";
    try {
      const ip = `10.2.0.${Math.floor(Math.random() * 200) + 1}`;
      for (let i = 0; i < MAX_FAILS; i++) await recordAttempt(ip, false, "bad_credentials");
      assert.equal(await isLocked(ip), true);
      assert.equal(await isLocked("10.9.9.8"), false);
    } finally {
      if (saved.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
      if (saved.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
    }
  });

  await check("ADM-7c", "the throttle reads the proxy-appended IP, not a spoofed first entry", () => {
    assert.equal(clientIp(req({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" })), "203.0.113.7");
    assert.equal(clientIp(req({ "x-forwarded-for": "203.0.113.7" })), "203.0.113.7");
    assert.equal(clientIp(req({})), "unknown");
  });

  await check("ADM-2a", "a new session token can be made and verified with the same secret", () => {
    const cfg = { path: "p", username: "u", passwordHash: "", totpSecret: "", sessionSecret: SECRET };
    const t = newSessionToken(cfg);
    assert.equal(verifyToken(t, SECRET)?.user, "u");
  });

  // --- Round 8: logout revocation and the atomic lockout (no database: the in-memory paths) ---
  const cfg8 = { path: "p".repeat(24), username: "owner", passwordHash: "", totpSecret: "", sessionSecret: SECRET };
  const withCookie = (t: string) => req({ cookie: `${COOKIE}=${t}` });

  await check("ADM-14b", "a logged-out session token is refused even though its signature and expiry are fine", async () => {
    const t = newSessionToken(cfg8);
    const s = await adminSession(withCookie(t), cfg8);
    assert.ok(s, "fresh token accepted");
    const other = newSessionToken(cfg8);
    await revokeSession(s!.sid, s!.exp);
    assert.equal(await adminSession(withCookie(t), cfg8), null, "revoked token refused");
    assert.ok(await adminSession(withCookie(other), cfg8), "a different session is unaffected");
  });

  await check("ADM-14c", "every session token gets its own random id", () => {
    const a = verifyToken(newSessionToken(cfg8), SECRET)?.sid, b = verifyToken(newSessionToken(cfg8), SECRET)?.sid;
    assert.equal(typeof a, "string");
    assert.ok((a as string).length >= 16 && a !== b);
  });

  await check("ADM-14d", "an old-style token without a session id is refused (it could not be logged out)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const legacy = signToken({ sub: "admin", user: "owner", iat: now, exp: now + 3600 }, SECRET);
    assert.ok(verifyToken(legacy, SECRET), "signature is valid");
    assert.equal(await adminSession(withCookie(legacy), cfg8), null);
  });

  await check("ADM-7e", "parallel attempts from one IP: exactly 5 get through, the rest are locked (no race)", async () => {
    const ip = `10.3.0.${Math.floor(Math.random() * 200) + 1}`;
    const attempts = await Promise.all(Array.from({ length: 12 }, () => beginAttempt(ip)));
    assert.equal(attempts.filter((a) => !a.locked).length, MAX_FAILS);
    await Promise.all(attempts.filter((a) => !a.locked).map((a) => a.finish(false, "bad_credentials")));
    assert.equal((await beginAttempt(ip)).locked, true);
  });

  await check("ADM-7f", "a successful attempt frees its reserved slot", async () => {
    const ip = `10.4.0.${Math.floor(Math.random() * 200) + 1}`;
    for (let i = 0; i < MAX_FAILS - 1; i++) await (await beginAttempt(ip)).finish(false, "bad_totp");
    const ok = await beginAttempt(ip);
    assert.equal(ok.locked, false);
    await ok.finish(true, "ok");
    const next = await beginAttempt(ip);
    assert.equal(next.locked, false, "the success did not count as a failure");
    await next.finish(false, "bad_totp");
    assert.equal((await beginAttempt(ip)).locked, true, "now 5 failures: locked");
  });

  await check("ADM-7g", "an attempt that never finishes still counts as a failure", async () => {
    const ip = `10.5.0.${Math.floor(Math.random() * 200) + 1}`;
    for (let i = 0; i < MAX_FAILS; i++) await beginAttempt(ip); // no finish(): request died mid-way
    assert.equal((await beginAttempt(ip)).locked, true);
  });

  lines.push(`\n${passed} passed, ${lines.length - passed} failed`);
  console.log(lines.join("\n"));
  if (passed !== lines.length - 1) process.exit(1);
})();
