"use client";

import { fallbackFor } from "@/lib/suggest/fallbacks";
import type { SuggestApiResponse, SuggestKind } from "@/lib/suggest/types";

export async function requestSuggest<T>(
  kind: SuggestKind,
  context: Record<string, unknown>,
  roomCode?: string,
): Promise<{ data: T; fallback: boolean }> {
  try {
    const res = await fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, context, roomCode }),
      signal: AbortSignal.timeout(9_500),
    });
    const json = (await res.json()) as SuggestApiResponse;
    if (res.ok && json.ok && json.data !== undefined) {
      return { data: json.data as T, fallback: !!json.fallback };
    }
  } catch {
    /* use local fallback */
  }
  const local = fallbackFor(kind, { kind, ...context }) as T;
  return { data: local, fallback: true };
}
