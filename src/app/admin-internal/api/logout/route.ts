import { NextResponse } from "next/server";
import { adminConfig } from "@/lib/admin/config";
import { adminHeaders, clearedCookie, isSecure, sameOrigin } from "@/lib/admin/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cfg = adminConfig();
  if (!cfg) return new NextResponse(null, { status: 404 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: adminHeaders });
  return NextResponse.json(
    { ok: true },
    { headers: { ...adminHeaders, "set-cookie": clearedCookie(cfg, isSecure(req)) } },
  );
}
