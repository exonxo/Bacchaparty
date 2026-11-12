import { GAMES } from "@/games/catalog";
import type { SuggestKind } from "./types";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

type JsonSchema = Record<string, unknown>;

const CHOR_TOPIC_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    emoji: { type: "string" },
    words: { type: "array", items: { type: "string" } },
  },
  required: ["id", "label", "emoji", "words"],
};

const EMOJI_SCHEMA: JsonSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      emojis: { type: "string" },
      category: { type: "string" },
      answer: { type: "string" },
      alt: { type: "array", items: { type: "string" } },
      hint: { type: "string" },
      level: { type: "string" },
    },
    required: ["emojis", "category", "answer", "hint", "level"],
  },
};

const NEXT_GAME_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    gameId: { type: "string" },
    reason: { type: "string" },
  },
  required: ["gameId", "reason"],
};

const DARE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    text: { type: "string" },
  },
  required: ["text"],
};

function schemaFor(kind: SuggestKind): JsonSchema {
  switch (kind) {
    case "chor-kaun-topic":
      return CHOR_TOPIC_SCHEMA;
    case "emoji-puzzle":
      return EMOJI_SCHEMA;
    case "next-game":
      return NEXT_GAME_SCHEMA;
    case "dare":
      return DARE_SCHEMA;
    default:
      return CHOR_TOPIC_SCHEMA;
  }
}

function promptFor(kind: SuggestKind, context: Record<string, unknown>): string {
  switch (kind) {
    case "chor-kaun-topic":
      return `You are helping an Indian family party game app (Bacchaparty). Create ONE new Chor Kaun topic pack for spotting the impostor.
Return JSON with: id (kebab-case English), label (short English title), emoji (single emoji), words (18-28 distinct short answers Indian families know — places, foods, names, etc.).
Avoid duplicating these topic ids: ${JSON.stringify(context.excludeTopicIds ?? [])}.
Keep words family-friendly, no politics, no explicit content.`;
    case "emoji-puzzle": {
      const level = context.level ?? "family";
      const count = context.count ?? 10;
      return `Create ${count} Emoji Picture puzzles for Indian family parties at "${level}" difficulty.
Each item: emojis (2-6 emoji string), category (Movie|Food|Place|Festival|Phrase|Cartoon|Sport|Song), answer, optional alt array, hint (short), level (kids|family|adults matching difficulty).
Mix Bollywood, desi food, festivals, places. Family-safe, fun, no explicit content.`;
    }
    case "next-game": {
      const gameIds = GAMES.map((g) => g.id).join(", ");
      return `Pick the best next party game for this Indian family app.
Player count: ${context.playerCount}. Already played this party: ${JSON.stringify(context.gamesPlayed ?? [])}. Mood note: ${context.mood ?? "fun"}.
You MUST set gameId to exactly one of: ${gameIds}.
reason: one friendly sentence in English why it fits (mention player count or variety).`;
    }
    case "dare":
      return `One short party dare or icebreaker prompt for a mixed-age Indian family gathering.
Friendly, inclusive, non-explicit, no alcohol/drugs. Can be silly or wholesome. JSON: { "text": "..." } audience: ${context.audience ?? "family"}.`;
    default:
      return "Return empty object.";
  }
}

export async function callGemini(apiKey: string, kind: SuggestKind, context: Record<string, unknown>): Promise<unknown | null> {
  const body = {
    contents: [{ role: "user", parts: [{ text: promptFor(kind, context) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schemaFor(kind),
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(6_000),
  });

  if (res.status === 429) return null;
  if (!res.ok) return null;

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
