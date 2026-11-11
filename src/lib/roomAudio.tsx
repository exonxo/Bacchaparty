"use client";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { playSfx, vibrate, type Sfx } from "./sfx";

interface RoomAudio {
  /** Everyone is in one room (sounds for shared events play only on the host/TV). */
  together: boolean;
  /** This device is the host phone or the TV. */
  isStage: boolean;
}

const Ctx = createContext<RoomAudio>({ together: true, isStage: false });

export const RoomAudioProvider = Ctx.Provider;

/**
 * shared(): events everyone experiences (new number, reveal). In one room only the
 * host phone / TV plays them, so six phones don't all ding at once.
 * mine(): feedback just for this player (your answer was right, your turn).
 */
export function useSfx() {
  const { together, isStage } = useContext(Ctx);
  const shared = useCallback(
    (s: Sfx) => {
      if (!together || isStage) playSfx(s);
    },
    [together, isStage],
  );
  const mine = useCallback((s: Sfx, buzz?: number | number[]) => {
    playSfx(s);
    if (buzz) vibrate(buzz);
  }, []);
  return { shared, mine, together, isStage };
}

/** Runs `fn` when `value` changes after the first render. */
export function useOnChange<T>(value: T, fn: (next: T, prev: T) => void) {
  const prev = useRef(value);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (!Object.is(prev.current, value)) {
      const p = prev.current;
      prev.current = value;
      fnRef.current(value, p);
    }
  }, [value]);
}
