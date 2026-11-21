import { getServiceClient } from "../supabase/service";

/**
 * Audit trail for the admin panel. Every admin action and every sensitive admin read is written
 * to `admin_audit`. Writes happen BEFORE the action, and a failed write stops the action.
 */

export interface AuditEntry {
  actor: string;
  action: string;
  target?: string | null;
  details?: Record<string, unknown>;
  ip?: string | null;
}

export class AuditUnavailable extends Error {
  constructor() {
    super("audit_unavailable");
  }
}

/** Records one entry. Throws AuditUnavailable if the database can't take it. */
export async function auditOrThrow(entry: AuditEntry): Promise<void> {
  const db = getServiceClient();
  if (!db) throw new AuditUnavailable();
  const { error } = await db.from("admin_audit").insert({
    actor: entry.actor.slice(0, 64),
    action: entry.action.slice(0, 64),
    target: entry.target ? entry.target.slice(0, 128) : null,
    details: entry.details ?? {},
    ip: entry.ip ?? null,
  });
  if (error) throw new AuditUnavailable();
}

/** The actions the panel can perform. Anything else is refused before it reaches a handler. */
export const ACTIONS = [
  "flag.set",
  "content.generate",
  "content.review",
  "library.generate",
  "library.set_active",
  "user.disable",
  "user.enable",
  "user.delete",
] as const;
export type AdminAction = (typeof ACTIONS)[number];

/** Actions that remove access or data. These need a fresh authenticator code (step-up). */
export const DESTRUCTIVE: ReadonlySet<AdminAction> = new Set<AdminAction>(["user.delete", "user.disable"]);
