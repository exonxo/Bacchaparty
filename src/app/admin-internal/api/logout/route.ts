import { NextResponse } from "next/server";
import { adminConfig } from "@/lib/admin/config";
import { revokeSession } from "@/lib/admin/revoked";
import { adminHeaders, adminSession, clearedCookie, isSecure, sameOrigin } from "@/lib/admin/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Clears the cookie and revokes the session token, so a copied cookie stops working too. */
export async function POST(req: Request) {
  const cfg = adminConfig();
  if (!cfg) return new NextResponse(null, { status: 404 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: adminHeaders });
  const session = await adminSession(req, cfg);
  if (session) await revokeSession(session.sid, session.exp);
  return NextResponse.json(
    { ok: true },
    { headers: { ...adminHeaders, "set-cookie": clearedCookie(cfg, isSecure(req)) } },
  );
}
