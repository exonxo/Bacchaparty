"use client";
import { GameTable } from "@/components/paper/GameTile";

function SkeletonCard({ tilt }: { tilt: number }) {
  return (
    <div
      className="relative flex min-h-[13.5rem] flex-col overflow-hidden rounded-soft border-[1.5px] border-[#bdb3a6] bg-[#f8f3eb] p-3 pt-16 shadow-[2px_2px_0_#bdb3a6]"
      style={{ rotate: `${tilt}deg` }}
      aria-hidden
    >
      <span className="loader-shimmer pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-[#fffdf8]/70 to-transparent [animation:loader-shimmer_2.4s_ease-in-out_infinite]" />
      <span className="relative mb-3.5 block h-10 w-[70px] rotate-[-4deg] rounded-[3px] border border-[#d9cfc0] bg-[#e5ded3]" />
      <span className="relative mb-2.5 block h-[25px] w-[25px] rounded-full bg-[#e5ded3]" />
      <span className="relative mb-2.5 block h-[13px] w-[91%] rounded-[3px] bg-[#e5ded3]" />
      <span className="relative mb-1.5 block h-[7px] w-[94%] rounded-[3px] bg-[#e5ded3]" />
      <span className="relative mb-3.5 block h-[7px] w-[65%] rounded-[3px] bg-[#e5ded3]" />
      <span className="relative mt-auto flex gap-1.5">
        <i className="block h-[18px] w-10 rounded-[3px] bg-[#e5ded3]" />
        <i className="block h-[18px] w-12 rounded-[3px] bg-[#e5ded3]" />
      </span>
    </div>
  );
}

/** Placeholder game grid with paper shimmer (spec §03). */
export function GamesSkeleton({ count = 6 }: { count?: number }) {
  const tilts = [-1.2, 0.8, -0.6, 1.4, -1, 0.5];
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="w-full">
      <p className="sr-only">Loading games…</p>
      <GameTable>
        {Array.from({ length: count }, (_, i) => (
          <SkeletonCard key={i} tilt={tilts[i % tilts.length]} />
        ))}
      </GameTable>
    </div>
  );
}
