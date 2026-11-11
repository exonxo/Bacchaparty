"use client";
import { useEffect, useState } from "react";

/** Shows `true` only after `active` stays true for `delayMs` (default 150). */
export function useDelayedVisible(active: boolean, delayMs = 150): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [active, delayMs]);
  return active && visible;
}
