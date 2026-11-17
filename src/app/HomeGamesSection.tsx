import Link from "next/link";
import { ArrowRight, Clock, Users } from "lucide-react";
import { GameIcon } from "@/components/GameIcon";
import { Motif } from "@/components/paper/GameTile";
import { gameLook } from "@/components/paper/gameLook";
import { GAMES } from "@/games/catalog";

/** Curated first look; the full catalogue lives on /games. All facts come from the catalogue. */
const FEATURED = ["chor-kaun", "housie", "charades", "kaun-banega-champion", "antakshari", "raja-mantri"];

const look = gameLook;

export function HomeGamesSection() {
  const featured = FEATURED.map((id) => GAMES.find((g) => g.id === id)).filter((g) => g !== undefined);
  return (
    <>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((g) => (
          <li key={g.id}>
            <Link
              href={`/games/${g.id}`}
              className="bw-pop bw-on-dark bw-btn group flex h-full flex-col overflow-hidden rounded-2xl bg-white text-bw-ink"
            >
              {/* The game's own paper illustration + icon, as used across the app. */}
              <span className="relative block aspect-[5/3] overflow-hidden border-b-[3px] border-bw-ink" style={{ background: look(g.id).color, color: look(g.id).on }}>
                <Motif shape={look(g.id).shape} on={look(g.id).on} />
                <span className="absolute left-3 top-3 rounded-full border-2 border-bw-ink bg-white px-2.5 py-0.5 font-bw-accent text-xs font-extrabold uppercase tracking-wider text-bw-ink">
                  {g.category}
                </span>
                <span
                  className="bw-pop absolute bottom-3 right-3 grid size-16 place-items-center rounded-full transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-105"
                  style={{ background: look(g.id).color, color: look(g.id).on }}
                  aria-hidden
                >
                  <GameIcon id={g.id} className="size-8" strokeWidth={2.4} />
                </span>
              </span>
              <span className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
                <span className="font-bw-display text-[2rem] leading-none tracking-wide">{g.name}</span>
                <span className="text-base leading-snug text-bw-ink/80">{g.tagline}</span>
                <span className="mt-auto flex flex-wrap gap-2 pt-2 text-sm font-bold">
                  <span className="inline-flex items-center gap-1 rounded-full border-2 border-bw-ink px-2.5 py-0.5">
                    <Users aria-hidden className="size-4" /> {g.players}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border-2 border-bw-ink px-2.5 py-0.5">
                    <Clock aria-hidden className="size-4" /> {g.duration}
                  </span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex justify-center">
        <Link href="/games" className="bw-pop bw-btn inline-flex min-h-14 items-center gap-2 rounded-xl bg-bw-yellow px-7 font-bw-display text-[1.65rem] uppercase tracking-wide text-bw-ink">
          See all {GAMES.length} games <ArrowRight aria-hidden className="size-6" strokeWidth={3} />
        </Link>
      </div>
    </>
  );
}
