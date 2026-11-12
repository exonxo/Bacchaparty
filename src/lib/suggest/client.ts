"use client";

import { fallbackFor } from "@/lib/suggest/fallbacks";
import type { SuggestApiResponse, SuggestKind } from "@/lib/suggest/types";
import type { Level } from "@/lib/types";
import { validateGeminiPayload } from "@/lib/suggest/validate";

function validateClientPayload(kind: SuggestKind, data: unknown, context: Record<string, unknown>): unknown | null {
  const count = kind === "emoji-puzzle" && typeof context.count === "number" ? context.count : 10;
  const playerCount = kind === "next-game" && typeof context.playerCount === "number" ? context.playerCount : 4;
  const level = (kind === "emoji-puzzle" && typeof context.level === "string" ? context.level : "family") as Level;
  return validateGeminiPayload(kind, data, count, playerCount, level);
}

export async function requestSuggest<T>(
  kind: SuggestKind,
  context: Record<string, unknown>,
  roomCode?: string,
): Promise<{ data: T; fallback: boolean }> {
  const fullContext = { kind, ...context };
  try {
    const res = await fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, context, roomCode }),
      signal: AbortSignal.timeout(9_500),
    });
    const json = (await res.json()) as SuggestApiResponse;
    if (res.ok && json.ok && json.data != null) {
      const validated = validateClientPayload(kind, json.data, context);
      if (validated != null) {
        return { data: validated as T, fallback: !!json.fallback };
      }
    }
  } catch {
    /* use local fallback */
  }
  const local = fallbackFor(kind, fullContext) as T;
  return { data: local, fallback: true };
}
