"use client";
import type { SuggestKind } from "./types";
import { bottleKeys, type BottleBatch } from "./bottle";

/**
 * What this device has already been shown, per kind. Sent with each suggestion request so the
 * server can keep new items different. Stored on the device only, never sent anywhere else.
 */
const KEY = "bacchaparty-seen-v1";
const KEEP = 60;

type Store = Partial<Record<SuggestKind, string[]>>;

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

export function recall(kind: SuggestKind): string[] {
  return (read()[kind] ?? []).slice(-40);
}

export function remember(kind: SuggestKind, keys: string[]): void {
  if (!keys.length) return;
  try {
    const store = read();
    const merged = [...new Set([...(store[kind] ?? []), ...keys])].slice(-KEEP);
    localStorage.setItem(KEY, JSON.stringify({ ...store, [kind]: merged }));
  } catch {
    /* private mode or storage full: just no memory this time */
  }
}

/** The "what was shown" key for each kind: a topic's label, or each puzzle's answer. */
export function keysOf(kind: SuggestKind, data: unknown): string[] {
  if (kind === "chor-kaun-topic" && data && typeof data === "object") {
    const label = (data as { label?: unknown }).label;
    return typeof label === "string" ? [label] : [];
  }
  if (kind === "bottle-prompts" && data && typeof data === "object") {
    return bottleKeys(data as BottleBatch);
  }
  if (kind === "emoji-puzzle" && Array.isArray(data)) {
    return data.map((p) => (p as { answer?: unknown }).answer).filter((a): a is string => typeof a === "string");
  }
  return [];
}
