import { SESSION_SECONDS, type AdminConfig } from "./config";
import { randomBytes } from "node:crypto";
import { signToken, verifyToken } from "./crypto";
import { isRevoked } from "./revoked";
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
    { sub: "admin", user: cfg.username, sid: randomBytes(16).toString("base64url"), iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + SESSION_SECONDS },
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

export interface AdminSession {
  user: string;
  sid: string;
  exp: number;
}

/**
 * The admin session for this request, or null. Valid only when the token is signed with this
 * server's secret, unexpired, carries a session id, and that id hasn't been logged out.
 * Tokens from before session ids existed are refused, so they can't dodge logout.
 */
export async function adminSession(req: Request, cfg: AdminConfig): Promise<AdminSession | null> {
  const p = verifyToken(readCookie(req, COOKIE), cfg.sessionSecret);
  if (!p || p.sub !== "admin" || typeof p.user !== "string" || typeof p.sid !== "string" || typeof p.exp !== "number") return null;
  if (await isRevoked(p.sid)) return null;
  return { user: p.user, sid: p.sid, exp: p.exp };
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
