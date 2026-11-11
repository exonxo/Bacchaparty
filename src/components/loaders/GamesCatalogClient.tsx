"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { GameInfo } from "@/lib/types";
import { GamesSkeleton } from "./GamesSkeleton";

/** Shows Games Skeleton only while the catalog chunk is loading — no artificial delay. */
export function GamesCatalogClient({
  render,
}: {
  render: (games: GameInfo[], categories: readonly string[]) => ReactNode;
}) {
  const [ready, setReady] = useState<{ games: GameInfo[]; categories: readonly string[] } | null>(null);

  useEffect(() => {
    let alive = true;
    void import("@/games/catalog").then((m) => {
      if (alive) setReady({ games: m.GAMES, categories: m.CATEGORIES });
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!ready) return <GamesSkeleton count={8} />;
  return render(ready.games, ready.categories);
}
