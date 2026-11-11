import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { findOwnRoom } from "@/lib/rooms";
import { getUser } from "@/lib/supabase/server";
import { fallbackFor } from "@/lib/suggest/fallbacks";
import { callGemini } from "@/lib/suggest/gemini";
import { cacheGet, cacheKey, cacheSet, checkRateLimit, rateLimitKey } from "@/lib/suggest/rate-limit";
import { SUGGEST_KINDS, type SuggestKind } from "@/lib/suggest/types";
import { validateGeminiPayload } from "@/lib/suggest/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
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

  const context = body.context ?? {};
  const roomCode = typeof body.roomCode === "string" ? body.roomCode.trim().toUpperCase() : undefined;

  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401, headers: noStore });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401, headers: noStore });
  }

  if (roomCode) {
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
    return ok(cached, true);
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
