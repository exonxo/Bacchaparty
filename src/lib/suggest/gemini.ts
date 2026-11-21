import type { SuggestKind } from "./types";

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest";

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
  type: "object",
  properties: {
    puzzles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          emojis: { type: "string" },
          decode: { type: "string" },
          category: { type: "string" },
          answer: { type: "string" },
          alt: { type: "array", items: { type: "string" } },
          hint: { type: "string" },
          level: { type: "string" },
        },
        required: ["emojis", "category", "answer", "hint", "level"],
      },
    },
  },
  required: ["puzzles"],
};

const NEXT_GAME_SCHEMA: JsonSchema = {
  type: "object",
  properties: { gameId: { type: "string" }, reason: { type: "string" } },
  required: ["gameId", "reason"],
};

const DARE_SCHEMA: JsonSchema = {
  type: "object",
  properties: { text: { type: "string" } },
  required: ["text"],
};

const BOTTLE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    truths: { type: "array", items: { type: "string" } },
    dares: { type: "array", items: { type: "string" } },
    social: { type: "array", items: { type: "string" } },
  },
  required: ["truths", "dares"],
};

function schemaFor(kind: SuggestKind): JsonSchema {
  switch (kind) {
    case "bottle-prompts":
      return BOTTLE_SCHEMA;
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

/** Gemini's own API. Throws a `ProviderError` with the HTTP status when the call fails. */
export async function callGemini(apiKey: string, kind: SuggestKind, prompt: string, signal: AbortSignal, temperature = 1.1): Promise<unknown | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schemaFor(kind),
      temperature,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new ProviderHttpError(res.status);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export class ProviderHttpError extends Error {
  constructor(public status: number) {
    super(`provider http ${status}`);
  }
}
