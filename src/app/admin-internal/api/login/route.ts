import { NextResponse } from "next/server";
import { adminConfig } from "@/lib/admin/config";
import { safeEqual, verifyPassword, verifyTotp } from "@/lib/admin/crypto";
import { adminHeaders, clientIp, isSecure, newSessionToken, sameOrigin, sessionCookie } from "@/lib/admin/session";
import { beginAttempt } from "@/lib/admin/throttle";
import { logLater } from "@/lib/admin/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...adminHeaders, ...extra } });

export async function POST(req: Request) {
  const cfg = adminConfig();
  if (!cfg) return new NextResponse(null, { status: 404 });

  // Cross-site and non-JSON posts are refused before anything is checked.
  if (!sameOrigin(req) || !(req.headers.get("content-type") ?? "").includes("application/json")) {
    return json({ error: "forbidden" }, 403);
  }

  const ip = clientIp(req);
  // Checks the lock and reserves this attempt in one step (see throttle.ts).
  const attempt = await beginAttempt(ip);
  if (attempt.locked) {
    logLater("admin_login", { ok: false, reason: "locked" });
    return json({ error: "locked", message: "Too many attempts. Try again in 15 minutes." }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    await attempt.finish(false, "bad_request");
    return json({ error: "bad_request" }, 400);
  }
  const username = String(body.username ?? "").slice(0, 100);
  const password = String(body.password ?? "").slice(0, 200);
  const totp = String(body.totp ?? "").replace(/\s/g, "").slice(0, 10);

  // All three checks always run, so a wrong username costs the same time as a wrong password.
  const userOk = safeEqual(username, cfg.username);
  const passOk = await verifyPassword(password, cfg.passwordHash);
  const totpOk = verifyTotp(totp, cfg.totpSecret);

  if (!(userOk && passOk && totpOk)) {
    const reason = !(userOk && passOk) ? "bad_credentials" : "bad_totp";
    await attempt.finish(false, reason);
    logLater("admin_login", { ok: false, reason });
    // Same message whichever part was wrong: nothing to learn from the reply.
    return json({ error: "invalid", message: "Login failed." }, 401);
  }

  await attempt.finish(true, "ok");
  // Outcome only: no IP, username or password. admin_login_log keeps the per-IP detail for 90 days.
  logLater("admin_login", { ok: true, reason: "ok" });
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(newSessionToken(cfg), cfg, isSecure(req)) });
}
