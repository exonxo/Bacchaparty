import type { Metadata } from "next";
import { GameCard, PosterRow } from "@/components/GameCard";
import { Header } from "@/components/Header";
import { CATEGORIES, GAMES } from "@/games/catalog";
import { isPlayable } from "@/games/playable";

export const metadata: Metadata = { title: "All games — Bacchaparty" };

export default function GamesPage() {
  return (
    <main className="pb-16">
      <Header />
      <div className="mx-auto max-w-6xl px-4">
        <h1 className="mt-4 font-display text-3xl font-black sm:text-4xl">All games</h1>
        <p className="mt-1 text-muted">Tap a game to read how to play.</p>
      </div>
      {CATEGORIES.map((cat) => {
        const list = GAMES.filter((g) => g.category === cat);
        if (!list.length) return null;
        return (
          <PosterRow key={cat} title={cat} grid>
            {list.map((g) => (
              <GameCard key={g.id} game={g} playable={isPlayable(g.id)} grid />
            ))}
          </PosterRow>
        );
      })}
    </main>
  );
}
