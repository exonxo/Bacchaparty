"use client";

import { fallbackFor } from "@/lib/suggest/fallbacks";
import { keysOf, recall, remember } from "@/lib/suggest/memory";
import type { SuggestApiResponse, SuggestKind } from "@/lib/suggest/types";
import type { Level } from "@/lib/types";
import { validateGeminiPayload } from "@/lib/suggest/validate";

function validateClientPayload(kind: SuggestKind, data: unknown, context: Record<string, unknown>): unknown | null {
  const count = kind === "emoji-puzzle" && typeof context.count === "number" ? context.count : 10;
  const playerCount = kind === "next-game" && typeof context.playerCount === "number" ? context.playerCount : 4;
  const level = (kind === "emoji-puzzle" && typeof context.level === "string" ? context.level : "family") as Level;
  return validateGeminiPayload(kind, data, count, playerCount, level, context.tone);
}

export async function requestSuggest<T>(
  kind: SuggestKind,
  context: Record<string, unknown>,
  roomCode?: string,
): Promise<{ data: T; fallback: boolean }> {
  // The device's own memory goes with the request, so the server can avoid repeats.
  const withMemory = { ...context, avoid: recall(kind) };
  try {
    const res = await fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, context: withMemory, roomCode }),
      signal: AbortSignal.timeout(9_500),
    });
    const json = (await res.json()) as SuggestApiResponse;
    if (res.ok && json.ok && json.data != null) {
      const validated = validateClientPayload(kind, json.data, withMemory);
      if (validated != null) {
        remember(kind, keysOf(kind, validated));
        return { data: validated as T, fallback: !!json.fallback };
      }
    }
  } catch {
    /* use local fallback */
  }
  const local = fallbackFor(kind, { kind, ...withMemory }) as T;
  remember(kind, keysOf(kind, local));
  return { data: local, fallback: true };
}
