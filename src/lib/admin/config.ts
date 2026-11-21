/**
 * Admin panel settings, read from the server environment. The panel is OFF unless every setting is
 * valid. Nothing here is ever sent to the browser.
 *
 *   ADMIN_PATH            secret URL segment (24-128 chars). Without it the panel doesn't exist.
 *   ADMIN_USERNAME        login name
 *   ADMIN_PASSWORD_HASH   scrypt hash, from `node scripts/admin-setup.mjs password "<pw>"`
 *   ADMIN_TOTP_SECRET     base32 authenticator secret, from `node scripts/admin-setup.mjs totp`
 *   ADMIN_SESSION_SECRET  random, 32+ chars, from `node scripts/admin-setup.mjs path` (any random string works)
 */

export interface AdminConfig {
  path: string;
  username: string;
  passwordHash: string;
  totpSecret: string;
  sessionSecret: string;
}

export const SESSION_SECONDS = 2 * 60 * 60;

let warned = false;

/** "scrypt$N$r$p$salt$hash" with a salt of at least 8 bytes and a 64-byte hash. A truncated value is refused. */
export function isCompleteScryptHash(v: string): boolean {
  const parts = v.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  return Buffer.from(parts[4] ?? "", "base64").length >= 8 && Buffer.from(parts[5] ?? "", "base64").length === 64;
}

export function adminConfig(): AdminConfig | null {
  const path = (process.env.ADMIN_PATH ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!path) return null; // not configured: the panel does not exist

  const username = (process.env.ADMIN_USERNAME ?? "").trim();
  const passwordHash = (process.env.ADMIN_PASSWORD_HASH ?? "").trim();
  const totpSecret = (process.env.ADMIN_TOTP_SECRET ?? "").trim();
  const sessionSecret = (process.env.ADMIN_SESSION_SECRET ?? "").trim();

  const problems: string[] = [];
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(path)) problems.push("ADMIN_PATH must be 24-128 letters, digits, - or _");
  if (username.length < 3) problems.push("ADMIN_USERNAME is missing or too short");
  if (!isCompleteScryptHash(passwordHash)) problems.push("ADMIN_PASSWORD_HASH is missing or incomplete (run scripts/admin-setup.mjs password)");
  if (!/^[A-Z2-7]{16,}$/i.test(totpSecret)) problems.push("ADMIN_TOTP_SECRET is missing (run scripts/admin-setup.mjs)");
  if (sessionSecret.length < 32) problems.push("ADMIN_SESSION_SECRET must be 32+ characters");

  if (problems.length) {
    if (!warned) {
      warned = true;
      console.warn(`[admin] panel disabled: ${problems.join("; ")}`);
    }
    return null;
  }
  return { path, username, passwordHash, totpSecret, sessionSecret };
}

/** The panel's secret path, or null when it's disabled. Used by middleware to rewrite requests. */
export function adminPathOrNull(): string | null {
  return adminConfig()?.path ?? null;
}
