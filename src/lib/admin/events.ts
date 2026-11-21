import { getServiceClient } from "../supabase/service";

/** Event kinds the app records. Anything else is refused. */
export const EVENT_KINDS = ["game_started", "suggest", "admin_login", "api_error", "cron_run"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Writes one row to `app_events`. Never throws: analytics must not break a game. */
export async function logEvent(kind: EventKind, detail: Record<string, unknown>): Promise<void> {
  try {
    const db = getServiceClient();
    if (!db) return;
    await db.from("app_events").insert({ kind, detail });
  } catch {
    /* ignore */
  }
}
