import { GAMES } from "@/games/catalog";
import type { SuggestKind } from "./types";
import { isBottleTone } from "@/content/spin-bottle";
import { buildBottlePrompt } from "./bottle";

/**
 * Prompt text shared by every LLM provider. Kept in one place so the providers
 * can't drift apart. Each kind asks for one JSON object (`{"puzzles": [...]}` for
 * emoji), which works with JSON mode on every provider.
 */

const EMOJI_THEMES = [
  "90s Bollywood songs", "cricket commentary", "monsoon chai and pakoda", "shaadi season", "Kolkata sweets",
  "Chennai cinema", "Punjabi dhaba food", "Diwali lights", "Holi colours", "Mumbai local trains",
  "Doordarshan-era serials", "ISRO and space", "Olympic medals", "Kumbh and pilgrimages", "Ganesh festival",
  "Navratri garba", "Rajasthani forts", "Onam feast", "Bengali festivals", "school tiffin boxes",
  "board exam stress", "auto-rickshaw life", "Indian street food", "wedding dance songs", "road trips on NH-48",
  "grandparents' sayings", "Indian Railways", "cricket World Cup nights", "Bollywood villains", "yoga and ayurveda",
];

const CHOR_THEMES = [
  "things in a kitchen", "Mumbai neighbourhoods", "old Hindi film songs", "cricket grounds and players",
  "festival sweets", "cities in India", "Indian cricket captains", "monsoon things", "wedding rituals",
  "trains and stations", "famous Indian rivers", "animals found in India", "desi games played as kids",
  "fabrics and clothes", "spices in the masala dabba", "Indian TV serials", "jobs in a small town",
  "flowers in a puja thali",
];

const SHAPES: Record<SuggestKind, string> = {
  "chor-kaun-topic": `{"id": "kebab-case-english", "label": "short English title", "emoji": "one emoji", "words": ["18-28 distinct short answers"]}`,
  "emoji-puzzle": `{"puzzles": [{"emojis": "2-6 emoji", "category": "Movie|Food|Place|Festival|Phrase|Cartoon|Sport|Song", "answer": "the single correct answer", "alt": ["other accepted answers"], "hint": "short hint", "level": "kids|family|adults"}]}`,
  "next-game": `{"gameId": "one of the ids below", "reason": "one friendly sentence"}`,
  dare: `{"text": "one short dare or icebreaker"}`,
  "bottle-prompts": `{"truths": ["..."], "dares": ["..."], "social": ["..."]}`,
};

/** A random theme for variety. Chosen on the server, so the model can't be steered by the browser. */
export function pickTheme(kind: SuggestKind): string | null {
  const list = kind === "emoji-puzzle" ? EMOJI_THEMES : kind === "chor-kaun-topic" ? CHOR_THEMES : null;
  if (!list) return null;
  return list[Math.floor(Math.random() * list.length)] ?? null;
}

/** Things the device has already been shown. The model must not repeat them. */
export function avoidBlock(avoid: string[] | undefined): string {
  if (!avoid?.length) return "";
  return `Do NOT repeat or closely resemble any of these (already shown): ${JSON.stringify(avoid.slice(0, 40))}.`;
}

export function buildPrompt(kind: SuggestKind, context: Record<string, unknown>): string {
  // Spin the Bottle has its own prompt with tone rules and handwritten examples.
  if (kind === "bottle-prompts") return buildBottlePrompt(isBottleTone(context.tone) ? context.tone : "family", Array.isArray(context.avoid) ? (context.avoid as string[]) : []);
  const avoid = Array.isArray(context.avoid) ? (context.avoid as string[]) : [];
  const theme = pickTheme(kind);
  const variety = "Be surprising and specific: choose less obvious items, not the first ones that come to mind.";
  const parts: string[] = [];

  switch (kind) {
    case "chor-kaun-topic":
      parts.push(
        "You are helping an Indian family party game app (BAWAAL). Create ONE new Chor Kaun topic pack for spotting the impostor.",
        `Theme for this pack: ${theme}.`,
        `Avoid topic ids: ${JSON.stringify(context.excludeTopicIds ?? [])}.`,
        avoidBlock(avoid),
        "Words must be 18-28 distinct short answers Indian families know. Family-friendly, no politics, no explicit content.",
      );
      break;
    case "emoji-puzzle": {
      const level = String(context.level ?? "family");
      const count = Number(context.count ?? 10);
      parts.push(
        `Create ${count} Emoji Picture puzzles for Indian family parties at "${level}" difficulty.`,
        `Theme for this set: ${theme}. Mix in at least two other themes too.`,
        "Each answer must be something a family can actually guess from the emoji. The answer must be factually correct; if you are not sure of a fact, leave that puzzle out.",
        avoidBlock(avoid),
        variety,
        "Family-safe, fun, no explicit content.",
      );
      break;
    }
    case "next-game": {
      const gameIds = GAMES.map((g) => g.id).join(", ");
      parts.push(
        "Pick the best next party game for this Indian family app.",
        `Player count: ${context.playerCount}. Already played this party: ${JSON.stringify(context.gamesPlayed ?? [])}.`,
        `You MUST set gameId to exactly one of: ${gameIds}.`,
      );
      break;
    }
    case "dare":
      parts.push(
        "One short party dare or icebreaker prompt for a mixed-age Indian family gathering.",
        "Friendly, inclusive, non-explicit, no alcohol or drugs. Can be silly or wholesome.",
        avoidBlock(avoid),
        variety,
      );
      break;
  }

  parts.push(`Reply with ONLY one JSON object of this shape, no prose and no code fences: ${SHAPES[kind]}`);
  return parts.filter(Boolean).join("\n");
}

/** Pulls the payload out of a model reply: strips code fences and finds the first JSON value. */
export function parseModelJson(text: string): unknown | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.search(/[\[{]/);
  if (start < 0) return null;
  try {
    return JSON.parse(cleaned.slice(start));
  } catch {
    return null;
  }
}

/** Emoji replies come back as {"puzzles": [...]}; the validators take the array. */
export function unwrapPayload(kind: SuggestKind, raw: unknown): unknown {
  if (kind === "emoji-puzzle" && raw && typeof raw === "object" && !Array.isArray(raw) && "puzzles" in raw) {
    return (raw as { puzzles: unknown }).puzzles;
  }
  return raw;
}
