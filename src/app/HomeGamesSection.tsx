"use client";
import { GameTable, GameTile } from "@/components/paper/GameTile";
import { GamesCatalogClient } from "@/components/loaders";

const ORDER = ["chor-kaun", "housie", "charades", "emoji-picture", "antakshari", "draw-guess", "kaun-banega-champion", "raja-mantri", "odd-word-out", "ludo-yatra", "sound-guru", "jaldi-bolo"];

export function HomeGamesSection() {
  return (
    <GamesCatalogClient
      render={(games) => {
        const ordered = ORDER.map((id) => games.find((g) => g.id === id)!).filter(Boolean);
        return (
          <GameTable>
            {ordered.map((g, i) => (
              <GameTile key={g.id} game={g} index={i} />
            ))}
          </GameTable>
        );
      }}
    />
  );
}
