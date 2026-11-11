import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Cake, Clock, Lightbulb, Smartphone, Tag, Users } from "lucide-react";
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
        <Link href="/games" className="-ml-2 mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-base font-semibold text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> All games
        </Link>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl" style={{ background: game.color, color: "#0b0b10" }}>
            <GameIcon id={game.id} className="h-10 w-10" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="font-display text-4xl font-black text-balance">{game.name}</h1>
            <p className="text-xl text-muted">{game.tagline}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1"><Cake className="h-4 w-4" /> Ages {game.ages}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1"><Users className="h-4 w-4" /> {game.players}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1"><Clock className="h-4 w-4" /> {game.duration}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1"><Tag className="h-4 w-4" /> {game.category}</span>
        </div>
        {game.inShort && (
          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-card p-4">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-saffron">In short</div>
            <ul className="mt-2 space-y-1 text-lg">
              {game.inShort.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-6 text-lg leading-relaxed">{game.description}</p>
        <p className="mt-3 flex items-start gap-2 text-base leading-6 text-muted">
          <Smartphone className="mt-1 h-4 w-4 shrink-0" />
          <span>A TV is nice, but phones alone are fine — the host runs the game from their phone.</span>
        </p>

        <h2 className="mt-8 scroll-mt-20 text-2xl font-bold text-saffron">How to play</h2>
        <ol className="mt-3 space-y-3">
          {game.howToPlay.map((step, i) => (
            <li key={i} className="flex gap-3 text-lg">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-saffron font-bold text-black">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <h2 className="mt-8 scroll-mt-20 text-2xl font-bold text-saffron">Scoring</h2>
        <p className="mt-2 text-lg">{game.scoring}</p>

        <div className="mt-8 flex gap-3 rounded-2xl bg-teal/10 p-5 text-lg">
          <Lightbulb className="mt-1 h-5 w-5 shrink-0 text-teal" />
          <div><span className="font-bold text-teal">Family tip: </span>
          {game.familyTip}</div>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          {playable ? (
            <>
              <Link href="/host" className="inline-flex min-h-14 items-center rounded-xl bg-saffron px-6 font-display text-xl font-bold text-black shadow-[0_10px_30px_-10px_var(--saffron)]">
                Host a party to play
              </Link>
              <Link href="/join" className="inline-flex min-h-14 items-center rounded-xl bg-white/10 px-6 font-display text-xl font-bold">
                Join with a code
              </Link>
            </>
          ) : (
            <span className="rounded-2xl bg-white/10 px-6 py-3.5 text-xl font-bold text-muted">Coming soon</span>
          )}
        </div>
      </article>
    </main>
  );
}
