import { validateGeminiPayload } from "../suggest/validate";
import { buildPrompt } from "../suggest/prompts";
import { runChain } from "../suggest/chain";
import { getServiceClient } from "../supabase/service";
import { AuditUnavailable, auditOrThrow, DESTRUCTIVE, type AdminAction } from "./audit";
import { verifyTotp } from "./crypto";
import { insertPending } from "./bank";
import { flagMap, invalidateFlags, knownFlags } from "./flags";

/**
 * The admin panel's write actions. Each handler: validates its input, checks the authenticator code
 * for destructive actions, writes the audit entry, and only then changes anything.
 */

export interface ActionContext {
  actor: string;
  ip: string;
  totpSecret: string;
}

export interface ActionResult {
  status: number;
  body: Record<string, unknown>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BAN_FOREVER = "876000h"; // about 100 years: effectively a disable, reversible with user.enable

const fail = (status: number, error: string): ActionResult => ({ status, body: { ok: false, error } });
const ok = (body: Record<string, unknown> = {}): ActionResult => ({ status: 200, body: { ok: true, ...body } });

function db() {
  const client = getServiceClient();
  if (!client) throw new Error("database_not_configured");
  return client;
}

export async function runAction(action: AdminAction, body: Record<string, unknown>, ctx: ActionContext): Promise<ActionResult> {
  try {
    if (DESTRUCTIVE.has(action) && !verifyTotp(String(body.totp ?? "").replace(/\s/g, ""), ctx.totpSecret)) {
      return fail(400, "totp_invalid");
    }
    switch (action) {
      case "flag.set":
        return await flagSet(body, ctx);
      case "content.generate":
        return await contentGenerate(body, ctx);
      case "content.review":
        return await contentReview(body, ctx);
      case "user.disable":
        return await userBan(body, ctx, BAN_FOREVER, "user.disable");
      case "user.enable":
        return await userBan(body, ctx, "none", "user.enable");
      case "user.delete":
        return await userDelete(body, ctx);
    }
  } catch (e) {
    if (e instanceof AuditUnavailable) return fail(503, "audit_unavailable");
    if ((e as Error).message === "database_not_configured") return fail(503, "database_not_configured");
    return fail(500, "action_failed");
  }
  return fail(400, "unknown_action");
}

async function flagSet(body: Record<string, unknown>, ctx: ActionContext): Promise<ActionResult> {
  const key = String(body.key ?? "");
  if (!knownFlags().includes(key)) return fail(400, "unknown_flag");
  if (typeof body.enabled !== "boolean") return fail(400, "enabled_required");
  const note = typeof body.note === "string" ? body.note.slice(0, 200) : null;
  await auditOrThrow({ actor: ctx.actor, action: "flag.set", target: key, details: { enabled: body.enabled, note }, ip: ctx.ip });
  const { error } = await db()
    .from("feature_flags")
    .upsert({ key, enabled: body.enabled, note, updated_at: new Date().toISOString(), updated_by: ctx.actor }, { onConflict: "key" });
  if (error) return fail(500, "flag_write_failed");
  invalidateFlags();
  return ok({ key, enabled: body.enabled });
}

async function contentGenerate(body: Record<string, unknown>, ctx: ActionContext): Promise<ActionResult> {
  const count = Math.min(10, Math.max(3, Math.round(Number(body.count) || 10)));
  const level = body.level === "kids" || body.level === "adults" ? body.level : "family";
  const flags = await flagMap();
  const allow = (name: string) => flags[`llm:${name}`] !== false;
  await auditOrThrow({ actor: ctx.actor, action: "content.generate", target: "emoji-picture", details: { count, level }, ip: ctx.ip });

  const prompt = buildPrompt("emoji-puzzle", { level, count, avoid: [] });
  const result = await runChain("emoji-puzzle", prompt, (raw) => validateGeminiPayload("emoji-puzzle", raw, count, 4, level), { allow });
  if (!result) return fail(503, "no_provider_answered");
  const items = (result.data as { answer: string; level: "kids" | "family" | "adults" }[]).map((p) => ({
    key: p.answer,
    level: p.level,
    data: p,
    source: `llm:${result.provider}`,
  }));
  const stored = await insertPending("emoji-picture", items);
  return ok({ provider: result.provider, generated: items.length, stored });
}

const EDITABLE = ["answer", "hint", "emojis", "category"] as const;

async function contentReview(body: Record<string, unknown>, ctx: ActionContext): Promise<ActionResult> {
  // content_items.id is a uuid (0001_init.sql). Anything else is refused before the database is asked.
  const id = typeof body.id === "string" ? body.id.trim().toLowerCase() : "";
  if (!UUID.test(id)) return fail(400, "bad_id");
  const decision = body.decision;
  if (decision !== "approve" && decision !== "reject") return fail(400, "bad_decision");

  const { data: row, error: readErr } = await db().from("content_items").select("id, game_id, data, item_key").eq("id", id).maybeSingle();
  if (readErr) return fail(500, "read_failed");
  if (!row) return fail(404, "not_found");

  const data = { ...(row.data as Record<string, unknown>) };
  const edits: Record<string, unknown> = {};
  if (body.edits && typeof body.edits === "object") {
    for (const k of EDITABLE) {
      const v = (body.edits as Record<string, unknown>)[k];
      if (v === undefined) continue;
      if (typeof v !== "string" || !v.trim() || v.length > 120) return fail(400, "bad_edit");
      data[k] = v.trim();
      edits[k] = true;
    }
    if (Array.isArray((body.edits as Record<string, unknown>).alt)) {
      const alt = ((body.edits as Record<string, unknown>).alt as unknown[]).filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean).slice(0, 6);
      data.alt = alt;
      edits.alt = true;
    }
  }
  const answer = typeof data.answer === "string" ? data.answer : "";
  if (decision === "approve" && !answer) return fail(400, "answer_required");

  await auditOrThrow({
    actor: ctx.actor,
    action: "content.review",
    target: `content:${id}`,
    details: { decision, edited: Object.keys(edits), game: row.game_id },
    ip: ctx.ip,
  });

  const update: Record<string, unknown> = {
    data,
    approved: decision === "approve",
    rejected: decision === "reject",
    reviewed_at: new Date().toISOString(),
    reviewed_by: ctx.actor,
  };
  if (answer && row.game_id === "emoji-picture") update.item_key = answer.toLowerCase();
  const { error } = await db().from("content_items").update(update).eq("id", id);
  if (error) return fail(409, "update_failed");
  return ok({ id, decision });
}

async function userBan(body: Record<string, unknown>, ctx: ActionContext, duration: string, action: AdminAction): Promise<ActionResult> {
  const id = String(body.id ?? "");
  if (!UUID.test(id)) return fail(400, "bad_id");
  await auditOrThrow({ actor: ctx.actor, action, target: `user:${id}`, details: {}, ip: ctx.ip });
  const { error } = await db().auth.admin.updateUserById(id, { ban_duration: duration });
  if (error) return fail(500, "ban_failed");
  return ok({ id, disabled: duration !== "none" });
}

async function userDelete(body: Record<string, unknown>, ctx: ActionContext): Promise<ActionResult> {
  const id = String(body.id ?? "");
  if (!UUID.test(id)) return fail(400, "bad_id");
  if (body.exportAcknowledged !== true) return fail(400, "export_required");

  const { data: found, error: findErr } = await db().auth.admin.getUserById(id);
  if (findErr || !found?.user) return fail(404, "not_found");
  const email = found.user.email ?? "";
  if (!email || String(body.confirmEmail ?? "").trim().toLowerCase() !== email.toLowerCase()) return fail(400, "confirm_mismatch");

  const { count } = await db().from("rooms").select("id", { count: "exact", head: true }).eq("host_id", id);
  await auditOrThrow({ actor: ctx.actor, action: "user.delete", target: `user:${id}`, details: { roomsRemoved: count ?? 0 }, ip: ctx.ip });
  const { error } = await db().auth.admin.deleteUser(id);
  if (error) return fail(500, "delete_failed");
  return ok({ id, roomsRemoved: count ?? 0 });
}
