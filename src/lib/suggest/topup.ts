/**
 * Weekly library top-up, so nobody has to fill the library by hand. It runs from the existing nightly
 * purge cron (no new cron entry): after the purge, if the last finished top-up is 7 or more days old.
 * The admin "Run top-up now" button runs it straight away.
 *
 * One run: about 40 popular Indian movies from TMDB not yet in the library → AI emoji for each → only
 * puzzles that pass validation and match a TMDB title are saved. Plus a few Chor Kaun topics (about a
 * third real movie titles, the rest AI non-movie topics), a couple of dares and about 10 KBC news
 * questions (see news.ts).
 * It stops starting new work near the time budget. A run that kept fewer than 20 puzzles is not
 * "done", so the next night tries again: the work spreads over days if the AI is slow or down.
 */
import { flagMap } from "../admin/flags";
import { logEvent } from "../admin/events";
import { getServiceClient } from "../supabase/service";
import { runChain } from "./chain";
import { itemsFrom, normText, saveToLibrary, type LibraryItem } from "./library";
import { chorMovieShare, libraryTexts, movieChorTopic, movieItems, moviePuzzles, newStats, pickMovies } from "./movies";
import { buildPrompt } from "./prompts";
import { tmdbConfigured } from "./tmdb";
import { validateGeminiPayload } from "./validate";
import { makeNewsQuestions, saveNews, type NewsStats } from "./news";

export const TOPUP_EVERY_DAYS = 7;
export const TOPUP_MOVIES = 40;
/** A run that keeps at least this many emoji puzzles counts as done for the week. */
export const TOPUP_TARGET_MIN = 20;
export const TOPUP_CHOR = 3;
export const TOPUP_DARES = 2;
/** KBC news questions per run; the news step runs last, in the time kept back for it. */
export const TOPUP_NEWS = 10;
/** Time kept back from the emoji step for the news step. */
const NEWS_RESERVE_MS = 15_000;
const ALL_LANGS = "hi|ta|te|ml|kn|bn|mr|pa|gu";
const CHOR_THEMES = ["Indian food", "Festivals", "Places in India", "Cricket", "Indian sweets", "Street food", "Indian states", "Kitchen items", "Wedding rituals", "Indian trains"];
const DARE_THEMES = ["Family party", "Diwali night", "Wedding season", "Road trip", "Cricket match night", "Monsoon evening"];
const TEMPERATURE = 0.7;

export interface TopupResult {
  ok: boolean;
  skipped?: string;
  trigger: "cron" | "admin";
  done: boolean;
  made: number;
  kept: number;
  rejected: number;
  stored: number;
  emoji: { movies: number; made: number; kept: number; rejected: number; stored: number; reasons: Record<string, number> };
  chor: { movie: number; ai: number; kept: number; stored: number };
  dare: { kept: number; stored: number };
  news: { sources?: NewsStats["sources"]; fetched: number; made: number; kept: number; rejected: number; stored: number; reasons: Record<string, number> };
  providers: Record<string, number>;
  /** Why Chor Kaun / dare calls produced nothing ("no_answer": every AI service failed or was refused). */
  otherReasons?: Record<string, number>;
  ms: number;
}

/** Due when no finished top-up is recorded in the last 7 days. */
export async function topupDue(now = Date.now()): Promise<boolean> {
  const db = getServiceClient();
  if (!db) return false;
  const { data, error } = await db.from("cron_runs").select("ran_at").eq("job", "topup").eq("ok", true).eq("detail->>done", "true").order("ran_at", { ascending: false }).limit(1);
  if (error) return false;
  const last = data?.[0]?.ran_at ? Date.parse(String(data[0].ran_at)) : 0;
  return !last || now - last >= TOPUP_EVERY_DAYS * 86400_000;
}

/** Last top-up (finished or not), for the admin panel. */
export async function lastTopup(): Promise<{ ranAt: string; ok: boolean; detail: Record<string, unknown> } | null> {
  const db = getServiceClient();
  if (!db) return null;
  const { data } = await db.from("cron_runs").select("ran_at, ok, detail").eq("job", "topup").order("ran_at", { ascending: false }).limit(1);
  const r = data?.[0];
  return r ? { ranAt: String(r.ran_at), ok: !!r.ok, detail: (r.detail ?? {}) as Record<string, unknown> } : null;
}

const week = (now: number) => Math.floor(now / (7 * 86400_000));

export async function runTopup(trigger: "cron" | "admin", budgetMs = 45_000): Promise<TopupResult> {
  const start = Date.now();
  const deadline = start + budgetMs;
  const left = () => deadline - Date.now();
  const res: TopupResult = {
    ok: true,
    trigger,
    done: false,
    made: 0,
    kept: 0,
    rejected: 0,
    stored: 0,
    emoji: { movies: 0, made: 0, kept: 0, rejected: 0, stored: 0, reasons: {} },
    chor: { movie: 0, ai: 0, kept: 0, stored: 0 },
    dare: { kept: 0, stored: 0 },
    news: { fetched: 0, made: 0, kept: 0, rejected: 0, stored: 0, reasons: {} },
    providers: {},
    ms: 0,
  };
  const flags = await flagMap(true);
  if (flags["suggest"] === false || flags["library"] === false) res.skipped = "switched_off";
  else if (!getServiceClient()) res.skipped = "database_not_configured";
  else if (!tmdbConfigured()) res.skipped = "tmdb_not_configured";
  if (res.skipped) return record({ ...res, ok: false }, start);
  const allow = (name: string) => flags[`llm:${name}`] !== false;
  const addProviders = (p: Record<string, number>) => {
    for (const [k, v] of Object.entries(p)) res.providers[k] = (res.providers[k] ?? 0) + v;
  };

  // Small calls first (Chor Kaun, dares), then the big emoji batches, so a per-minute token limit
  // hits the part that retries and carries over to the next night.
  // 1. Chor Kaun: about a third real movie titles (no AI), the rest AI topics on non-movie themes.
  const movieTopics = Math.round(TOPUP_CHOR * chorMovieShare());
  const labels = await libraryTexts("chor-kaun-topic");
  const chorItems: LibraryItem[] = [];
  for (let i = 0; i < movieTopics && left() > 3_000; i++) {
    const t = await movieChorTopic(i % 2 ? ALL_LANGS : "hi", labels);
    if (!t) break;
    labels.add(normText(String(t.label)));
    chorItems.push({ category: "any", key: String(t.label), data: t });
    res.chor.movie++;
  }
  const stats = newStats();
  for (let i = 0; i < TOPUP_CHOR - movieTopics && left() > 10_000; i++) {
    const theme = CHOR_THEMES[(week(start) * 2 + i) % CHOR_THEMES.length];
    const context = { theme, avoid: [...labels].slice(-40), excludeTopicIds: [] };
    stats.made++;
    const r = await runChain("chor-kaun-topic", buildPrompt("chor-kaun-topic", context), (raw) => validateGeminiPayload("chor-kaun-topic", raw), { allow, temperature: TEMPERATURE });
    if (!r) {
      stats.rejected++;
      stats.reasons.no_answer = (stats.reasons.no_answer ?? 0) + 1;
      continue;
    }
    addProviders({ [r.provider]: 1 });
    for (const item of itemsFrom("chor-kaun-topic", r.data, context)) {
      if (labels.has(normText(item.key))) continue;
      labels.add(normText(item.key));
      chorItems.push(item);
      res.chor.ai++;
    }
  }
  res.chor.kept = chorItems.length;
  res.chor.stored = chorItems.length ? ((await saveToLibrary("chor-kaun-topic", chorItems, "cron:mixed")) ?? 0) : 0;

  // 2. A couple of dares.
  const dareItems: LibraryItem[] = [];
  for (let i = 0; i < TOPUP_DARES && left() > 10_000; i++) {
    const context = { theme: DARE_THEMES[(week(start) + i) % DARE_THEMES.length], audience: "family", avoid: [] };
    stats.made++;
    const r = await runChain("dare", buildPrompt("dare", context), (raw) => validateGeminiPayload("dare", raw), { allow, temperature: TEMPERATURE });
    if (!r) {
      stats.rejected++;
      stats.reasons.no_answer = (stats.reasons.no_answer ?? 0) + 1;
      continue;
    }
    addProviders({ [r.provider]: 1 });
    dareItems.push(...itemsFrom("dare", r.data, context));
  }
  res.dare.kept = dareItems.length;
  res.dare.stored = dareItems.length ? ((await saveToLibrary("dare", dareItems, "cron:llm")) ?? 0) : 0;

  // 3. Emoji puzzles for movies not yet in the library, most-rated first. The main job, so it goes
  // before news; it stops starting batches early enough to leave the news step its time.
  const movies = await pickMovies(ALL_LANGS, TOPUP_MOVIES, await libraryTexts("emoji-puzzle"));
  res.emoji.movies = movies.length;
  if (movies.length) {
    // No new batch starts in the last 8 s + the news reserve, so the last one (up to 8 s) ends in time.
    const r = await moviePuzzles(movies, { allow, temperature: TEMPERATURE, deadline: deadline - 8_000 - NEWS_RESERVE_MS });
    addProviders(r.providers);
    const stored = r.puzzles.length ? await saveToLibrary("emoji-puzzle", movieItems(r.puzzles), "cron:tmdb:llm") : 0;
    res.emoji = { movies: movies.length, made: r.stats.made, kept: r.puzzles.length, rejected: r.stats.rejected, reasons: r.stats.reasons, stored: stored ?? 0 };
  }
  // 4. KBC news questions: fetched only here and from the admin button, never during a game. A write
  // call and a check call (up to 8 s each) can follow the last start, so starts stop 16 s before the end.
  if (left() > 12_000) {
    const n = await makeNewsQuestions({ want: TOPUP_NEWS, allow, deadline: deadline - 16_000, maxBatches: 2 });
    addProviders(n.stats.providers);
    const stored = n.items.length ? await saveNews(n.items, (items, source) => saveToLibrary("kbc-question", items, source)) : 0;
    res.news = { sources: n.stats.sources, fetched: n.stats.fetched, made: n.stats.made, kept: n.items.length, rejected: n.stats.rejected, stored: stored ?? 0, reasons: n.stats.reasons };
  }

  // Done for the week once enough were kept, or when TMDB has nothing new left to give.
  res.done = res.emoji.kept >= TOPUP_TARGET_MIN || movies.length === 0;

  res.made = res.emoji.made + res.chor.movie + stats.made + res.news.made;
  res.kept = res.emoji.kept + res.chor.kept + res.dare.kept + res.news.kept;
  res.rejected = res.emoji.rejected + stats.rejected + res.news.rejected;
  res.otherReasons = stats.reasons;
  res.stored = res.emoji.stored + res.chor.stored + res.dare.stored + res.news.stored;
  return record(res, start);
}

/** Saves the run in cron_runs (the "last top-up" the panel shows and the 7-day check reads) and app_events. */
async function record(res: TopupResult, start: number): Promise<TopupResult> {
  res.ms = Date.now() - start;
  const db = getServiceClient();
  const { ok, ...detail } = res;
  if (db) await db.from("cron_runs").insert({ job: "topup", ok, detail }).then(() => undefined, () => undefined);
  await logEvent("cron_run", { job: "topup", trigger: res.trigger, ok, done: res.done, made: res.made, kept: res.kept, rejected: res.rejected, stored: res.stored, skipped: res.skipped ?? null });
  return res;
}
