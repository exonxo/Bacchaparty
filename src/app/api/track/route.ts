import { NextResponse } from "next/server";
import { logEvent } from "@/lib/admin/events";
import { findOwnRoom } from "@/lib/rooms";
import { isSupabaseConfigured } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";
import { clientIp } from "@/lib/admin/session";
import { checkRateLimit } from "@/lib/suggest/rate-limit";
import { GAMES } from "@/games/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GAME_IDS = new Set(GAMES.map((g) => g.id));
const noStore = { "cache-control": "no-store" };

/** Records that a host started a game. Only the room's own host can do this, and only for real games. */
export async function POST(req: Request) {
  let body: { roomCode?: unknown; game?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400, headers: noStore });
  }
  const game = typeof body.game === "string" ? body.game : "";
  if (!GAME_IDS.has(game)) return NextResponse.json({ ok: false, error: "unknown_game" }, { status: 400, headers: noStore });

  const roomCode = typeof body.roomCode === "string" ? body.roomCode.trim().toUpperCase() : "";
  if (!/^[A-Z]{4}$/.test(roomCode)) return NextResponse.json({ ok: false, error: "bad_room" }, { status: 400, headers: noStore });

  if (!isSupabaseConfigured) return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401, headers: noStore });
  // Per-IP limit before getUser, so a flood never reaches the auth server either.
  if (!checkRateLimit(`track-ip:${clientIp(req)}`)) return NextResponse.json({ ok: false, error: "slow_down" }, { status: 429, headers: noStore });
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401, headers: noStore });

  // Checked before the database lookup, so a flood of requests never reaches the database.
  // A host can start a game a few times; a loop of requests is not a real party.
  if (!checkRateLimit(`track:${user.id}`)) return NextResponse.json({ ok: false, error: "slow_down" }, { status: 429, headers: noStore });
  const own = await findOwnRoom(roomCode, user.id);
  if (!own) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403, headers: noStore });


  await logEvent("game_started", { game });
  return NextResponse.json({ ok: true }, { headers: noStore });
}
