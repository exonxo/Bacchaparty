import Link from "next/link";
import { ArrowRight, Clock, Users } from "lucide-react";
import { GameIcon } from "@/components/GameIcon";
import { GAMES } from "@/games/catalog";

/** Curated first look; the full catalogue lives on /games. All facts come from the catalogue. */
const FEATURED = ["chor-kaun", "housie", "charades", "kaun-banega-champion", "antakshari", "puno"];
const BANDS = ["bg-bw-yellow", "bg-bw-red", "bg-bw-blue", "bg-bw-yellow", "bg-bw-red", "bg-bw-blue"];
const BAND_TEXT = ["text-bw-ink", "text-white", "text-white", "text-bw-ink", "text-white", "text-white"];

export function HomeGamesSection() {
  const featured = FEATURED.map((id) => GAMES.find((g) => g.id === id)).filter((g) => g !== undefined);
  return (
    <>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((g, i) => (
          <li key={g.id}>
            <Link
              href={`/games/${g.id}`}
              className="bw-pop bw-btn group flex h-full flex-col overflow-hidden rounded-2xl bg-white text-bw-ink"
            >
              <span className={`relative flex items-center justify-between gap-3 border-b-[3px] border-bw-ink px-4 py-3 ${BANDS[i % 6]} ${BAND_TEXT[i % 6]}`}>
                <span className="font-bw-accent text-sm font-extrabold uppercase tracking-wider">{g.category}</span>
                <span className="bw-pop-sm grid size-11 place-items-center rounded-full bg-white text-bw-ink" aria-hidden>
                  <GameIcon id={g.id} className="size-5" strokeWidth={2.5} />
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
