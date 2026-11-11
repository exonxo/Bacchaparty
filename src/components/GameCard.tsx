import Link from "next/link";
import type { GameInfo } from "@/lib/types";
import { GameIcon } from "./GameIcon";

/** Netflix-style poster for a game. */
export function GameCard({
  game,
  playable,
  onSelect,
  size = "md",
  grid = false,
}: {
  game: GameInfo;
  playable: boolean;
  onSelect?: () => void;
  size?: "md" | "lg";
  /** Inside a PosterRow that becomes a grid on wide screens. */
  grid?: boolean;
}) {
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
      {!playable && <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-bold text-muted">Soon</span>}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className={`font-display font-extrabold leading-tight tracking-tight text-balance ${size === "lg" ? "text-2xl" : "text-[17px]"}`}>{game.name}</div>
        <div className="mt-1 line-clamp-3 text-[13px] leading-snug text-muted">{game.tagline}</div>
        <div className="mt-2 flex flex-wrap items-start gap-1 text-xs font-semibold text-ink/80">
          <span className="inline-flex h-6 items-center rounded-md bg-white/10 px-1.5 leading-none">{game.ages}</span>
          <span className="inline-flex h-6 items-center rounded-md bg-white/10 px-1.5 leading-none">{game.players}</span>
        </div>
      </div>
    </>
  );
  const cls = `group relative block aspect-[2/3] shrink-0 snap-start overflow-hidden rounded-xl border border-white/[0.08] bg-card text-left transition hover:border-white/25 active:scale-[0.98] ${
    size === "lg" ? "w-48 sm:w-56" : "w-40 sm:w-48"
  } ${grid ? "lg:w-auto" : ""}`;
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

/**
 * Row of posters with a title, inside the page column. Scrolls sideways on
 * phones; with `grid`, becomes a wrapping grid on wide screens.
 */
export function PosterRow({ title, children, grid = false, as: Heading = "h2" }: { title: string; children: React.ReactNode; grid?: boolean; as?: "h2" | "h3" }) {
  return (
    <section className="mx-auto mt-8 max-w-6xl">
      <Heading className="mb-3 px-4 font-display text-lg font-bold sm:text-xl">{title}</Heading>
      <div
        className={`no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pb-2 scroll-px-4 ${
          grid ? "lg:grid lg:grid-cols-5 lg:overflow-visible xl:grid-cols-6" : ""
        }`}
      >
        {children}
      </div>
    </section>
  );
}
