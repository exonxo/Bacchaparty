import Link from "next/link";
import type { GameInfo } from "@/lib/types";

export function GameCard({ game, playable }: { game: GameInfo; playable: boolean }) {
  return (
    <Link
      href={`/games/${game.id}`}
      className="group flex flex-col gap-3 rounded-3xl border border-white/10 bg-card/80 p-5 transition hover:-translate-y-1 hover:border-white/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl" style={{ background: `${game.color}33` }}>
          {game.emoji}
        </div>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-muted">Ages {game.ages}</span>
      </div>
      <div>
        <div className="text-xl font-extrabold">{game.name}</div>
        <div className="text-muted">{game.tagline}</div>
      </div>
      <p className="line-clamp-3 text-sm text-ink/80">{game.description}</p>
      <div className="mt-auto flex flex-wrap gap-2 text-xs font-semibold text-muted">
        <span className="rounded-full bg-white/5 px-2 py-1">👥 {game.players}</span>
        <span className="rounded-full bg-white/5 px-2 py-1">⏱ {game.duration}</span>
        {!playable && <span className="rounded-full bg-pink/20 px-2 py-1 text-pink">Coming soon</span>}
      </div>
    </Link>
  );
}
