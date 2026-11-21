/**
 * Real, popular Indian movie titles from TMDB, so movie puzzles and movie Chor Kaun topics are about
 * films people know instead of titles the AI made up. Server only: the token never reaches a browser.
 *
 * Lists are cached (in memory and in Next's fetch cache) so TMDB is called a few times a day at most.
 * TMDB asks for attribution: see the privacy page ("Movie data from TMDB").
 */
import { isUnsafeSuggestText } from "./safety";

export interface TmdbMovie {
  id: number;
  /** The title people in India know: the original if it's in Latin letters, else the romanized one. */
  title: string;
  /** Other accepted answers: the English title, the part before a colon. */
  alt: string[];
  year: string;
  /** Short plot line, plain text only. It's passed to the AI as facts, never as instructions. */
  overview: string;
  lang: string;
  votes: number;
  /** TMDB's original title (may be in Devanagari). Used only to pick the title above. */
  original?: string;
}

/** Only films at least this many TMDB users rated: a proxy for "everyone has heard of it". */
export const TMDB_MIN_VOTES = 100;
const PAGES = 8;
const ALL_INDIAN = "hi|ta|te|ml|kn|bn|mr|pa|gu";
const CACHE_MS = 12 * 60 * 60 * 1000;
const API = "https://api.themoviedb.org/3";

export function tmdbConfigured(): boolean {
  return Boolean(process.env.TMDB_READ_TOKEN?.trim() || process.env.TMDB_API_KEY?.trim());
}

/** Is this admin theme about movies? Then titles come from TMDB. */
export function isMovieTheme(theme: string | undefined | null): boolean {
  return !!theme && /\b(movies?|films?|cinema|bollywood|tollywood|kollywood|mollywood|sandalwood)\b/i.test(theme);
}

/** Which original languages a movie theme means. Default: all the main Indian languages. */
export function languagesForTheme(theme: string | undefined | null): string {
  const t = (theme ?? "").toLowerCase();
  const pick: [RegExp, string][] = [
    [/bollywood|hindi/, "hi"],
    [/tamil|kollywood/, "ta"],
    [/telugu|tollywood/, "te"],
    [/malayalam|mollywood/, "ml"],
    [/kannada|sandalwood/, "kn"],
    [/bengali|bangla/, "bn"],
    [/marathi/, "mr"],
    [/punjabi/, "pa"],
    [/south indian/, "ta|te|ml|kn"],
  ];
  const langs = pick.filter(([re]) => re.test(t)).map(([, l]) => l);
  return langs.length ? [...new Set(langs.join("|").split("|"))].join("|") : ALL_INDIAN;
}

/** Short label for a set of languages, used in Chor Kaun topic names. */
export function cinemaName(langs: string): string {
  const names: Record<string, string> = { hi: "Bollywood", ta: "Tamil", te: "Telugu", ml: "Malayalam", kn: "Kannada", bn: "Bengali", mr: "Marathi", pa: "Punjabi" };
  return names[langs] ?? "Indian";
}

function auth(): { headers: Record<string, string>; query: string } {
  const token = process.env.TMDB_READ_TOKEN?.trim();
  if (token) return { headers: { authorization: `Bearer ${token}`, accept: "application/json" }, query: "" };
  return { headers: { accept: "application/json" }, query: `api_key=${encodeURIComponent(process.env.TMDB_API_KEY?.trim() ?? "")}&` };
}

async function tmdbGet(path: string, params: string, revalidate: number): Promise<unknown | null> {
  const a = auth();
  try {
    const res = await fetch(`${API}${path}?${a.query}${params}`, {
      headers: a.headers,
      signal: AbortSignal.timeout(5000),
      next: { revalidate },
    } as RequestInit);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const LATIN = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}\p{S}]+$/u;

/** Plain text only, short, no line breaks or quote marks that could look like prompt structure. */
export function cleanOverview(s: unknown): string {
  if (typeof s !== "string") return "";
  const t = s.normalize("NFKC").replace(/[\r\n\t"`<>{}[\]\\]/g, " ").replace(/\s+/g, " ").trim();
  if (t.length <= 160) return t;
  const cut = t.slice(0, 160);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 100))}…`;
}

function cleanTitle(s: unknown): string {
  return typeof s === "string" ? s.normalize("NFKC").replace(/\s+/g, " ").trim() : "";
}

interface RawMovie {
  id: number;
  title?: string;
  original_title?: string;
  original_language?: string;
  release_date?: string;
  overview?: string;
  vote_count?: number;
  adult?: boolean;
}

const listCache = new Map<string, { at: number; movies: TmdbMovie[] }>();

/**
 * The most-rated movies in these languages, most-rated first. Titles here are TMDB's English or
 * original title; call `resolveTitles` on the ones you use to get the name people say.
 */
export async function popularIndianMovies(langs: string = ALL_INDIAN, minVotes = TMDB_MIN_VOTES): Promise<TmdbMovie[]> {
  if (!tmdbConfigured()) return [];
  const key = `${langs}|${minVotes}`;
  const hit = listCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.movies;
  const params = (page: number) =>
    `include_adult=false&language=en-US&sort_by=vote_count.desc&with_origin_country=IN&with_original_language=${encodeURIComponent(langs)}&vote_count.gte=${minVotes}&page=${page}`;
  const pages = await Promise.all(Array.from({ length: PAGES }, (_, i) => tmdbGet("/discover/movie", params(i + 1), 86400)));
  const seen = new Set<number>();
  const movies: TmdbMovie[] = [];
  for (const p of pages) {
    const results = (p as { results?: RawMovie[] } | null)?.results ?? [];
    for (const m of results) {
      if (!m || typeof m.id !== "number" || m.adult || seen.has(m.id)) continue;
      const english = cleanTitle(m.title);
      const original = cleanTitle(m.original_title);
      const title = original && LATIN.test(original) ? original : english;
      if (!title || title.length > 60 || title.split(" ").length > 8 || isUnsafeSuggestText(title, { level: "family" })) continue;
      seen.add(m.id);
      movies.push({
        id: m.id,
        title,
        alt: english && english !== title ? [english] : [],
        year: (m.release_date ?? "").slice(0, 4),
        overview: cleanOverview(m.overview),
        lang: m.original_language ?? "",
        votes: m.vote_count ?? 0,
        original,
      });
    }
  }
  movies.sort((a, b) => b.votes - a.votes);
  if (movies.length) listCache.set(key, { at: Date.now(), movies });
  return movies;
}

/**
 * TMDB's English title is often a translation ("Like Stars on Earth" for तारे ज़मीन पर). For films with
 * a Devanagari original, compare each Latin candidate (the English title, the alternative titles,
 * the part before a colon) with the sound of the original and keep the closest: "Taare Zameen Par".
 * If nothing sounds like it, the English title stays. Other scripts keep TMDB's English title,
 * which for South Indian hits is usually already the romanized one (RRR, Pushpa).
 */
export async function resolveTitles(movies: TmdbMovie[]): Promise<TmdbMovie[]> {
  const out: TmdbMovie[] = [];
  for (let i = 0; i < movies.length; i += 8) {
    const chunk = movies.slice(i, i + 8);
    out.push(...(await Promise.all(chunk.map(resolveOne))));
  }
  return out;
}

async function resolveOne(m: TmdbMovie): Promise<TmdbMovie> {
  const target = m.original && DEVANAGARI.test(m.original) ? skeleton(devanagariToLatin(m.original)) : "";
  const fromAlts: string[] = [];
  if (target) {
    const alts = (await tmdbGet(`/movie/${m.id}/alternative_titles`, "", 7 * 86400)) as { titles?: { title?: string }[] } | null;
    for (const t of alts?.titles ?? []) fromAlts.push(cleanTitle(t.title));
  }
  const candidates = [m.title, ...m.alt, ...fromAlts]
    .flatMap((t) => (t.includes(":") ? [t, t.split(":")[0].trim()] : [t]))
    .filter((t) => t && LATIN.test(t) && t.length >= 2 && t.length <= 60 && t.split(" ").length <= 8 && !/^[A-Z0-9]{2,4}$/.test(t));
  let title = m.title;
  if (target) {
    // TMDB's own title wins unless another one is clearly closer to how the original sounds.
    let best = similarity(skeleton(m.title), target);
    const own = best;
    for (const c of candidates) {
      const score = similarity(skeleton(c), target);
      if (score > best + 0.1 || (title !== m.title && score > best)) {
        best = score;
        title = c;
      }
    }
    if (best < 0.7 && own < 0.7) title = m.title;
  }
  const alt = new Set([m.title, ...m.alt].filter((a) => a && a !== title));
  for (const t of [title, ...alt]) if (t.includes(":")) alt.add(t.split(":")[0].trim());
  // "Bāhubali" is also accepted typed as "Bahubali".
  for (const t of [title, ...alt]) {
    const plain = t.normalize("NFD").replace(/\p{M}/gu, "");
    if (plain !== t) alt.add(plain);
  }
  alt.delete(title);
  return { ...m, title, alt: [...alt].filter((a) => a.length >= 2).slice(0, 4) };
}

const DEVANAGARI = /[\u0900-\u097F]/;
const DEV_CONSONANTS: Record<string, string> = {
  क: "k", ख: "k", ग: "g", घ: "g", ङ: "n", च: "c", छ: "c", ज: "j", झ: "j", ञ: "n", ट: "t", ठ: "t", ड: "d", ढ: "d", ण: "n",
  त: "t", थ: "t", द: "d", ध: "d", न: "n", प: "p", फ: "p", ब: "b", भ: "b", म: "m", य: "y", र: "r", ल: "l", व: "v", श: "s",
  ष: "s", स: "s", ह: "", ळ: "l", "ं": "n", "ँ": "n",
  अ: "", आ: "", इ: "", ई: "", उ: "", ऊ: "", ए: "", ऐ: "", ओ: "", औ: "", ऋ: "r",
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

/** Rough consonant transliteration of Devanagari (vowel signs dropped): "तारे ज़मीन पर" → "tr jmn pr". */
export function devanagariToLatin(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFD")) {
    if (ch in DEV_CONSONANTS) out += DEV_CONSONANTS[ch];
    else if (/\s/.test(ch)) out += " ";
    else if (/[A-Za-z0-9]/.test(ch)) out += ch.toLowerCase();
  }
  return out;
}

/** Consonants only, with spellings that sound alike folded together. */
export function skeleton(s: string): string {
  return s
    .toLowerCase()
    .replace(/ph/g, "p")
    .replace(/[^a-z0-9]/g, "")
    .replace(/[aeiouh]/g, "")
    .replace(/w/g, "v")
    .replace(/z/g, "j")
    .replace(/f/g, "p")
    .replace(/q/g, "k")
    .replace(/x/g, "ks")
    .replace(/(.)\1+/g, "$1");
}

/** 1 = same letters in the same order; 0 = nothing in common. */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return (2 * dp[a.length][b.length]) / (a.length + b.length);
}

/** Test hook: forget cached lists. */
export function clearTmdbCache(): void {
  listCache.clear();
}
