import type { Metadata } from "next";
import { GameCard } from "@/components/GameCard";
import { Header } from "@/components/Header";
import { CATEGORIES, GAMES } from "@/games/catalog";
import { isPlayable } from "@/games/playable";

export const metadata: Metadata = { title: "All games — Bacchaparty" };

export default function GamesPage() {
  return (
    <main className="pb-20">
      <Header />
      <div className="mx-auto max-w-6xl px-4">
        <h1 className="mt-4 text-4xl font-extrabold">All games</h1>
        <p className="mt-2 text-lg text-muted">Tap any game to read how to play.</p>
        {CATEGORIES.map((cat) => {
          const list = GAMES.filter((g) => g.category === cat);
          if (!list.length) return null;
          return (
            <section key={cat} className="mt-10">
              <h2 className="mb-4 text-2xl font-bold text-saffron">{cat}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((g) => (
                  <GameCard key={g.id} game={g} playable={isPlayable(g.id)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
