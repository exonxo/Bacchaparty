import { CHOR_TOPICS, type ChorTopic } from "@/content/chor-kaun";
import { EMOJI_PUZZLES, type EmojiPuzzle } from "@/content/emoji-picture";
import { GAMES } from "@/games/catalog";
import type { Level } from "@/lib/types";
import { pick, randomId, shuffle } from "@/lib/util";
import type { DareResult, NextGameResult, SuggestKind } from "./types";

const DARES: string[] = [
  "Everyone share their most embarrassing school memory in 30 seconds.",
  "Do your best Bollywood villain laugh — the room votes on the winner.",
  "Name three street foods you would queue an hour for.",
  "Hum the chorus of a song everyone here probably knows; no words allowed.",
  "Tell the group one harmless secret talent you have.",
  "Strike your best wedding-dance pose for five seconds.",
  "Say something nice about the person to your left (clockwise).",
  "If this party had a title card, what Bollywood-style name would it have?",
  "Imitate a famous dialogue in your funniest voice.",
  "Everyone rate today's snacks 1–10 and defend your score.",
  "Share the last meme that made you laugh out loud.",
  "Pretend you are a cricket commentator describing this room for 15 seconds.",
];

const EMOJI_CATEGORIES = ["Movie", "Food", "Place", "Festival", "Phrase", "Cartoon", "Sport", "Song"] as const;

function slugify(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return base || `topic-${randomId(6)}`;
}

export function fallbackChorTopic(excludeIds: string[] = [], avoid: string[] = []): ChorTopic {
  const shown = new Set(avoid.map((a) => a.toLowerCase()));
  const notShown = (t: ChorTopic) => !shown.has(`${t.label} remix`.toLowerCase()) && !shown.has(t.label.toLowerCase());
  const pool = CHOR_TOPICS.filter((t) => !excludeIds.includes(t.id) && notShown(t));
  const fresh = pool.length ? pool : CHOR_TOPICS.filter((t) => !excludeIds.includes(t.id));
  const source = fresh.length ? pick(fresh) : pick(CHOR_TOPICS);
  const words = shuffle([...source.words]).slice(0, Math.min(24, source.words.length));
  return {
    id: `fb-${slugify(source.label)}-${randomId(4)}`,
    label: `${source.label} remix`,
    emoji: source.emoji,
    words,
  };
}

export function fallbackEmojiPuzzles(level: Level = "family", count = 10, avoid: string[] = []): EmojiPuzzle[] {
  const levels: Level[] = level === "kids" ? ["kids"] : level === "family" ? ["kids", "family"] : ["family", "adults"];
  const shown = new Set(avoid.map((a) => a.toLowerCase()));
  const pool = EMOJI_PUZZLES.filter((p) => levels.includes(p.level));
  const fresh = pool.filter((p) => !shown.has(p.answer.toLowerCase()));
  // If the device has seen most of the pool, fall back to the whole pool rather than returning nothing.
  return shuffle(fresh.length >= count ? fresh : pool).slice(0, count);
}

export function fallbackNextGame(playerCount: number, played: string[] = []): NextGameResult {
  const playable = GAMES.filter((g) => playerCount >= g.minPlayers && playerCount <= g.maxPlayers);
  const fresh = playable.filter((g) => !played.includes(g.id));
  const pool = fresh.length ? fresh : playable;
  const game = pool.length ? pick(pool) : pick(GAMES);
  const allPlayed = playable.length > 0 && fresh.length === 0;
  const reasons = [
    `${game.players} — fits your group of ${playerCount}.`,
    `A ${game.category.toLowerCase()} round to mix things up.`,
    `${game.emoji} ${game.tagline}`,
    allPlayed
      ? "Time for a repeat favourite — everyone knows the rules now."
      : played.length
        ? "Something you have not played this party yet."
        : "A great opener for the night.",
  ];
  return { gameId: game.id, reason: pick(reasons) };
}

export function fallbackDare(): DareResult {
  return { text: pick(DARES) };
}

export function fallbackFor(kind: SuggestKind, context: Record<string, unknown>): unknown {
  switch (kind) {
    case "chor-kaun-topic":
      return fallbackChorTopic(
        Array.isArray(context.excludeTopicIds) ? (context.excludeTopicIds as string[]) : [],
        Array.isArray(context.avoid) ? (context.avoid as string[]) : [],
      );
    case "emoji-puzzle":
      return fallbackEmojiPuzzles(
        (context.level as Level | undefined) ?? "family",
        typeof context.count === "number" ? context.count : 10,
        Array.isArray(context.avoid) ? (context.avoid as string[]) : [],
      );
    case "next-game":
      return fallbackNextGame(
        typeof context.playerCount === "number" ? context.playerCount : 4,
        Array.isArray(context.gamesPlayed) ? (context.gamesPlayed as string[]) : [],
      );
    case "dare":
      return fallbackDare();
    case "kbc-question":
      // No built-in news: the game keeps its own question bank.
      return [];
    default:
      return null;
  }
}

export function isEmojiCategory(v: string): v is EmojiPuzzle["category"] {
  return (EMOJI_CATEGORIES as readonly string[]).includes(v);
}
