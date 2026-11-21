import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { logLater } from "@/lib/admin/events";
import { approvedChorTopic, approvedEmojiPuzzles } from "@/lib/admin/bank";
import { flagMap } from "@/lib/admin/flags";
import { findOwnRoom } from "@/lib/rooms";
import { getUser } from "@/lib/supabase/server";
import { fallbackFor } from "@/lib/suggest/fallbacks";
import { runChain } from "@/lib/suggest/chain";
import { buildPrompt } from "@/lib/suggest/prompts";
import { cleanAvoid, notRepeated } from "@/lib/suggest/avoid";
import { checkRateLimit, inflightKey, rateLimitKey, runDeduped } from "@/lib/suggest/rate-limit";
import { SUGGEST_KINDS, type SuggestKind } from "@/lib/suggest/types";
import { validateGeminiPayload } from "@/lib/suggest/validate";
import type { Level } from "@/lib/types";
import { GAMES } from "@/games/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

const noStore = { "cache-control": "no-store" };

function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

const LEVELS = ["kids", "family", "adults"];
const GAME_IDS = new Set(GAMES.map((g) => g.id));

/** Keeps only the context each kind needs, with safe types and sizes, so the browser can't steer the prompt. */
function cleanContext(kind: SuggestKind, raw: Record<string, unknown>): Record<string, unknown> {
  const int = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
  const avoid = cleanAvoid(raw.avoid);
  switch (kind) {
    case "chor-kaun-topic": {
      const ids = Array.isArray(raw.excludeTopicIds) ? raw.excludeTopicIds : [];
      return {
        excludeTopicIds: ids.filter((x): x is string => typeof x === "string" && /^[a-z0-9-]{1,40}$/.test(x)).slice(0, 60),
        avoid,
      };
    }
    case "emoji-puzzle":
      return { level: LEVELS.includes(raw.level as string) ? raw.level : "family", count: int(raw.count, 3, 15, 10), avoid };
    case "next-game": {
      const played = Array.isArray(raw.gamesPlayed) ? raw.gamesPlayed : [];
      return { playerCount: int(raw.playerCount, 1, 50, 4), gamesPlayed: played.filter((g): g is string => typeof g === "string" && GAME_IDS.has(g)).slice(0, 12) };
    }
    case "dare":
      return { audience: raw.audience === "mixed" ? "mixed" : "family", avoid };
    default:
      return {};
  }
}

function ok(data: unknown, fallback: boolean) {
  return NextResponse.json({ ok: true, fallback, data }, { headers: noStore });
}

export async function POST(req: Request) {
  let body: { kind?: string; context?: Record<string, unknown>; roomCode?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400, headers: noStore });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400, headers: noStore });
  }

  const kind = body.kind as SuggestKind | undefined;
  if (!kind || !SUGGEST_KINDS.includes(kind)) {
    return NextResponse.json({ ok: false, error: "bad_kind" }, { status: 400, headers: noStore });
  }

  const context = cleanContext(kind, body.context && typeof body.context === "object" ? body.context : {});
  const roomCode = typeof body.roomCode === "string" ? body.roomCode.trim().toUpperCase() : undefined;

  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401, headers: noStore });
  }
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401, headers: noStore });
  }
  if (!roomCode) {
    return NextResponse.json({ ok: false, error: "room_required" }, { status: 400, headers: noStore });
  }
  if (!/^[A-Z]{4}$/.test(roomCode)) {
    return NextResponse.json({ ok: false, error: "bad_room" }, { status: 400, headers: noStore });
  }
  const own = await findOwnRoom(roomCode, user.id);
  if (!own) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403, headers: noStore });
  }

  const avoid = Array.isArray(context.avoid) ? (context.avoid as string[]) : [];
  const fallbackNow = () => fallbackFor(kind, { kind, ...context });
  const ip = clientIp(req);
  if (!checkRateLimit(rateLimitKey(ip, roomCode))) {
    logLater("suggest", { suggest_kind: kind, provider: "none", fallback: true, ms: 0, reason: "rate_limited" });
    return ok(fallbackNow(), true);
  }

  const contextCount = kind === "emoji-puzzle" && typeof context.count === "number" ? context.count : 10;
  const playerCount = kind === "next-game" && typeof context.playerCount === "number" ? context.playerCount : 4;
  const emojiLevel = (kind === "emoji-puzzle" && typeof context.level === "string" ? context.level : "family") as Level;

  // Kill switches: "suggest" stops all model calls; "llm:<name>" skips one provider.
  const flags = await flagMap();
  if (flags["suggest"] === false) {
    logLater("suggest", { suggest_kind: kind, provider: "none", fallback: true, ms: 0, reason: "switched_off" });
    return ok((await bankFallback(kind, context)) ?? fallbackNow(), true);
  }

  const prompt = buildPrompt(kind, context);
  const accept = (raw: unknown) => {
    const validated = validateGeminiPayload(kind, raw, contextCount, playerCount, emojiLevel);
    return validated == null ? null : notRepeated(kind, validated, avoid);
  };

  try {
    const result = await runDeduped(inflightKey(kind, { ...context, roomCode }), () =>
      runChain(kind, prompt, accept, { allow: (name) => flags[`llm:${name}`] !== false }),
    );
    if (result) {
      logLater("suggest", { suggest_kind: kind, provider: result.provider, fallback: false, ms: result.ms });
      return ok(result.data, false);
    }
  } catch {
    logLater("api_error", { route: "suggest", status: 500 });
  }

  // Approved, human-reviewed content comes before the fixed built-in lists.
  const banked = await bankFallback(kind, context);
  if (banked) {
    logLater("suggest", { suggest_kind: kind, provider: "bank", fallback: true, ms: 0, reason: "all_providers_failed" });
    return ok(banked, true);
  }
  logLater("suggest", { suggest_kind: kind, provider: "none", fallback: true, ms: 0, reason: "all_providers_failed" });
  return ok(fallbackNow(), true);
}

/** Approved review-bank content for this kind, or null when there isn't enough of it. */
async function bankFallback(kind: SuggestKind, context: Record<string, unknown>): Promise<unknown | null> {
  const avoid = Array.isArray(context.avoid) ? (context.avoid as string[]) : [];
  if (kind === "emoji-puzzle") {
    const level = (typeof context.level === "string" ? context.level : "family") as Level;
    const count = typeof context.count === "number" ? context.count : 10;
    return approvedEmojiPuzzles(level, count, avoid);
  }
  if (kind === "chor-kaun-topic") {
    const exclude = Array.isArray(context.excludeTopicIds) ? (context.excludeTopicIds as string[]) : [];
    return approvedChorTopic(avoid, exclude);
  }
  return null;
}
