/**
 * Movie content from real TMDB titles: emoji puzzles (the AI only draws the emoji; the answer is the
 * TMDB title) and Chor Kaun topics (a list of popular titles from one decade; no AI at all).
 */
import { EMOJI_PUZZLES, type EmojiPuzzle } from "@/content/emoji-picture";
import { getServiceClient } from "../supabase/service";
import { runChain } from "./chain";
import { normText, type LibraryItem } from "./library";
import { buildPrompt } from "./prompts";
import { cinemaName, popularIndianMovies, resolveTitles, type TmdbMovie } from "./tmdb";
import { screenEmojiPuzzles, validateChorTopic } from "./validate";

/** Share of Chor Kaun topics made from movie titles in the weekly top-up. CHOR_MOVIE_SHARE overrides (0–1). */
export const CHOR_MOVIE_SHARE_DEFAULT = 1 / 3;
export function chorMovieShare(): number {
  const v = Number(process.env.CHOR_MOVIE_SHARE);
  return Number.isFinite(v) && v >= 0 && v <= 1 && process.env.CHOR_MOVIE_SHARE?.trim() ? v : CHOR_MOVIE_SHARE_DEFAULT;
}

export interface Stats {
  made: number;
  rejected: number;
  reasons: Record<string, number>;
}
export const newStats = (): Stats => ({ made: 0, rejected: 0, reasons: {} });
function reject(stats: Stats, reason: string, n = 1) {
  stats.rejected += n;
  stats.reasons[reason] = (stats.reasons[reason] ?? 0) + n;
}

/** Normalised texts already in the library for a kind (answers or topic labels), plus built-ins. */
export async function libraryTexts(kind: "emoji-puzzle" | "chor-kaun-topic"): Promise<Set<string>> {
  const out = new Set<string>(kind === "emoji-puzzle" ? EMOJI_PUZZLES.map((p) => normText(p.answer)) : []);
  const db = getServiceClient();
  if (!db) return out;
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await db.from("content_library").select("text_norm").eq("kind", kind).range(from, from + 999);
    if (error || !data) break;
    for (const r of data as { text_norm: string }[]) out.add(r.text_norm);
    if (data.length < 1000) break;
  }
  return out;
}

const known = (m: TmdbMovie, used: Set<string>) => [m.title, ...m.alt].some((t) => used.has(normText(t)));

/**
 * Up to `n` popular movies not already used as answers. `spread` picks at random among the most-rated
 * unused ones (admin runs, for variety); otherwise most-rated first (the weekly top-up).
 */
export async function pickMovies(langs: string, n: number, used: Set<string>, spread = false): Promise<TmdbMovie[]> {
  const fresh = (await popularIndianMovies(langs)).filter((m) => !known(m, used));
  let pool = fresh.slice(0, spread ? Math.max(n * 3, 30) : n + 10);
  if (spread) pool = pool.map((m) => ({ m, r: Math.random() })).sort((a, b) => a.r - b.r).map((x) => x.m);
  const resolved = await resolveTitles(pool.slice(0, n + 5));
  const out: TmdbMovie[] = [];
  const seen = new Set<string>();
  for (const m of resolved) {
    const k = normText(m.title);
    if (known(m, used) || seen.has(k)) continue;
    seen.add(k);
    out.push(m);
    if (out.length >= n) break;
  }
  return out;
}

/** Keeps only puzzles whose answer is one of these movies, with the TMDB title as the answer. */
export function screenMoviePuzzles(raw: unknown, movies: TmdbMovie[], stats: Stats): EmojiPuzzle[] | null {
  const r = screenEmojiPuzzles(raw, { level: "family", category: "Movie", limit: movies.length + 5 });
  stats.made += r.made;
  for (const [k, v] of Object.entries(r.reasons)) reject(stats, k, v ?? 0);
  const byName = new Map<string, TmdbMovie>();
  for (const m of movies) for (const t of [m.title, ...m.alt]) byName.set(normText(t), m);
  const done = new Set<number>();
  const kept: EmojiPuzzle[] = [];
  for (const p of r.kept) {
    const m = byName.get(normText(p.answer));
    if (!m) reject(stats, "not_from_list");
    else if (done.has(m.id)) reject(stats, "duplicate");
    else {
      done.add(m.id);
      const alt = [...new Set([...(p.alt ?? []), ...m.alt].filter((a) => normText(a) !== normText(m.title)))].slice(0, 4);
      kept.push({ ...p, answer: m.title, alt, category: "Movie", level: "family", tmdbId: m.id } as EmojiPuzzle);
    }
  }
  return kept.length ? kept : null;
}

const RETRY_WAIT_MS = 10_000;

/** Emoji puzzles for these movies, 10 per AI call, stopping at the deadline. */
export async function moviePuzzles(
  movies: TmdbMovie[],
  opts: { allow?: (name: string) => boolean; temperature?: number; deadline?: number },
): Promise<{ puzzles: EmojiPuzzle[]; stats: Stats; providers: Record<string, number>; calls: number }> {
  const stats = newStats();
  const providers: Record<string, number> = {};
  const puzzles: EmojiPuzzle[] = [];
  let calls = 0;
  for (let i = 0; i < movies.length; i += 10) {
    if (opts.deadline && Date.now() > opts.deadline) break;
    const batch = movies.slice(i, i + 10);
    calls++;
    const facts = batch.map((m) => ({ title: m.title, year: m.year, overview: m.overview }));
    const ask = () =>
      runChain("emoji-puzzle", buildPrompt("emoji-puzzle", { movies: facts, count: batch.length, level: "family" }), (raw) => screenMoviePuzzles(raw, batch, stats), {
        allow: opts.allow,
        temperature: opts.temperature,
      });
    let result = await ask();
    // Free tiers limit tokens per minute (Groq answers 429 after a few big calls): wait once, then retry.
    if (!result && (!opts.deadline || Date.now() + RETRY_WAIT_MS + 8_000 < opts.deadline)) {
      await new Promise((r) => setTimeout(r, RETRY_WAIT_MS));
      calls++;
      result = await ask();
    }
    if (!result) continue;
    providers[result.provider] = (providers[result.provider] ?? 0) + 1;
    puzzles.push(...(result.data as EmojiPuzzle[]));
  }
  return { puzzles, stats, providers, calls };
}

/**
 * A Chor Kaun topic of real popular movies from one decade ("Bollywood movies: 2000s"), with no AI.
 * All the words are the same kind of thing, as the game needs. Returns null if every decade is taken.
 */
export async function movieChorTopic(langs: string, usedLabels: Set<string>, spread = false): Promise<Record<string, unknown> | null> {
  const movies = await popularIndianMovies(langs);
  const byDecade = new Map<string, TmdbMovie[]>();
  for (const m of movies) {
    if (!/^\d{4}$/.test(m.year)) continue;
    const d = `${m.year.slice(0, 3)}0s`;
    byDecade.set(d, [...(byDecade.get(d) ?? []), m]);
  }
  const cinema = cinemaName(langs);
  let options = [...byDecade.entries()]
    .filter(([, list]) => list.length >= 14)
    .map(([d, list]) => ({ label: `${cinema} movies: ${d}`, list }))
    .filter((o) => !usedLabels.has(normText(o.label)))
    .sort((a, b) => b.list.length - a.list.length);
  if (spread) options = options.sort(() => Math.random() - 0.5);
  const pick = options[0];
  if (!pick) return null;
  const words = (await resolveTitles(pick.list.slice(0, 22))).map((m) => m.title);
  const topic = validateChorTopic({ label: pick.label, emoji: "🎬", words });
  return topic ? { ...topic, source: "tmdb" } : null;
}

/** Library items for movie puzzles, tagged with the admin theme when there is one. */
export function movieItems(puzzles: EmojiPuzzle[], theme?: string): LibraryItem[] {
  return puzzles.map((p) => ({ category: "family", key: p.answer, data: { ...p } as Record<string, unknown>, ...(theme ? { theme } : {}) }));
}
