import { EMOJI_PUZZLES, type EmojiPuzzle } from "@/content/emoji-picture";
import type { Level } from "@/lib/types";
import { getServiceClient } from "../supabase/service";
import { validateGeminiPayload } from "./validate";

/**
 * The content library (migration 0010). Every item the AI services make is kept and served again to
 * other hosts, so a game only waits for the AI when the library has nothing new for this viewer.
 *
 * Viewers are keyed by account id (hosts) or an anonymous id (guests), never by email. An item shown
 * to a viewer isn't shown to them again for 30 days. All reads and writes go through the database
 * functions with the service role key, on the server only.
 *
 * Every call here degrades quietly: with no database, or before 0010 is applied, the library is
 * skipped and the app behaves as it did before.
 */

export const LIBRARY_KINDS = ["chor-kaun-topic", "emoji-puzzle", "dare"] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export const GAME_FOR: Record<LibraryKind, string> = {
  "chor-kaun-topic": "chor-kaun",
  "emoji-puzzle": "emoji-picture",
  dare: "dare",
};

export const LANG = "en";

const LEVELS_FOR: Record<Level, Level[]> = {
  kids: ["kids"],
  family: ["kids", "family"],
  adults: ["family", "adults"],
};

export function isLibraryKind(kind: string): kind is LibraryKind {
  return (LIBRARY_KINDS as readonly string[]).includes(kind);
}

export interface Viewer {
  userId?: string | null;
  anonId?: string | null;
}

export interface LibraryItem {
  category: string;
  key: string;
  data: Record<string, unknown>;
  /** The admin's topic for "Generate more" (0011). Games don't set it. */
  theme?: string;
}

const builtinEmoji = new Set(EMOJI_PUZZLES.map((p) => `${p.emojis}|${p.answer.toLowerCase()}`));

/** Same normalising as library_norm in 0010, for the exclusion list sent to the database. */
export function normText(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 200);
}

/** What a pick asks the database for, per kind. */
export function pickPlan(kind: LibraryKind, context: Record<string, unknown>) {
  const avoid = Array.isArray(context.avoid) ? (context.avoid as string[]) : [];
  const excludeNorms = [...new Set(avoid.map(normText).filter(Boolean))];
  if (kind === "emoji-puzzle") {
    const level = (typeof context.level === "string" && context.level in LEVELS_FOR ? context.level : "family") as Level;
    const count = typeof context.count === "number" ? context.count : 10;
    return { categories: LEVELS_FOR[level], count, min: count, excludeNorms, excludeIds: [] as string[], level };
  }
  if (kind === "chor-kaun-topic") {
    const ids = Array.isArray(context.excludeTopicIds) ? (context.excludeTopicIds as string[]) : [];
    return { categories: ["any"], count: 1, min: 1, excludeNorms, excludeIds: ids, level: "family" as Level };
  }
  const audience = context.audience === "mixed" ? "mixed" : "family";
  return { categories: [audience], count: 1, min: 1, excludeNorms, excludeIds: [] as string[], level: "family" as Level };
}

/** Shapes rows from the database into what the game expects, re-checked by the same validators as AI output. */
export function shapeServed(kind: LibraryKind, rows: { data: unknown }[], context: Record<string, unknown>): unknown | null {
  if (!rows.length) return null;
  if (kind === "emoji-puzzle") {
    const plan = pickPlan(kind, context);
    return validateGeminiPayload(kind, rows.map((r) => r.data), plan.count, 4, plan.level);
  }
  return validateGeminiPayload(kind, rows[0]?.data);
}

/**
 * Picks items for this viewer that they haven't been shown in 30 days, and records them as shown.
 * `min` overrides how many must be eligible (a full emoji round by default). Returns null when the
 * library can't serve, so the caller asks the AI services instead.
 */
export async function pickFromLibrary(
  kind: LibraryKind,
  context: Record<string, unknown>,
  viewer: Viewer,
  opts: { min?: number } = {},
): Promise<unknown | null> {
  const db = getServiceClient();
  if (!db || (!viewer.userId && !viewer.anonId)) return null;
  const plan = pickPlan(kind, context);
  try {
    const { data, error } = await db.rpc("library_pick", {
      p_user: viewer.userId ?? null,
      p_anon: viewer.userId ? null : viewer.anonId ?? null,
      p_kind: kind,
      p_categories: plan.categories,
      p_lang: LANG,
      p_count: plan.count,
      p_min: Math.min(plan.count, Math.max(1, opts.min ?? plan.min)),
      p_exclude_norms: plan.excludeNorms.slice(0, 60),
      p_exclude_ids: plan.excludeIds.slice(0, 60),
    });
    if (error || !Array.isArray(data)) return null;
    return shapeServed(kind, data as { data: unknown }[], context);
  } catch {
    return null;
  }
}

/** Turns validated AI output into library rows. Built-in puzzles used to pad a short reply are left out. */
export function itemsFrom(kind: LibraryKind, data: unknown, context: Record<string, unknown> = {}): LibraryItem[] {
  const theme = typeof context.theme === "string" && context.theme ? context.theme : undefined;
  return rawItems(kind, data, context).map((i) => (theme ? { ...i, theme } : i));
}

function rawItems(kind: LibraryKind, data: unknown, context: Record<string, unknown>): LibraryItem[] {
  if (kind === "emoji-puzzle" && Array.isArray(data)) {
    return (data as EmojiPuzzle[])
      .filter((p) => p && typeof p.answer === "string" && !builtinEmoji.has(`${p.emojis}|${p.answer.toLowerCase()}`))
      .map((p) => ({ category: p.level, key: p.answer, data: { ...p } as Record<string, unknown> }));
  }
  if (kind === "chor-kaun-topic" && data && typeof data === "object") {
    const t = data as { label?: unknown };
    return typeof t.label === "string" ? [{ category: "any", key: t.label, data: { ...(data as Record<string, unknown>) } }] : [];
  }
  if (kind === "dare" && data && typeof data === "object") {
    const d = data as { text?: unknown };
    const audience = context.audience === "mixed" ? "mixed" : "family";
    return typeof d.text === "string" ? [{ category: audience, key: d.text, data: { text: d.text } }] : [];
  }
  return [];
}

/**
 * Saves AI output to the library (duplicates by normalised text are skipped in the database). When a
 * viewer is given, the items are also recorded as shown to them. Returns how many new items were
 * stored, or null when the library isn't available.
 */
export async function saveToLibrary(
  kind: LibraryKind,
  items: LibraryItem[],
  source: string,
  viewer?: Viewer,
): Promise<number | null> {
  const db = getServiceClient();
  if (!db || !items.length) return db ? 0 : null;
  const cleanSource = source.toLowerCase().replace(/[^a-z0-9:_.-]/g, "").slice(0, 64) || "llm:unknown";
  try {
    let stored = 0;
    for (let i = 0; i < items.length; i += 50) {
      const { data, error } = await db.rpc("library_add", {
        p_kind: kind,
        p_game: GAME_FOR[kind],
        p_lang: LANG,
        p_source: cleanSource,
        p_items: items.slice(i, i + 50),
        p_user: viewer?.userId ?? null,
        p_anon: viewer?.userId ? null : viewer?.anonId ?? null,
        p_mark_seen: !!(viewer?.userId || viewer?.anonId),
      });
      if (error) return null;
      stored += Number(data) || 0;
    }
    return stored;
  } catch {
    return null;
  }
}
