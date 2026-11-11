import Link from "next/link";
import type { GameInfo } from "@/lib/types";
import { GameIcon } from "./GameIcon";

/** Netflix-style poster for a game. */
export function GameCard({ game, playable, onSelect, size = "md" }: { game: GameInfo; playable: boolean; onSelect?: () => void; size?: "md" | "lg" }) {
  const body = (
    <>
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(120% 80% at 80% 0%, ${game.color}55, transparent 60%), linear-gradient(180deg, ${game.color}22, #0b0b10 85%)` }}
      />
      <GameIcon id={game.id} className="absolute -right-4 top-4 h-28 w-28 opacity-25 transition group-hover:scale-110" strokeWidth={1.5} />
      <div className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: game.color, color: "#0b0b10" }}>
        <GameIcon id={game.id} className="h-5 w-5" strokeWidth={2.4} />
      </div>
      {!playable && <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">Soon</span>}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className={`font-display font-extrabold leading-tight ${size === "lg" ? "text-2xl" : "text-lg"}`}>{game.name}</div>
        <div className="mt-0.5 line-clamp-2 text-xs text-muted">{game.tagline}</div>
        <div className="mt-2 flex gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink/70">
          <span className="rounded bg-white/10 px-1.5 py-0.5">{game.ages}</span>
          <span className="rounded bg-white/10 px-1.5 py-0.5">{game.players}</span>
        </div>
      </div>
    </>
  );
  const cls = `group relative block aspect-[2/3] shrink-0 snap-start overflow-hidden rounded-xl border border-white/[0.08] bg-card text-left transition hover:border-white/25 active:scale-[0.98] ${
    size === "lg" ? "w-48 sm:w-56" : "w-36 sm:w-44"
  }`;
  return onSelect ? (
    <button onClick={onSelect} className={cls}>
      {body}
    </button>
  ) : (
    <Link href={`/games/${game.id}`} className={cls}>
      {body}
    </Link>
  );
}

/** Horizontally scrolling row of posters with a title. */
export function PosterRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 px-4 font-display text-lg font-bold sm:text-xl">{title}</h2>
      <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pb-2 scroll-px-4">{children}</div>
    </section>
  );
}
