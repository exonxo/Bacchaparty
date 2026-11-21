import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { runTopup, topupDue } from "@/lib/suggest/topup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The purge takes a second; the weekly library top-up that follows it needs up to about 50 seconds.
export const maxDuration = 60;

const noStore = { "cache-control": "no-store" };

/**
 * Nightly retention job (see vercel.json). Deletes old rooms, events and login attempts as the
 * privacy policy describes. Host accounts are never removed here.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET variable is set. If it
 * isn't set, this route refuses every request: it never runs unauthenticated.
 *
 * After a successful purge it also runs the weekly library top-up when one is due (see topup.ts).
 * That reuses this cron instead of adding a new entry to vercel.json.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !tokenMatches(req.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: noStore });
  }
  const db = getServiceClient();
  if (!db) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503, headers: noStore });

  const { data, error } = await db.rpc("purge_old_data");
  // Record the run so the admin health view can show when it last ran and whether it worked.
  await db.from("cron_runs").insert({ job: "purge", ok: !error, detail: error ? { error: "purge_failed" } : (data ?? {}) }).then(
    () => undefined,
    () => undefined,
  );
  if (error) {
    // Don't echo the database message: it can name internal tables.
    return NextResponse.json({ ok: false, error: "purge_failed" }, { status: 500, headers: noStore });
  }
  let topup: Record<string, unknown> | null = null;
  try {
    if (await topupDue()) {
      const r = await runTopup("cron", 45_000);
      topup = { ok: r.ok, done: r.done, made: r.made, kept: r.kept, rejected: r.rejected, stored: r.stored, skipped: r.skipped ?? null };
    }
  } catch {
    topup = { ok: false, error: "topup_failed" };
  }
  return NextResponse.json({ ok: true, removed: data, topup, at: new Date().toISOString() }, { headers: noStore });
}

/** Constant-time comparison. Hashing first gives equal-length inputs, so length isn't leaked either. */
function tokenMatches(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
