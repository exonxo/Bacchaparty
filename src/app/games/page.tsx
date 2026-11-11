import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { GameTable, GameTile } from "@/components/paper/GameTile";
import { CATEGORIES, GAMES } from "@/games/catalog";

export const metadata: Metadata = { title: "All games — Bacchaparty" };

export default function GamesPage() {
  let n = 0;
  return (
    <main className="pb-16">
      <Header />
      <div className="mx-auto max-w-6xl px-4">
        <h1 className="mt-6 text-p-show font-extrabold">Saare games</h1>
        <p className="mt-1 text-p-body text-muted">Tap a game to read how to play.</p>
        {CATEGORIES.map((cat) => {
          const list = GAMES.filter((g) => g.category === cat);
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
        })}
      </div>
    </main>
  );
}
