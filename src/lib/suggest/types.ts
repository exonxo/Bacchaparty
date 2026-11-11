import type { ChorTopic } from "@/content/chor-kaun";
import type { EmojiPuzzle } from "@/content/emoji-picture";
import type { Level } from "@/lib/types";

export const SUGGEST_KINDS = ["chor-kaun-topic", "emoji-puzzle", "next-game", "dare"] as const;
export type SuggestKind = (typeof SUGGEST_KINDS)[number];

export type SuggestContext =
  | { kind: "chor-kaun-topic"; excludeTopicIds?: string[] }
  | { kind: "emoji-puzzle"; level?: Level; count?: number }
  | { kind: "next-game"; playerCount: number; gamesPlayed?: string[]; mood?: string }
  | { kind: "dare"; audience?: "family" | "mixed" };

export type ChorKaunTopicResult = ChorTopic & { id: string };

export interface NextGameResult {
  gameId: string;
  reason: string;
}

export interface DareResult {
  text: string;
}

export type SuggestResult =
  | { kind: "chor-kaun-topic"; data: ChorKaunTopicResult }
  | { kind: "emoji-puzzle"; data: EmojiPuzzle[] }
  | { kind: "next-game"; data: NextGameResult }
  | { kind: "dare"; data: DareResult };

export interface SuggestApiResponse {
  ok: boolean;
  fallback?: boolean;
  data?: unknown;
  error?: string;
}
