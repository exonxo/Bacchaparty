"use client";
/**
 * Shared pieces for the paper TV (big-screen) views of Raja Mantri, Odd Word
 * Out, Ludo Yatra and Jaldi Bolo. Sized for a TV or laptop seen from 2–3 m:
 * the frame fills the space under the TV page's header without scrolling at
 * 1280×720 and 1920×1080, and type scales with the screen height.
 */
import { LayoutGroup, motion } from "motion/react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Player } from "@/lib/types";
import { spring } from "./motion";
import { CountUp, Sticker } from "./Paper";

/** Type scale for the TV, in screen-height units so 720p and 1080p both read from the sofa. */
export const tv = {
  label: "font-bold uppercase tracking-[0.18em] text-muted text-[clamp(0.85rem,1.9vh,1.3rem)]",
  lead: "text-[clamp(1.2rem,3vh,2.1rem)] leading-snug",
  title: "font-display font-extrabold leading-[1.02] text-[clamp(2rem,5vh,3.75rem)]",
  headline: "font-display font-extrabold leading-[0.98] text-[clamp(2.75rem,7.5vh,5.75rem)]",
  big: "font-display font-extrabold leading-none text-[clamp(4.5rem,17vh,10rem)]",
};

/** Height the TV page leaves for a game under its header and title. */
const FRAME_H = "calc(100dvh - 11rem)";

/**
 * The whole TV view: a main stage and an optional side column (usually the
 * leaderboard). Fixed to the screen height so nothing scrolls.
 */
export function TvFrame({ children, side, sideWidth = "clamp(16rem,25vw,28rem)" }: { children: ReactNode; side?: ReactNode; sideWidth?: string }) {
  return (
    <div
      className="grid min-h-[26rem] gap-[clamp(1rem,2vw,2rem)] overflow-hidden"
      style={{ height: FRAME_H, gridTemplateColumns: side ? `minmax(0,1fr) ${sideWidth}` : "minmax(0,1fr)" }}
    >
      <div className="relative flex min-h-0 min-w-0 flex-col">{children}</div>
      {side && <aside className="flex min-h-0 min-w-0 flex-col">{side}</aside>}
    </div>
  );
}

/** A cut-paper card. */
export function TvCard({ children, className = "", style, tilt = 0 }: { children: ReactNode; className?: string; style?: CSSProperties; tilt?: number }) {
  return (
    <div className={`cut rounded-soft bg-paper ${className}`} style={{ ...style, rotate: tilt ? `${tilt}deg` : undefined }}>
      {children}
    </div>
  );
}

/** Seconds left on a game-clock deadline. */
export function secondsLeft(deadline: number | null | undefined, now: number) {
  return deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
}

/**
 * A countdown everyone in the room can read: a big number and a shrinking bar.
 * Red in the last 5 seconds.
 */
export function TvTimer({ deadline, total, now, label, paused = false, compact = false }: { deadline: number | null; total: number; now: number; label: string; paused?: boolean; compact?: boolean }) {
  const left = deadline ? Math.max(0, deadline - now) : 0;
  const secs = Math.ceil(left / 1000);
  const urgent = !paused && secs <= 5;
  const frac = total > 0 ? Math.min(1, left / total) : 0;
  return (
    <div role="timer" aria-label={paused ? `${label}: ruka hua` : `${label}: ${secs} second`} className="flex items-center gap-[clamp(0.75rem,1.5vw,1.5rem)]">
      <div className="min-w-0 flex-1">
        <div className={tv.label}>{paused ? `${label} · ruka hua` : label}</div>
        <div className="mt-2 h-[clamp(0.6rem,1.4vh,1rem)] overflow-hidden rounded-full border-[1.5px] border-ink bg-paper">
          <div className="h-full" style={{ width: `${frac * 100}%`, background: urgent ? "var(--vermilion)" : "var(--ink)", transition: "width 0.25s linear, background-color 0.2s" }} />
        </div>
      </div>
      <span
        className={`font-display shrink-0 text-right font-extrabold tabular-nums leading-none ${compact ? "text-[clamp(2.25rem,6vh,4.5rem)]" : "text-[clamp(3rem,9vh,6.5rem)]"}`}
        style={{ color: urgent ? "var(--vermilion)" : undefined, minWidth: "2ch" }}
      >
        {secs}
      </span>
    </div>
  );
}

/**
 * Leaderboard for the side column. Rows re-sort with a layout animation when
 * scores change; `gains` shows this round's points as a "+N" tag.
 */
export function TvLeaderboard({
  players,
  scores,
  ids,
  title = "Points",
  gains,
  highlight,
  maxRows = 8,
  unit,
}: {
  players: Player[];
  scores: Record<string, number>;
  /** Who to list (defaults to everyone with a score). */
  ids?: string[];
  title?: string;
  gains?: Record<string, number>;
  highlight?: string | null;
  maxRows?: number;
  unit?: string;
}) {
  const list = (ids ?? Object.keys(scores))
    .map((id) => ({ id, p: players.find((x) => x.id === id), s: scores[id] ?? 0 }))
    .sort((a, b) => b.s - a.s);
  const k = useTvScale();
  const shown = list.slice(0, maxRows);
  const more = list.length - shown.length;
  return (
    <TvCard className="flex min-h-0 flex-1 flex-col p-[clamp(0.9rem,2vh,1.6rem)]">
      <div className={tv.label}>{title}</div>
      <LayoutGroup>
        <ol className="mt-[clamp(0.5rem,1.5vh,1rem)] flex min-h-0 flex-1 flex-col justify-start gap-[clamp(0.25rem,0.9vh,0.6rem)] overflow-hidden">
          {shown.map(({ id, p, s }, i) => (
            <motion.li
              key={id}
              layout
              transition={spring.select}
              className={`flex items-center gap-[clamp(0.5rem,1vw,0.9rem)] rounded-cut px-2 py-[clamp(0.15rem,0.6vh,0.45rem)] ${id === highlight ? "bg-turmeric" : ""} ${
                p && !p.connected ? "opacity-45" : ""
              }`}
            >
              <span className="font-display w-[1.6ch] shrink-0 text-[clamp(1rem,2.6vh,1.75rem)] font-extrabold text-muted">{i + 1}</span>
              <Sticker id={p?.avatar} size={Math.round(48 * k)} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[clamp(1.05rem,2.7vh,1.85rem)] font-bold">{p?.name ?? "Koi"}</span>
                {gains && (gains[id] ?? 0) > 0 && <span className="block text-[clamp(0.8rem,1.8vh,1.15rem)] font-bold text-leaf">+{gains[id]} is round</span>}
              </span>
              <CountUp from={s - (gains?.[id] ?? 0)} to={s} className="font-display shrink-0 text-[clamp(1.3rem,3.4vh,2.4rem)] font-extrabold" />
              {unit && <span className="shrink-0 text-[clamp(0.8rem,1.8vh,1.1rem)] text-muted">{unit}</span>}
            </motion.li>
          ))}
        </ol>
      </LayoutGroup>
      {more > 0 && <div className="mt-1 text-[clamp(0.9rem,2vh,1.2rem)] text-muted">+{more} aur</div>}
    </TvCard>
  );
}

/**
 * Scale factor for drawn things (stickers, objects) that take pixel sizes:
 * 1 at 1080p, about 0.67 at 720p.
 */
export function useTvScale(): number {
  const [k, setK] = useState(1);
  useEffect(() => {
    const read = () => setK(Math.min(1.4, Math.max(0.6, window.innerHeight / 1080)));
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return k;
}

/** A big player sticker with a name and a small status line under it. */
export function TvPerson({ player, size = "md", status, ring = false, dim = false }: { player: Player | undefined; size?: "sm" | "md" | "lg"; status?: ReactNode; ring?: boolean; dim?: boolean }) {
  const k = useTvScale();
  const px = Math.round((size === "lg" ? 140 : size === "md" ? 88 : 60) * k);
  const nameCls = size === "lg" ? "text-[clamp(1.6rem,4.2vh,3rem)]" : size === "md" ? "text-[clamp(1.1rem,2.8vh,1.9rem)]" : "text-[clamp(0.95rem,2.2vh,1.4rem)]";
  return (
    <div className={`flex min-w-0 flex-col items-center text-center ${dim ? "opacity-45" : ""}`}>
      <span className={`rounded-full ${ring ? "outline outline-[3px] outline-offset-4 outline-ink" : ""}`}>
        <Sticker id={player?.avatar} size={px} />
      </span>
      <span className={`mt-[clamp(0.3rem,1vh,0.6rem)] max-w-full truncate font-bold ${nameCls}`}>{player?.name ?? "Koi"}</span>
      {status && <span className="text-[clamp(0.85rem,2vh,1.25rem)] text-muted">{status}</span>}
    </div>
  );
}

/** A row of TvPerson. */
export function TvPeople({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-start justify-center gap-[clamp(0.75rem,2vw,2rem)] ${className}`}>{children}</div>;
}
