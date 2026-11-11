import { GAMES } from "@/games/catalog";
import type { EmojiPuzzle } from "@/content/emoji-picture";
import type { ChorTopic } from "@/content/chor-kaun";
import type { Level } from "@/lib/types";
import { isEmojiCategory } from "./fallbacks";
import type { DareResult, NextGameResult, SuggestKind } from "./types";

const LEVELS: Level[] = ["kids", "family", "adults"];

function cleanWords(words: unknown): string[] | null {
  if (!Array.isArray(words)) return null;
  const out = [...new Set(words.map((w) => String(w).trim()).filter((w) => w.length >= 2 && w.length <= 48))];
  return out.length >= 12 ? out.slice(0, 36) : null;
}

export function validateChorTopic(raw: unknown): ChorTopic | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === "string" ? o.label.trim().slice(0, 40) : "";
  const emoji = typeof o.emoji === "string" ? o.emoji.trim().slice(0, 8) : "✨";
  const idRaw = typeof o.id === "string" ? o.id.trim() : "";
  const id = (idRaw || label.toLowerCase().replace(/[^a-z0-9]+/g, "-")).replace(/^-|-$/g, "").slice(0, 40);
  const words = cleanWords(o.words);
  if (!label || !id || !words) return null;
  return { id, label, emoji: emoji || "✨", words };
}

export function validateEmojiPuzzles(raw: unknown, count: number): EmojiPuzzle[] | null {
  if (!Array.isArray(raw) || raw.length < Math.min(3, count)) return null;
  const out: EmojiPuzzle[] = [];
  for (const item of raw.slice(0, count + 2)) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const emojis = typeof p.emojis === "string" ? p.emojis.trim().slice(0, 32) : "";
    const answer = typeof p.answer === "string" ? p.answer.trim().slice(0, 80) : "";
    const hint = typeof p.hint === "string" ? p.hint.trim().slice(0, 120) : "";
    const category = typeof p.category === "string" ? p.category : "";
    const level = typeof p.level === "string" ? p.level : "family";
    if (!emojis || !answer || !hint || !isEmojiCategory(category) || !LEVELS.includes(level as Level)) continue;
    const alt = Array.isArray(p.alt)
      ? p.alt.map((a) => String(a).trim()).filter(Boolean).slice(0, 6)
      : undefined;
    out.push({ emojis, category, answer, hint, level: level as Level, ...(alt?.length ? { alt } : {}) });
    if (out.length >= count) break;
  }
  return out.length >= Math.min(3, count) ? out : null;
}

export function validateNextGame(raw: unknown): NextGameResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const gameId = typeof o.gameId === "string" ? o.gameId.trim() : "";
  const reason = typeof o.reason === "string" ? o.reason.trim().slice(0, 200) : "";
  if (!gameId || !reason || !GAMES.some((g) => g.id === gameId)) return null;
  return { gameId, reason };
}

export function validateDare(raw: unknown): DareResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const text = typeof o.text === "string" ? o.text.trim().slice(0, 280) : "";
  if (text.length < 8) return null;
  const lower = text.toLowerCase();
  const blocked = ["explicit", "nude", "sex", "alcohol", "drunk", "drug"];
  if (blocked.some((w) => lower.includes(w))) return null;
  return { text };
}

export function validateGeminiPayload(kind: SuggestKind, raw: unknown, contextCount?: number): unknown | null {
  switch (kind) {
    case "chor-kaun-topic":
      return validateChorTopic(raw);
    case "emoji-puzzle":
      return validateEmojiPuzzles(raw, contextCount ?? 10);
    case "next-game":
      return validateNextGame(raw);
    case "dare":
      return validateDare(raw);
    default:
      return null;
  }
}
