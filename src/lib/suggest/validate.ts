import { CHOR_TOPICS, type ChorTopic } from "@/content/chor-kaun";
import { GAMES } from "@/games/catalog";
import type { EmojiPuzzle } from "@/content/emoji-picture";
import type { KbcNews, KbcQuestion } from "@/content/kbc";
import type { Level } from "@/lib/types";
import { randomId } from "@/lib/util";
import { fallbackEmojiPuzzles, isEmojiCategory } from "./fallbacks";
import { isUnsafeSuggestText, type SafetyContext } from "./safety";
import type { DareResult, NextGameResult, SuggestKind } from "./types";

const LEVELS: Level[] = ["kids", "family", "adults"];
const BUILTIN_CHOR_IDS = new Set(CHOR_TOPICS.map((t) => t.id));

export function isGlued(w: string): boolean {
  return w.length >= 9 && /^\p{Lu}\p{Ll}+\p{Lu}\p{Ll}+$/u.test(w);
}

function cleanWords(words: unknown, safety: SafetyContext): string[] | null {
  if (!Array.isArray(words)) return null;
  const out = [
    ...new Set(
      words
        .map((w) => String(w).trim())
        // Two words glued together ("BakeryOwner", "GaneshPooja") are model slips: drop them.
        // Short brand names written that way (PhonePe, WhatsApp) are kept.
        .filter((w) => w.length >= 2 && w.length <= 48 && !isGlued(w) && !isUnsafeSuggestText(w, safety)),
    ),
  ];
  return out.length >= 12 ? out.slice(0, 36) : null;
}

function uniqueChorId(proposed: string): string {
  const base = proposed.slice(0, 36);
  if (!BUILTIN_CHOR_IDS.has(base)) return base;
  return `ai-${base}-${randomId(4)}`.slice(0, 40);
}

export function validateChorTopic(raw: unknown): ChorTopic | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const safety: SafetyContext = { level: "family" };
  // The label is the topic ("Kitchen"), not the game: words like "Impostor" are removed.
  const labelRaw =
    typeof o.label === "string"
      ? o.label.replace(/\b(impostors?|imposters?|spotting|chor kaun)\b/gi, " ").replace(/\s+/g, " ").trim().slice(0, 40)
      : "";
  if (!labelRaw || isUnsafeSuggestText(labelRaw, safety)) return null;
  const emoji = typeof o.emoji === "string" ? o.emoji.trim().slice(0, 8) : "✨";
  const idRaw = typeof o.id === "string" ? o.id.trim() : "";
  const slug = (idRaw || labelRaw.toLowerCase().replace(/[^a-z0-9]+/g, "-")).replace(/^-|-$/g, "").slice(0, 40);
  const id = uniqueChorId(slug);
  const words = cleanWords(o.words, safety);
  if (!id || !words) return null;
  return { id, label: labelRaw, emoji: emoji || "✨", words };
}

function puzzleKey(p: EmojiPuzzle): string {
  return `${p.emojis}|${p.answer.toLowerCase()}`;
}

function levelAllowed(requested: Level, itemLevel: Level): boolean {
  if (requested === "kids") return itemLevel === "kids";
  if (requested === "family") return itemLevel === "kids" || itemLevel === "family";
  return true;
}

/** Keycaps (1️⃣, #️⃣) count as emoji; plain letters and digits don't. */
const KEYCAP = /[0-9#*]\uFE0F?\u20E3/gu;
const EMOJI_PARTS = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}\uFE0F\uFE0E\u200D\u20E3\s]/gu;

/** True when the string is only emoji (2 to 8 of them), with no letters, digits or punctuation. */
export function isEmojiOnly(s: string): boolean {
  const keycapsAsStar = s.replace(KEYCAP, "⭐");
  if (keycapsAsStar.replace(EMOJI_PARTS, "") !== "") return false;
  const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const count = [...seg.segment(keycapsAsStar)].filter((g) => g.segment.trim() !== "").length;
  return count >= 2 && count <= 8;
}

export type PuzzleReject = "shape" | "emojis" | "answer" | "hint" | "category" | "level" | "unsafe" | "duplicate";

/** Checks one puzzle. Returns the cleaned puzzle, or the reason it was refused. */
export function checkPuzzle(item: unknown, requestedLevel: Level, requiredCategory?: string): EmojiPuzzle | PuzzleReject {
  if (!item || typeof item !== "object") return "shape";
  const p = item as Record<string, unknown>;
  const safety: SafetyContext = { level: requestedLevel };
  const emojis = typeof p.emojis === "string" ? p.emojis.trim() : "";
  const answer = typeof p.answer === "string" ? p.answer.trim().replace(/\s+/g, " ") : "";
  const hint = typeof p.hint === "string" ? p.hint.trim().slice(0, 120) : "";
  const category = typeof p.category === "string" ? p.category : "";
  const level = typeof p.level === "string" ? p.level : "family";
  if (!emojis || emojis.length > 48 || !isEmojiOnly(emojis)) return "emojis";
  if (!answer || answer.length > 60 || answer.split(" ").length > 8 || !/[\p{L}\p{N}]/u.test(answer)) return "answer";
  if (!hint || (answer.length >= 4 && hint.toLowerCase().includes(answer.toLowerCase()))) return "hint";
  if (!isEmojiCategory(category) || (requiredCategory && category !== requiredCategory)) return "category";
  if (!LEVELS.includes(level as Level) || !levelAllowed(requestedLevel, level as Level)) return "level";
  if (isUnsafeSuggestText(emojis, safety) || isUnsafeSuggestText(answer, safety) || isUnsafeSuggestText(hint, safety)) return "unsafe";
  const alt = Array.isArray(p.alt)
    ? p.alt.map((a) => String(a).trim()).filter((a) => a && a.length <= 60 && !isUnsafeSuggestText(a, safety)).slice(0, 6)
    : undefined;
  return { emojis, category, answer, hint, level: level as Level, ...(alt?.length ? { alt } : {}) };
}

/**
 * Admin screening: every puzzle the AI returned is checked; nothing is padded with built-in puzzles.
 * Returns the puzzles kept and how many were refused, by reason.
 */
export function screenEmojiPuzzles(raw: unknown, opts: { level: Level; category?: string; limit?: number }) {
  const list = Array.isArray(raw) ? raw : [];
  const kept: EmojiPuzzle[] = [];
  const reasons: Partial<Record<PuzzleReject | "extra", number>> = {};
  const seen = new Set<string>();
  for (const item of list) {
    let r = checkPuzzle(item, opts.level, opts.category);
    if (typeof r !== "string") {
      const key = r.answer.toLowerCase();
      if (seen.has(key)) r = "duplicate";
      else seen.add(key);
    }
    if (typeof r === "string") reasons[r] = (reasons[r] ?? 0) + 1;
    else if (kept.length < (opts.limit ?? 50)) kept.push(r);
    else reasons.extra = (reasons.extra ?? 0) + 1;
  }
  return { made: list.length, kept, rejected: list.length - kept.length, reasons };
}

export function validateEmojiPuzzles(raw: unknown, count: number, requestedLevel: Level = "family"): EmojiPuzzle[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: EmojiPuzzle[] = [];

  for (const item of raw) {
    const puzzle = checkPuzzle(item, requestedLevel);
    if (typeof puzzle === "string") continue;
    const key = puzzleKey(puzzle);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(puzzle);
    if (out.length >= count) break;
  }

  if (out.length < count) {
    const extra = fallbackEmojiPuzzles(requestedLevel, count * 2).filter((p) => {
      const key = puzzleKey(p);
      return !seen.has(key) && levelAllowed(requestedLevel, p.level);
    });
    for (const p of extra) {
      const key = puzzleKey(p);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
      if (out.length >= count) break;
    }
  }

  const minNeeded = Math.min(3, count);
  return out.length >= minNeeded ? out.slice(0, count) : null;
}

export function validateNextGame(raw: unknown, playerCount: number): NextGameResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const gameId = typeof o.gameId === "string" ? o.gameId.trim() : "";
  const reason = typeof o.reason === "string" ? o.reason.trim().slice(0, 200) : "";
  const game = GAMES.find((g) => g.id === gameId);
  if (!gameId || !reason || !game) return null;
  if (playerCount < game.minPlayers || playerCount > game.maxPlayers) return null;
  if (isUnsafeSuggestText(reason, { level: "family" })) return null;
  return { gameId, reason };
}

export function validateDare(raw: unknown): DareResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const text = typeof o.text === "string" ? o.text.trim().slice(0, 280) : "";
  if (text.length < 8) return null;
  if (isUnsafeSuggestText(text, { level: "family", audience: "family" })) return null;
  return { text };
}

/** A news question for Kaun Banega Champion: 4 distinct options, 1 correct, with its source. */
export type KbcLibraryQuestion = KbcQuestion & { level: "family" | "adults"; category?: string };

const KBC_CATEGORIES = ["Sports", "Entertainment", "Science", "Business", "India", "World", "Culture", "Environment"];

export function validateKbcQuestion(raw: unknown): KbcLibraryQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const safety: SafetyContext = { level: "family" };
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.normalize("NFKC").replace(/\s+/g, " ").trim() : "").slice(0, max + 1);
  const q = text(o.q, 220);
  const a = text(o.a, 80);
  const w = Array.isArray(o.w) ? o.w.map((x) => text(x, 80)) : [];
  if (q.length < 12 || q.length > 220 || !q.endsWith("?")) return null;
  if (!a || a.length > 80 || w.length !== 3 || w.some((x) => !x || x.length > 80)) return null;
  const all = [a, ...w].map((x) => x.toLowerCase());
  if (new Set(all).size !== 4) return null;
  if ([q, a, ...w].some((x) => isUnsafeSuggestText(x, safety))) return null;
  const step = Math.round(Number(o.step));
  if (!(step >= 1 && step <= 10)) return null;
  const level = o.level === "adults" ? "adults" : o.level === "family" || o.level == null ? "family" : null;
  if (!level) return null;
  const n = (o.news ?? {}) as Record<string, unknown>;
  const source = n.source === "newsapi" || n.source === "bharat" ? n.source : null;
  const headline = text(n.headline, 240);
  const date = typeof n.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(n.date) ? n.date : "";
  if (!source || !headline || headline.length > 240 || !date) return null;
  const url = typeof n.url === "string" && /^https:\/\/[^\s"<>]{4,400}$/.test(n.url) ? n.url : undefined;
  const outlet = text(n.outlet, 60) || undefined;
  const news: KbcNews = { source, headline, date, ...(url ? { url } : {}), ...(outlet ? { outlet } : {}) };
  const category = typeof o.category === "string" && KBC_CATEGORIES.includes(o.category) ? o.category : undefined;
  return { q, a, w: [w[0], w[1], w[2]], step, level, news, ...(category ? { category } : {}) };
}

export function validateKbcQuestions(raw: unknown, max = 10): KbcLibraryQuestion[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: KbcLibraryQuestion[] = [];
  for (const r of raw) {
    const v = validateKbcQuestion(r);
    if (!v || seen.has(v.q.toLowerCase())) continue;
    seen.add(v.q.toLowerCase());
    out.push(v);
    if (out.length >= max) break;
  }
  return out.length ? out : null;
}

export function validateGeminiPayload(
  kind: SuggestKind,
  raw: unknown,
  contextCount?: number,
  playerCount?: number,
  requestedLevel?: Level,
): unknown | null {
  switch (kind) {
    case "chor-kaun-topic":
      return validateChorTopic(raw);
    case "emoji-puzzle":
      return validateEmojiPuzzles(raw, contextCount ?? 10, requestedLevel ?? "family");
    case "next-game":
      return validateNextGame(raw, playerCount ?? 4);
    case "dare":
      return validateDare(raw);
    case "kbc-question":
      return validateKbcQuestions(raw, contextCount ?? 10);
    default:
      return null;
  }
}
