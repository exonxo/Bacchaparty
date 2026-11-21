import { NextResponse } from "next/server";
import { adminConfig } from "@/lib/admin/config";
import { auditOrThrow, AuditUnavailable } from "@/lib/admin/audit";
import { adminHeaders, adminSession, clientIp } from "@/lib/admin/session";
import * as q from "@/lib/admin/queries";
import { isLibraryKind } from "@/lib/suggest/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: adminHeaders });

/** Views that show personal data. Each one is written to the audit log before the data is read. */
const SENSITIVE = new Set(["users", "user", "room", "find"]);
/** Bulk exports. Not personal data, but audited first like the sensitive views. */
const EXPORTS = new Set(["library_csv"]);

/** One endpoint, several views. Every view requires a valid admin session. */
export async function GET(req: Request) {
  const cfg = adminConfig();
  if (!cfg) return new NextResponse(null, { status: 404 });
  const session = await adminSession(req, cfg);
  if (!session) return json({ error: "unauthorized" }, 401);

  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "overview";
  const search = (url.searchParams.get("q") ?? "").slice(0, 100).replace(/[%_\\]/g, "");
  const page = Math.min(1000, Math.max(0, Number(url.searchParams.get("page") ?? 0) || 0));
  const id = (url.searchParams.get("id") ?? "").slice(0, 64);
  const code = (url.searchParams.get("code") ?? "").toUpperCase().slice(0, 4);

  // Reject malformed lookups before anything is audited or read.
  if (view === "room" && !/^[A-Z]{4}$/.test(code)) return json({ error: "bad_code" }, 400);
  if (view === "user" && !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "bad_id" }, 400);
  if (view === "find" && !(url.searchParams.get("email") ?? "").includes("@")) return json({ error: "bad_email" }, 400);
  const kind = url.searchParams.get("kind") ?? "";
  if (view === "library_items" && !isLibraryKind(kind)) return json({ error: "bad_kind" }, 400);

  try {
    if (SENSITIVE.has(view)) {
      const actor = session.user;
      const target = view === "room" ? `room:${code}` : view === "user" ? `user:${id}` : view === "find" ? "lookup" : null;
      await auditOrThrow({ actor, action: `view.${view}`, target, details: { query: view === "users" ? search : undefined, page }, ip: clientIp(req) });
    }
    if (EXPORTS.has(view)) {
      await auditOrThrow({ actor: session.user, action: `export.${view}`, target: null, details: {}, ip: clientIp(req) });
    }
    switch (view) {
      case "me":
        return json({ user: cfg.username });
      case "overview":
        return json(await q.overview());
      case "users":
        return json(await q.users(search, page));
      case "find": {
        const email = (url.searchParams.get("email") ?? "").slice(0, 254);
        if (!email.includes("@")) return json({ error: "bad_email" }, 400);
        const id = await q.findUser(email);
        return id ? json({ id }) : json({ error: "not_found" }, 404);
      }
      case "user": {
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "bad_id" }, 400);
        return json(await q.user(id));
      }
      case "room": {
        if (!/^[A-Z]{4}$/.test(code)) return json({ error: "bad_code" }, 400);
        return json(await q.room(code));
      }
      case "games":
        return json(await q.games());
      case "llm":
        return json(await q.llm());
      case "logins":
        return json(await q.logins());
      case "audit":
        return json(await q.audit());
      case "flags":
        return json(await q.flags());
      case "content":
        return json(await q.content());
      case "library":
        return json(await q.library());
      case "library_items":
        return json(await q.libraryItems(kind, page));
      case "library_csv": {
        const out = await q.libraryCsv();
        const day = new Date().toISOString().slice(0, 10);
        return new NextResponse(out.csv, {
          status: 200,
          headers: {
            ...adminHeaders,
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": `attachment; filename="bawaal-content-library-${day}.csv"`,
            "x-library-rows": String(out.rows),
            "x-library-truncated": out.truncated ? "1" : "0",
          },
        });
      }
      case "funnel":
        return json(await q.funnel());
      case "quota":
        return json(await q.quotaToday());
      case "health":
        return json(await q.health());
      default:
        return json({ error: "unknown_view" }, 400);
    }
  } catch (e) {
    if (e instanceof AuditUnavailable) return json({ error: "audit_unavailable" }, 503);
    if ((e as Error).message === "not_found") return json({ error: "not_found" }, 404);
    // Don't echo database errors to the browser: they can name tables and columns.
    const configured = (e as Error).message !== "database_not_configured";
    return json({ error: configured ? "query_failed" : "database_not_configured" }, 500);
  }
}
