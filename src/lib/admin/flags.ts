import { GAMES } from "@/games/catalog";
import { getServiceClient } from "../supabase/service";

/**
 * Kill switches. A flag with no row is ON. Keys:
 *   game:<id>        hide a game from the host's list
 *   llm:<provider>   stop calling a provider (gemini, groq, openrouter, cloudflare)
 *   suggest          stop all AI suggestions (built-in and approved content still work)
 *
 * Each server instance caches the table for 30 seconds, so a change can take up to that long.
 */

export const LLM_PROVIDERS = ["gemini", "groq", "openrouter", "cloudflare"] as const;

export function knownFlags(): string[] {
  return ["suggest", ...LLM_PROVIDERS.map((p) => `llm:${p}`), ...GAMES.map((g) => `game:${g.id}`)];
}

const TTL_MS = 30_000;
let cache: { at: number; map: Record<string, { enabled: boolean; note: string | null }> } | null = null;

export async function loadFlagRows(force = false): Promise<Record<string, { enabled: boolean; note: string | null }>> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.map;
  const db = getServiceClient();
  if (!db) return cache?.map ?? {};
  try {
    const { data, error } = await db.from("feature_flags").select("key, enabled, note");
    if (error) throw error;
    const map: Record<string, { enabled: boolean; note: string | null }> = {};
    for (const row of data ?? []) map[row.key] = { enabled: row.enabled, note: row.note ?? null };
    cache = { at: Date.now(), map };
    return map;
  } catch {
    // Database unreachable: keep the last known state. A switch that was turned off stays off.
    return cache?.map ?? {};
  }
}

/** Map of flag key → enabled. Keys without a row are true. */
export async function flagMap(force = false): Promise<Record<string, boolean>> {
  const rows = await loadFlagRows(force);
  const out: Record<string, boolean> = {};
  for (const key of knownFlags()) out[key] = rows[key]?.enabled ?? true;
  return out;
}

export function invalidateFlags(): void {
  cache = null;
}
