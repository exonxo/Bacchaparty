"use client";
import { GameTable, GameTile } from "@/components/paper/GameTile";
import { GamesCatalogClient } from "@/components/loaders";

export function GamesPageClient() {
  return (
    <GamesCatalogClient
      render={(games, categories) => {
        let n = 0;
        return categories.map((cat) => {
          const list = games.filter((g) => g.category === cat);
          if (!list.length) return null;
          return (
            <section key={cat} className="mt-9">
              <h2 className="mb-4 border-b-[1.5px] border-ink pb-1 text-p-title font-extrabold">{cat}</h2>
              <GameTable>
                {list.map((g) => (
                  <GameTile key={g.id} game={g} index={n++} />
                ))}
              </GameTable>
            </section>
          );
        });
      }}
    />
  );
}
