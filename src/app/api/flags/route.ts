import { NextResponse } from "next/server";
import { flagMap } from "@/lib/admin/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public: which games are switched on. Nothing secret or personal is returned. The host screen
 * uses it to hide games the owner has switched off.
 */
export async function GET() {
  const flags = await flagMap();
  const games: Record<string, boolean> = {};
  for (const [key, on] of Object.entries(flags)) if (key.startsWith("game:")) games[key.slice(5)] = on;
  return NextResponse.json({ games }, { headers: { "cache-control": "public, max-age=0, s-maxage=15" } });
}
