import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { GAMES, getGameInfo } from "@/games/catalog";
import { isPlayable } from "@/games/playable";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const g = getGameInfo(id);
  return { title: g ? `${g.name} — Bacchaparty` : "Game — Bacchaparty", description: g?.tagline };
}

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = getGameInfo(id);
  if (!game) notFound();
  const playable = isPlayable(game.id);
  return (
    <main className="pb-20">
      <Header />
      <article className="mx-auto max-w-3xl px-4">
        <Link href="/games" className="text-sm font-semibold text-muted">
          ← All games
        </Link>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl text-5xl" style={{ background: `${game.color}33` }}>
            {game.emoji}
          </div>
          <div>
            <h1 className="text-4xl font-extrabold">{game.name}</h1>
            <p className="text-xl text-muted">{game.tagline}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
          <span className="rounded-full bg-white/10 px-3 py-1">🎂 Ages {game.ages}</span>
          <span className="rounded-full bg-white/10 px-3 py-1">👥 {game.players}</span>
          <span className="rounded-full bg-white/10 px-3 py-1">⏱ {game.duration}</span>
          <span className="rounded-full bg-white/10 px-3 py-1">🏷 {game.category}</span>
        </div>
        <p className="mt-6 text-lg leading-relaxed">{game.description}</p>

        <h2 className="mt-8 text-2xl font-bold text-saffron">How to play</h2>
        <ol className="mt-3 space-y-3">
          {game.howToPlay.map((step, i) => (
            <li key={i} className="flex gap-3 text-lg">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-saffron font-bold text-bg">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <h2 className="mt-8 text-2xl font-bold text-saffron">Scoring</h2>
        <p className="mt-2 text-lg">{game.scoring}</p>

        <div className="mt-8 rounded-3xl bg-teal/15 p-5 text-lg">
          <span className="font-bold text-teal">Family tip: </span>
          {game.familyTip}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          {playable ? (
            <Link href="/host" className="rounded-2xl bg-saffron px-6 py-3.5 text-xl font-extrabold text-bg">
              📺 Host a party to play
            </Link>
          ) : (
            <span className="rounded-2xl bg-white/10 px-6 py-3.5 text-xl font-bold text-muted">Coming soon</span>
          )}
        </div>
      </article>
    </main>
  );
}
