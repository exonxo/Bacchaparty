import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

/**
 * Nightly retention job (see vercel.json). Deletes old rooms, events and login attempts as the
 * privacy policy describes. Host accounts are never removed here.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET variable is set. If it
 * isn't set, this route refuses every request: it never runs unauthenticated.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !tokenMatches(req.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: noStore });
  }
  const db = getServiceClient();
  if (!db) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503, headers: noStore });

  const { data, error } = await db.rpc("purge_old_data");
  if (error) {
    // Don't echo the database message: it can name internal tables.
    return NextResponse.json({ ok: false, error: "purge_failed" }, { status: 500, headers: noStore });
  }
  return NextResponse.json({ ok: true, removed: data, at: new Date().toISOString() }, { headers: noStore });
}

/** Constant-time comparison. Hashing first gives equal-length inputs, so length isn't leaked either. */
function tokenMatches(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
