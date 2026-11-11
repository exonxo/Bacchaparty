"use client";
import { useEffect, useState } from "react";

/**
 * Re-renders every `interval` ms and returns Date.now() shifted by `offset`.
 * The timer keeps running when `offset` changes (it used to restart, which
 * froze countdowns whenever updates arrived quickly).
 */
export function useNow(offset = 0, interval = 250): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), interval);
    return () => clearInterval(t);
  }, [interval]);
  return Date.now() + offset;
}
