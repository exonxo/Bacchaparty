"use client";
import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { requestSuggest } from "@/lib/suggest/client";
import { remember } from "@/lib/suggest/memory";
import { batchToPrompts, type BottleBatch } from "@/lib/suggest/bottle";
import type { Pub } from "./logic";

/** At most this many AI fetches per game, and never more often than every 30 seconds. */
const MAX_FETCHES = 8;
const COOLDOWN_MS = 30_000;

/**
 * Runs on the host's device only. Fetches one fresh AI batch when the game starts and another
 * whenever a pile runs low, then hands the prompts to the game as a host action. The game
 * plays from the built-in deck meanwhile, so nobody ever waits for the AI.
 */
export function useBottleRefill(view: Pub, isHost: boolean, hostAct: (type: string, payload?: unknown) => void) {
  const params = useParams();
  const roomCode = typeof params?.code === "string" ? params.code : undefined;
  const state = useRef({ count: 0, last: 0, busy: false, tone: view.tone });
  const actRef = useRef(hostAct);
  actRef.current = hostAct;

  const wantFirst = state.current.count === 0;
  const want = isHost && (wantFirst || view.needMore);

  useEffect(() => {
    if (!want) return;
    const s = state.current;
    if (s.busy || s.count >= MAX_FETCHES || Date.now() - s.last < COOLDOWN_MS) return;
    s.busy = true;
    s.count += 1;
    s.last = Date.now();
    const tone = view.tone;
    void requestSuggest<BottleBatch>("bottle-prompts", { tone }, roomCode)
      .then(({ data }) => {
        actRef.current("refill", { tone, prompts: batchToPrompts(data) });
      })
      .finally(() => {
        s.busy = false;
      });
  }, [want, view.tone, view.n, roomCode]);

  // Reported cards are remembered on this device, so they're avoided in future batches too.
  const reportedCount = view.reported.length;
  useEffect(() => {
    if (!isHost || !reportedCount) return;
    remember("bottle-prompts", view.reported.map((t) => t.toLowerCase().slice(0, 60)));
  }, [isHost, reportedCount, view.reported]);
}
