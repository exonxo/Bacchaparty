"use client";
import { useEffect, useState } from "react";

/** Re-renders every `interval` ms and returns Date.now() shifted by `offset`. */
export function useNow(offset = 0, interval = 250): number {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), interval);
    return () => clearInterval(t);
  }, [offset, interval]);
  return now;
}
