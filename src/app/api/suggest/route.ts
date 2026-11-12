import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { findOwnRoom } from "@/lib/rooms";
import { getUser } from "@/lib/supabase/server";
import { fallbackFor } from "@/lib/suggest/fallbacks";
import { callGemini } from "@/lib/suggest/gemini";
import { cacheGet, cacheKey, cacheSet, checkRateLimit, rateLimitKey } from "@/lib/suggest/rate-limit";
import { SUGGEST_KINDS, type SuggestKind } from "@/lib/suggest/types";
import { GAMES } from "@/games/catalog";
import { validateGeminiPayload } from "@/lib/suggest/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

const LEVELS = ["kids", "family", "adults"];
const GAME_IDS = new Set(GAMES.map((g) => g.id));

/**
 * Keeps only the context each kind needs, with safe types and sizes, so the
 * browser can't steer the prompt or ask for a huge answer.
 */
function cleanContext(kind: SuggestKind, raw: Record<string, unknown>): Record<string, unknown> {
  const int = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
  switch (kind) {
    case "chor-kaun-topic": {
      const ids = Array.isArray(raw.excludeTopicIds) ? raw.excludeTopicIds : [];
      return { excludeTopicIds: ids.filter((x): x is string => typeof x === "string" && /^[a-z0-9-]{1,40}$/.test(x)).slice(0, 60) };
    }
    case "emoji-puzzle":
      return { level: LEVELS.includes(raw.level as string) ? raw.level : "family", count: int(raw.count, 3, 15, 10) };
    case "next-game": {
      const played = Array.isArray(raw.gamesPlayed) ? raw.gamesPlayed : [];
      return { playerCount: int(raw.playerCount, 1, 50, 4), gamesPlayed: played.filter((g): g is string => typeof g === "string" && GAME_IDS.has(g)).slice(0, 12) };
    }
    case "dare":
      return { audience: raw.audience === "mixed" ? "mixed" : "family" };
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
  {
    if (!/^[A-Z]{4}$/.test(roomCode)) {
      return NextResponse.json({ ok: false, error: "bad_room" }, { status: 400, headers: noStore });
    }
    const own = await findOwnRoom(roomCode, user.id);
    if (!own) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403, headers: noStore });
    }
  }

  const ip = clientIp(req);
  const rlKey = rateLimitKey(ip, roomCode);
  if (!checkRateLimit(rlKey)) {
    const data = fallbackFor(kind, { kind, ...context });
    return ok(data, true);
  }

  const cKey = cacheKey(kind, { ...context, roomCode });
  const cached = cacheGet(cKey);
  if (cached !== undefined) {
    return ok(cached, false);
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const data = fallbackFor(kind, { kind, ...context });
    return ok(data, true);
  }

  const contextCount = kind === "emoji-puzzle" && typeof context.count === "number" ? context.count : 10;

  try {
    const raw = await callGemini(apiKey, kind, context);
    const validated = raw != null ? validateGeminiPayload(kind, raw, contextCount) : null;
    if (validated != null) {
      cacheSet(cKey, validated);
      return ok(validated, false);
    }
  } catch {
    /* timeout / network — fall through */
  }

  const data = fallbackFor(kind, { kind, ...context });
  return ok(data, true);
}
