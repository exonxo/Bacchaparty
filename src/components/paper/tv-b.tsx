"use client";
/**
 * Shared pieces for the paper big-screen (TV) views of Antakshari, Sound Guru,
 * Draw & Guess and Kaun Banega Champion. Built to be read from 2–3 metres on a
 * 16:9 screen: the frame fills the space under the TV header with no scrolling,
 * type scales with the screen height, and everything shown is public.
 */
import { LayoutGroup, MotionConfig, motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import type { Player } from "@/lib/types";
import { CountUp, Sticker } from "./Paper";
import { dur, ease, spring, staggerDelay } from "./motion";

/** Stage on the left, a rail (timer, scores) on the right; exactly fills the screen under the TV header. */
export function TvFrame({ stage, rail, railWidth = "clamp(17rem, 24vw, 30rem)" }: { stage: ReactNode; rail?: ReactNode; railWidth?: string }) {
  return (
    <MotionConfig reducedMotion="user">
      <div
        className="grid gap-[2.2vh] overflow-hidden px-1 pt-[2.2vh]"
        style={{ height: "calc(100dvh - 11rem)", minHeight: "26rem", gridTemplateColumns: rail ? `minmax(0,1fr) ${railWidth}` : "minmax(0,1fr)" }}
      >
        <div className="flex min-h-0 min-w-0 flex-col">{stage}</div>
        {rail && <aside className="flex min-h-0 min-w-0 flex-col gap-[2vh]">{rail}</aside>}
      </div>
    </MotionConfig>
  );
}

/** Small spaced-out label above a block. */
export function TvLabel({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`font-bold uppercase tracking-[0.2em] text-muted ${className}`} style={{ fontSize: "clamp(0.85rem, 1.9vh, 1.25rem)", ...style }}>
      {children}
    </div>
  );
}

/** Seconds left from a host-clock deadline, or from a paused remainder. */
export function secsLeft(now: number, deadline: number | null, pausedLeft: number | null = null): number | null {
  if (pausedLeft !== null) return Math.ceil(pausedLeft / 1000);
  if (deadline === null) return null;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/**
 * The big countdown everyone in the room reads: a huge number plus a draining
 * bar. Red with a tick for the last five seconds.
 */
export function TvTimer({
  now,
  deadline,
  pausedLeft = null,
  totalSeconds,
  label,
  color = "var(--ink)",
}: {
  now: number;
  deadline: number | null;
  pausedLeft?: number | null;
  totalSeconds: number;
  label: string;
  color?: string;
}) {
  const sfx = useSfx();
  const paused = pausedLeft !== null;
  const secs = secsLeft(now, deadline, pausedLeft);
  const msLeft = paused ? pausedLeft! : deadline !== null ? Math.max(0, deadline - now) : 0;
  const frac = totalSeconds > 0 ? Math.max(0, Math.min(1, msLeft / (totalSeconds * 1000))) : 0;
  const urgent = !paused && secs !== null && secs <= 5;
  useOnChange(secs, (n, p) => {
    if (!paused && n !== null && p !== null && n < p && n <= 5 && n > 0) sfx.shared("tick");
  });
  if (secs === null) return null;
  return (
    <section
      role="timer"
      aria-label={paused ? `${label}: paused with ${secs} seconds left` : `${label}: ${secs} seconds left`}
      className="cut rounded-soft bg-card px-[2vh] py-[1.6vh]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <TvLabel>{paused ? "Ruka hua" : label}</TvLabel>
        <span
          className={`font-display font-extrabold leading-none tabular-nums ${urgent ? "text-vermilion" : ""}`}
          style={{ fontSize: "clamp(3rem, 9vh, 7rem)" }}
        >
          {secs}
          <span style={{ fontSize: "0.45em" }}>s</span>
        </span>
      </div>
      <div className="mt-[1vh] h-[1.6vh] min-h-3 overflow-hidden rounded-full border-[1.5px] border-ink bg-paper">
        <div
          className={urgent ? "h-full bg-vermilion" : "h-full"}
          style={{ width: `${frac * 100}%`, background: urgent ? undefined : color, transition: paused ? "none" : "width 0.25s linear", opacity: paused ? 0.4 : 1 }}
        />
      </div>
    </section>
  );
}

export interface BoardRow {
  p: Player;
  score: number;
  /** Small line under the name, e.g. "+3 is round mein". */
  note?: ReactNode;
  /** Highlighted row (whose turn it is). */
  active?: boolean;
}

/** Ranked scoreboard; rows slide into their new order when scores change. */
export function TvBoard({ title = "Points", rows, max = 8, accent = "var(--turmeric)" }: { title?: string; rows: BoardRow[]; max?: number; accent?: string }) {
  const sorted = [...rows].sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name)).slice(0, max);
  return (
    <section aria-label={title} className="cut flex min-h-0 flex-1 flex-col overflow-hidden rounded-soft bg-card px-[2vh] py-[1.6vh]">
      <TvLabel>{title}</TvLabel>
      <LayoutGroup>
        <ol className="mt-[1vh] flex min-h-0 flex-1 flex-col gap-[0.8vh] overflow-hidden">
          {sorted.map(({ p, score, note, active }, i) => (
            <motion.li
              key={p.id}
              layout
              transition={spring.settle}
              className="flex items-center gap-[1.2vh] rounded-cut px-[1vh] py-[0.6vh]"
              style={{ background: active ? accent : undefined, opacity: p.connected ? 1 : 0.5, boxShadow: active ? "2px 2px 0 0 var(--ink)" : undefined, border: active ? "1.5px solid var(--ink)" : "1.5px solid transparent" }}
            >
              <span className="font-display w-[2.4vh] shrink-0 text-right font-extrabold text-muted tabular-nums" style={{ fontSize: "clamp(0.9rem, 2.2vh, 1.4rem)" }}>
                {i + 1}
              </span>
              <Sticker id={p.avatar} size={Math.round(Math.max(30, Math.min(52, typeof window === "undefined" ? 40 : window.innerHeight * 0.05)))} />
              <span className="min-w-0 flex-1">
                <span className="font-display block truncate font-extrabold leading-tight" style={{ fontSize: "clamp(1.05rem, 2.8vh, 1.9rem)" }}>
                  {p.name}
                </span>
                {note && (
                  <span className="block truncate font-semibold text-muted" style={{ fontSize: "clamp(0.8rem, 1.8vh, 1.15rem)" }}>
                    {note}
                  </span>
                )}
              </span>
              <span className="font-display font-extrabold tabular-nums" style={{ fontSize: "clamp(1.5rem, 4vh, 2.8rem)" }}>
                {score}
              </span>
            </motion.li>
          ))}
        </ol>
      </LayoutGroup>
    </section>
  );
}

/** A row of player stickers with names, used for "who has guessed / voted". */
export function TvStickers({ players, mark, size = 64 }: { players: Player[]; mark?: (p: Player) => ReactNode; size?: number }) {
  return (
    <ul className="flex flex-wrap justify-center gap-x-[2.4vh] gap-y-[1.6vh]">
      {players.map((p, i) => (
        <motion.li
          key={p.id}
          initial={{ opacity: 0, y: -14, scale: 0.7 }}
          animate={{ opacity: p.connected ? 1 : 0.45, y: 0, scale: 1, transition: { ...spring.settle, delay: staggerDelay(i) } }}
          className="relative flex flex-col items-center gap-[0.6vh]"
        >
          <Sticker id={p.avatar} size={size} tilt={[-4, 3, -2, 5][i % 4]} />
          <span className="font-display max-w-[12vw] truncate font-extrabold" style={{ fontSize: "clamp(0.95rem, 2.3vh, 1.5rem)" }}>
            {p.name}
          </span>
          {mark?.(p)}
        </motion.li>
      ))}
    </ul>
  );
}

/** End of game: 2nd, 1st, 3rd blocks rise in turn, scores count up, then the winner is named. */
export function TvPodium({
  rows,
  headline,
  accent = "var(--turmeric)",
  note,
}: {
  rows: { p: Player; score: number; sub?: ReactNode }[];
  headline: (winner: Player | null) => ReactNode;
  accent?: string;
  note?: ReactNode;
}) {
  const sorted = [...rows].sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name));
  const top = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  // Visual order 2nd, 1st, 3rd; rise order 3rd, 2nd, 1st.
  const order = [1, 0, 2].filter((i) => top[i]);
  const heights = ["58%", "42%", "30%"];
  const riseDelay = [1.1, 0.6, 0.15];
  const winner = top[0]?.p ?? null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 1.7, duration: dur.screen, ease: ease.out } }}
        className="font-display text-center font-extrabold leading-none text-balance"
        style={{ fontSize: "clamp(2.6rem, 8vh, 6.5rem)" }}
        aria-live="polite"
      >
        {headline(winner)}
      </motion.h1>
      {note && (
        <p className="mt-[1vh] text-center font-semibold text-muted" style={{ fontSize: "clamp(1rem, 2.4vh, 1.6rem)" }}>
          {note}
        </p>
      )}
      <div className="mt-[2vh] grid min-h-0 flex-1 gap-[3vh]" style={{ gridTemplateColumns: rest.length ? "minmax(0,1.6fr) minmax(0,1fr)" : "minmax(0,1fr)" }}>
        <div className="flex min-h-0 items-end justify-center gap-[2.4vh] border-b-[1.5px] border-ink">
          {order.map((i) => {
            const r = top[i];
            return (
              <div key={r.p.id} className="flex h-full w-[min(14rem,30%)] flex-col items-center justify-end">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: riseDelay[i] + 0.3, ...spring.settle } }} className="flex flex-col items-center">
                  {i === 0 && <Crown />}
                  <Sticker id={r.p.avatar} size={i === 0 ? 96 : 76} tilt={i === 0 ? -5 : 4} />
                  <span className="font-display mt-[0.8vh] max-w-full truncate font-extrabold" style={{ fontSize: "clamp(1.1rem, 3vh, 2rem)" }}>
                    {r.p.name}
                  </span>
                  {r.sub && (
                    <span className="max-w-full truncate font-semibold text-muted" style={{ fontSize: "clamp(0.85rem, 1.9vh, 1.2rem)" }}>
                      {r.sub}
                    </span>
                  )}
                </motion.div>
                <motion.div
                  className="cut mt-[1vh] flex w-full flex-col items-center justify-start rounded-t-cut pt-[1.2vh]"
                  style={{ background: i === 0 ? accent : "var(--paper)", transformOrigin: "bottom" }}
                  initial={{ height: 0 }}
                  animate={{ height: heights[i], transition: { delay: riseDelay[i], duration: dur.reveal, ease: ease.expo } }}
                >
                  <CountUp from={0} to={r.score} delay={riseDelay[i] + 0.2} className="font-display font-extrabold leading-none" style={{ fontSize: "clamp(2rem, 6vh, 4.5rem)" }} />
                  <span className="mt-[0.4vh] font-bold uppercase tracking-[0.18em]" style={{ fontSize: "clamp(0.8rem, 1.8vh, 1.15rem)" }}>
                    {["1st", "2nd", "3rd"][i]}
                  </span>
                </motion.div>
              </div>
            );
          })}
        </div>
        {rest.length > 0 && (
          <ol className="flex min-h-0 flex-col justify-end gap-[0.8vh] overflow-hidden">
            {rest.slice(0, 8).map((r, k) => (
              <motion.li
                key={r.p.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0, transition: { delay: 1.9 + staggerDelay(k), duration: dur.screen, ease: ease.out } }}
                className="flex items-center gap-[1.2vh] border-b-[1.5px] border-line py-[0.6vh]"
              >
                <span className="font-display w-[3vh] font-extrabold text-muted" style={{ fontSize: "clamp(0.9rem, 2.2vh, 1.4rem)" }}>
                  {k + 4}
                </span>
                <Sticker id={r.p.avatar} size={40} />
                <span className="font-display min-w-0 flex-1 truncate font-extrabold" style={{ fontSize: "clamp(1rem, 2.6vh, 1.7rem)" }}>
                  {r.p.name}
                </span>
                <span className="font-display font-extrabold tabular-nums" style={{ fontSize: "clamp(1.2rem, 3.2vh, 2.2rem)" }}>
                  {r.score}
                </span>
              </motion.li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Crown() {
  return (
    <svg width="58" height="36" viewBox="0 0 58 36" aria-hidden className="mb-1">
      <path d="M4 32 L8 8 L20 20 L29 4 L38 20 L50 8 L54 32 Z" fill="#f2b632" stroke="#1e1a17" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="29" cy="4" r="3" fill="#c23a22" stroke="#1e1a17" strokeWidth="1.6" />
    </svg>
  );
}

/** A transient result slip (e.g. "Sahi gaana!") that drops in. */
export function TvSlip({ children, tone = "leaf" }: { children: ReactNode; tone?: "leaf" | "vermilion" | "ink" | "turmeric" }) {
  const bg = { leaf: "var(--leaf)", vermilion: "var(--vermilion)", ink: "var(--ink)", turmeric: "var(--turmeric)" }[tone];
  const fg = tone === "turmeric" ? "var(--ink)" : "var(--paper)";
  return (
    <motion.div
      initial={{ opacity: 0, y: -16, rotate: -6, scale: 1.15 }}
      animate={{ opacity: 1, y: 0, rotate: -2, scale: 1, transition: { duration: 0.28, ease: ease.out } }}
      className="cut font-display inline-block rounded-cut px-[2.4vh] py-[1vh] font-extrabold"
      style={{ background: bg, color: fg, fontSize: "clamp(1.4rem, 4vh, 3rem)" }}
      role="status"
    >
      {children}
    </motion.div>
  );
}
