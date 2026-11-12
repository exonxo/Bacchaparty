import { CHOR_TOPICS, type ChorTopic } from "@/content/chor-kaun";
import { GAMES } from "@/games/catalog";
import type { EmojiPuzzle } from "@/content/emoji-picture";
import type { Level } from "@/lib/types";
import { randomId } from "@/lib/util";
import { fallbackEmojiPuzzles, isEmojiCategory } from "./fallbacks";
import { isUnsafeSuggestText, type SafetyContext } from "./safety";
import type { DareResult, NextGameResult, SuggestKind } from "./types";

const LEVELS: Level[] = ["kids", "family", "adults"];
const BUILTIN_CHOR_IDS = new Set(CHOR_TOPICS.map((t) => t.id));

function cleanWords(words: unknown, safety: SafetyContext): string[] | null {
  if (!Array.isArray(words)) return null;
  const out = [
    ...new Set(
      words
        .map((w) => String(w).trim())
        .filter((w) => w.length >= 2 && w.length <= 48 && !isUnsafeSuggestText(w, safety)),
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
  const labelRaw = typeof o.label === "string" ? o.label.trim().slice(0, 40) : "";
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

export function validateEmojiPuzzles(raw: unknown, count: number, requestedLevel: Level = "family"): EmojiPuzzle[] | null {
  if (!Array.isArray(raw)) return null;
  const safety: SafetyContext = { level: requestedLevel };
  const seen = new Set<string>();
  const out: EmojiPuzzle[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const emojis = typeof p.emojis === "string" ? p.emojis.trim().slice(0, 32) : "";
    const answer = typeof p.answer === "string" ? p.answer.trim().slice(0, 80) : "";
    const hint = typeof p.hint === "string" ? p.hint.trim().slice(0, 120) : "";
    const category = typeof p.category === "string" ? p.category : "";
    const level = typeof p.level === "string" ? p.level : "family";
    if (
      !emojis ||
      !answer ||
      !hint ||
      !isEmojiCategory(category) ||
      !LEVELS.includes(level as Level) ||
      !levelAllowed(requestedLevel, level as Level)
    ) {
      continue;
    }
    if (isUnsafeSuggestText(emojis, safety) || isUnsafeSuggestText(answer, safety) || isUnsafeSuggestText(hint, safety)) {
      continue;
    }
    const alt = Array.isArray(p.alt)
      ? p.alt.map((a) => String(a).trim()).filter((a) => a && !isUnsafeSuggestText(a, safety)).slice(0, 6)
      : undefined;
    const puzzle: EmojiPuzzle = {
      emojis,
      category,
      answer,
      hint,
      level: level as Level,
      ...(alt?.length ? { alt } : {}),
    };
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
    default:
      return null;
  }
}
