import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cake, Clock, Lightbulb, Tag, Users } from "lucide-react";
import { GameIcon } from "@/components/GameIcon";
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
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl" style={{ background: game.color, color: "#0b0b10" }}>
            <GameIcon id={game.id} className="h-10 w-10" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="font-display text-4xl font-black">{game.name}</h1>
            <p className="text-xl text-muted">{game.tagline}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1"><Cake className="h-4 w-4" /> Ages {game.ages}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1"><Users className="h-4 w-4" /> {game.players}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1"><Clock className="h-4 w-4" /> {game.duration}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1"><Tag className="h-4 w-4" /> {game.category}</span>
        </div>
        <p className="mt-6 text-lg leading-relaxed">{game.description}</p>

        <h2 className="mt-8 text-2xl font-bold text-saffron">How to play</h2>
        <ol className="mt-3 space-y-3">
          {game.howToPlay.map((step, i) => (
            <li key={i} className="flex gap-3 text-lg">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-saffron font-bold text-black">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <h2 className="mt-8 text-2xl font-bold text-saffron">Scoring</h2>
        <p className="mt-2 text-lg">{game.scoring}</p>

        <div className="mt-8 flex gap-3 rounded-2xl bg-teal/10 p-5 text-lg">
          <Lightbulb className="mt-1 h-5 w-5 shrink-0 text-teal" />
          <div><span className="font-bold text-teal">Family tip: </span>
          {game.familyTip}</div>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          {playable ? (
            <Link href="/host" className="rounded-xl bg-saffron px-6 py-3.5 font-display text-xl font-bold text-black">
              Host a party to play
            </Link>
          ) : (
            <span className="rounded-2xl bg-white/10 px-6 py-3.5 text-xl font-bold text-muted">Coming soon</span>
          )}
        </div>
      </article>
    </main>
  );
}
