import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameIcon } from "@/components/GameIcon";
import { Header } from "@/components/Header";
import { gameLook } from "@/components/paper/gameLook";
import { paperButtonClass } from "@/components/paper/classes";
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
  const look = gameLook(game.id);
  return (
    <main className="pb-20">
      <Header />
      <article className="mx-auto max-w-3xl px-4">
        <Link href="/games" className="-ml-2 mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-cut px-2 text-p-body font-semibold text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Saare games
        </Link>

        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="cut flex h-20 w-20 shrink-0 -rotate-3 items-center justify-center rounded-soft" style={{ background: look.color, color: look.on }}>
            <GameIcon id={game.id} className="h-10 w-10" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-p-show font-extrabold text-balance">{game.name}</h1>
            <p className="mt-1 text-p-lead text-muted">{game.tagline}</p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-3 border-y-[1.5px] border-ink text-center">
          {[
            ["Ages", game.ages],
            ["Players", game.players],
            ["Time", game.duration],
          ].map(([k, v], i) => (
            <div key={k} className={`px-2 py-3 ${i ? "border-l-[1.5px] border-line" : ""}`}>
              <dt className="text-p-note font-bold uppercase tracking-[0.14em] text-muted">{k}</dt>
              <dd className="font-display text-p-body font-extrabold leading-tight">{v}</dd>
            </div>
          ))}
        </dl>

        {game.inShort && (
          <div className="cut mt-7 rotate-[0.6deg] rounded-cut bg-[#fff3a8] p-4 text-[#1e1a17]">
            <div className="text-p-note font-bold uppercase tracking-[0.18em]">Short mein</div>
            <ul className="mt-1.5 space-y-1 text-p-lead font-medium">
              {game.inShort.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-7 text-p-lead">{game.description}</p>
        <p className="mt-3 text-p-body text-muted">TV zaroori nahi — phones alone are fine. The host runs the game from their phone.</p>

        <h2 className="mt-9 scroll-mt-20 text-p-title font-extrabold">Kaise khelein</h2>
        <ol className="mt-3">
          {game.howToPlay.map((step, i) => (
            <li key={i} className="flex gap-4 border-t-[1.5px] border-line py-3 text-p-lead">
              <span className="font-display w-7 shrink-0 text-p-title font-extrabold leading-none text-turmeric-ink">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <h2 className="mt-9 scroll-mt-20 text-p-title font-extrabold">Points</h2>
        <p className="mt-2 text-p-lead">{game.scoring}</p>

        <div className="mt-8 border-l-4 border-leaf pl-4 text-p-lead">
          <span className="font-bold text-leaf">Family tip: </span>
          {game.familyTip}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          {playable ? (
            <>
              <Link href="/host" className={paperButtonClass("turmeric", "lg")}>
                Party shuru karo
              </Link>
              <Link href="/join" className={paperButtonClass("paper", "lg")}>
                Code hai? Join karo
              </Link>
            </>
          ) : (
            <span className="rounded-cut bg-tint px-5 py-3.5 text-p-lead font-bold text-muted">Coming soon</span>
          )}
        </div>
      </article>
    </main>
  );
}
