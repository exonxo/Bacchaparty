import type { SuggestKind } from "./types";
import { freshBottleBatch, type BottleBatch } from "./bottle";

/** Short, single-line strings only: the memory list goes into a prompt, so keep it small and plain. */
export function cleanAvoid(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const clean = v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.replace(/[\r\n\t]/g, " ").trim().slice(0, 60))
    .filter(Boolean);
  return [...new Set(clean)].slice(-40);
}

/**
 * Drops anything the device has already been shown. Returns null when too little is left,
 * so the chain moves on to the next provider instead of serving a near-repeat.
 */
export function notRepeated(kind: SuggestKind, data: unknown, avoid: string[]): unknown | null {
  if (!avoid.length) return data;
  const seen = new Set(avoid.map((s) => s.toLowerCase()));
  if (kind === "emoji-puzzle" && Array.isArray(data)) {
    const fresh = data.filter((p) => !seen.has(String((p as { answer: string }).answer).toLowerCase()));
    return fresh.length >= 3 ? fresh : null;
  }
  if (kind === "bottle-prompts" && data && typeof data === "object") {
    return freshBottleBatch(data as BottleBatch, avoid);
  }
  if (kind === "chor-kaun-topic" && data && typeof data === "object") {
    return seen.has(String((data as { label: string }).label).toLowerCase()) ? null : data;
  }
  return data;
}
