import { NextResponse } from "next/server";
import { adminConfig } from "@/lib/admin/config";
import { adminHeaders, hasAdminSession } from "@/lib/admin/session";
import * as q from "@/lib/admin/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: adminHeaders });

/** One endpoint, several views. Every view requires a valid admin session. */
export async function GET(req: Request) {
  const cfg = adminConfig();
  if (!cfg) return new NextResponse(null, { status: 404 });
  if (!hasAdminSession(req, cfg)) return json({ error: "unauthorized" }, 401);

  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "overview";
  const search = (url.searchParams.get("q") ?? "").slice(0, 100).replace(/[%_\\]/g, "");
  const page = Math.min(1000, Math.max(0, Number(url.searchParams.get("page") ?? 0) || 0));

  try {
    switch (view) {
      case "me":
        return json({ user: cfg.username });
      case "overview":
        return json(await q.overview());
      case "users":
        return json(await q.users(search, page));
      case "games":
        return json(await q.games());
      case "llm":
        return json(await q.llm());
      case "logins":
        return json(await q.logins());
      default:
        return json({ error: "unknown_view" }, 400);
    }
  } catch (e) {
    // Don't echo database errors to the browser: they can name tables and columns.
    const configured = (e as Error).message !== "database_not_configured";
    return json({ error: configured ? "query_failed" : "database_not_configured" }, 500);
  }
}
