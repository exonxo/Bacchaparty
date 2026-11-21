import { SESSION_SECONDS, type AdminConfig } from "./config";
import { signToken, verifyToken } from "./crypto";
export { adminHeaders } from "./headers";

/** Session cookie. Scoped to the secret path, so the browser only sends it to the panel. */
export const COOKIE = "bp_admin";

export function sessionCookie(token: string, cfg: AdminConfig, secure: boolean): string {
  return `${COOKIE}=${token}; Path=/${cfg.path}; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure ? "; Secure" : ""}`;
}

export function clearedCookie(cfg: AdminConfig, secure: boolean): string {
  return `${COOKIE}=; Path=/${cfg.path}; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function newSessionToken(cfg: AdminConfig, now = Date.now()): string {
  return signToken(
    { sub: "admin", user: cfg.username, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + SESSION_SECONDS },
    cfg.sessionSecret,
  );
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

/** True only for a valid, unexpired admin session signed with this server's secret. */
export function hasAdminSession(req: Request, cfg: AdminConfig): boolean {
  const payload = verifyToken(readCookie(req, COOKIE), cfg.sessionSecret);
  return payload?.sub === "admin";
}

/**
 * Admin POSTs must come from this site. Browsers always send Origin on cross-site POSTs, so a
 * page on another site can't make the owner's browser log in or log out.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function isSecure(req: Request): boolean {
  return new URL(req.url).protocol === "https:" || process.env.NODE_ENV === "production";
}

/**
 * The client's IP for throttling. Clients can put anything in the first x-forwarded-for entries,
 * but the platform proxy appends the real address last, so the last entry is the trusted one.
 */
export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const parts = xf.split(",").map((x) => x.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** The signed-in admin's name from the session token, or null. Used as the actor in the audit log. */
export function adminActor(req: Request, cfg: AdminConfig): string | null {
  const payload = verifyToken(readCookie(req, COOKIE), cfg.sessionSecret);
  return payload?.sub === "admin" && typeof payload.user === "string" ? payload.user : null;
}
