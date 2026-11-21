import { NextResponse } from "next/server";
import { adminConfig } from "@/lib/admin/config";
import { ACTIONS, type AdminAction } from "@/lib/admin/audit";
import { runAction } from "@/lib/admin/actions";
import { adminHeaders, adminSession, clientIp, sameOrigin } from "@/lib/admin/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// "Generate more" makes up to 5 AI calls of at most 8 seconds each.
export const maxDuration = 60;

/** Write actions (flags, content review, user disable/enable/delete). Session, origin and JSON are all required. */
export async function POST(req: Request) {
  const cfg = adminConfig();
  if (!cfg) return new NextResponse(null, { status: 404 });
  const session = await adminSession(req, cfg);
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: adminHeaders });
  if (!sameOrigin(req) || !(req.headers.get("content-type") ?? "").includes("application/json")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403, headers: adminHeaders });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400, headers: adminHeaders });
  }
  const action = String(body.action ?? "");
  if (!(ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400, headers: adminHeaders });
  }

  const result = await runAction(action as AdminAction, body, {
    actor: session.user,
    ip: clientIp(req),
    totpSecret: cfg.totpSecret,
  });
  return NextResponse.json(result.body, { status: result.status, headers: adminHeaders });
}
