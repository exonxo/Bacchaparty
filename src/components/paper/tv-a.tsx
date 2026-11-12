"use client";
/**
 * Building blocks for the paper big-screen (TV / laptop) views.
 * Sized with viewport units so one layout reads from 2–3 metres at both
 * 1280×720 and 1920×1080, and never scrolls.
 */
import { MotionConfig, animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Player } from "@/lib/types";
import { CountUp, Sticker } from "./Paper";
import { dur, ease, spring } from "./motion";
import { InkDefs } from "./objects";

/** Height left for the game under the TV page's header and title. */
const STAGE_H = "h-[calc(100dvh-11rem)] min-h-[30rem]";

/** Fluid type steps for the TV, from far-away labels to hero numbers. */
export const tv = {
  label: "text-[clamp(0.85rem,1.9vh,1.35rem)] font-bold uppercase tracking-[0.18em]",
  body: "text-[clamp(1.05rem,2.6vh,1.9rem)]",
  lead: "text-[clamp(1.35rem,3.4vh,2.6rem)]",
  title: "text-[clamp(2rem,5.6vh,4.4rem)] leading-[1.02]",
  hero: "text-[clamp(3.2rem,10vh,8.5rem)] leading-[0.95]",
  giant: "text-[clamp(4rem,14vh,12rem)] leading-[0.92]",
} as const;

/** A number that counts up from whatever it showed before (instant with reduced motion). */
export function TvNumber({ value, className = "" }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const prev = useRef(value);
  const [n, setN] = useState(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (reduce || from === value) {
      setN(value);
      return;
    }
    const c = animate(from, value, { duration: dur.count, ease: ease.expo, onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [value, reduce]);
  return <span className={`tabular-nums ${className}`}>{n}</span>;
}

/** The whole TV game area: fills the screen below the header, never scrolls. */
export function TvStage({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <MotionConfig reducedMotion="user">
      <InkDefs />
      <div className={`${STAGE_H} grid gap-[2.4vh] overflow-hidden ${className}`} style={style}>
        {children}
      </div>
    </MotionConfig>
  );
}

/** A cut-paper card. */
export function TvCard({ children, className = "", style, tilt = 0 }: { children: ReactNode; className?: string; style?: CSSProperties; tilt?: number }) {
  return (
    <div className={`cut relative min-h-0 overflow-hidden rounded-soft bg-card p-[2.2vh] ${className}`} style={{ ...style, transform: tilt ? `rotate(${tilt}deg)` : undefined }}>
      {children}
    </div>
  );
}

export function TvLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${tv.label} text-ink/65 ${className}`}>{children}</div>;
}

export function mmss(secs: number) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

/**
 * A big countdown everyone in the room can read: number plus a shrinking bar.
 * Red in the last `urgentAt` seconds. `paused` greys it out.
 */
export function TvTimer({
  deadline,
  total,
  now,
  label,
  urgentAt = 5,
  format = "s",
  paused = false,
  color = "var(--turmeric)",
  className = "",
  onDark = false,
}: {
  deadline: number | null;
  total: number;
  now: number;
  label: string;
  urgentAt?: number;
  format?: "s" | "mmss";
  paused?: boolean;
  color?: string;
  className?: string;
  /** Cream text and outline, for use on a dark paper card. */
  onDark?: boolean;
}) {
  const msLeft = deadline ? Math.max(0, deadline - now) : 0;
  const secs = Math.ceil(msLeft / 1000);
  const urgent = !paused && !!deadline && secs <= urgentAt;
  const pct = !deadline || paused ? 100 : Math.min(100, (msLeft / Math.max(1, total)) * 100);
  return (
    <div role="timer" aria-label={paused ? `${label}: paused` : `${label}: ${secs} seconds`} className={`flex items-center gap-[1.6vw] ${className}`}>
      <div className="min-w-0 flex-1">
        <TvLabel className={onDark ? "!text-[#fffdf8]/80" : ""}>{paused ? "Ruka hua hai" : label}</TvLabel>
        <div className={`mt-[1vh] h-[1.4vh] min-h-2 overflow-hidden rounded-full border-[1.5px] ${onDark ? "border-[#fffdf8]/70 bg-black/25" : "border-ink bg-paper"}`}>
          <div
            className="h-full"
            style={{ width: `${pct}%`, background: urgent ? "var(--vermilion)" : color, opacity: paused ? 0.35 : 1, transition: "width 0.25s linear, background-color 0.2s" }}
          />
        </div>
      </div>
      <motion.span
        key={urgent ? `u${secs}` : "n"}
        initial={urgent ? { scale: 1.25 } : false}
        animate={{ scale: 1 }}
        transition={spring.settle}
        className={`font-display shrink-0 font-extrabold tabular-nums ${tv.title} ${urgent ? (onDark ? "text-[#ff8b73]" : "text-vermilion") : onDark ? "text-[#fffdf8]" : ""}`}
      >
        {!deadline || paused ? "–" : format === "mmss" ? mmss(secs) : secs}
      </motion.span>
    </div>
  );
}

export interface TvRow {
  p: Player;
  s: number;
  /** Points just won, shown as a small badge. */
  gain?: number;
  sub?: ReactNode;
  highlight?: boolean;
}

export function rankRows(players: Player[], scores: Record<string, number>, ids?: string[]): TvRow[] {
  const list = ids ? (ids.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[]) : players.filter((p) => p.id in scores);
  return list.map((p) => ({ p, s: scores[p.id] ?? 0 })).sort((a, b) => b.s - a.s);
}

/** Leaderboard on ruled paper; rows slide into their new order. */
export function TvBoard({
  rows,
  title = "Points",
  max = 8,
  className = "",
  size = "md",
}: {
  rows: TvRow[];
  title?: string;
  max?: number;
  className?: string;
  size?: "md" | "lg";
}) {
  const shown = rows.slice(0, max);
  const lg = size === "lg";
  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <TvLabel className="mb-[1vh]">{title}</TvLabel>
      <ol className="min-h-0 flex-1 overflow-hidden">
        {shown.map((r, i) => (
          <motion.li
            key={r.p.id}
            layout
            transition={spring.select}
            className={`flex items-center gap-[0.9vw] border-t-[1.5px] border-line ${lg ? "py-[1.5vh]" : "py-[0.9vh]"} ${r.highlight ? "font-extrabold" : ""} ${r.p.connected ? "" : "opacity-50"}`}
          >
            <span className={`font-display w-[1.8em] shrink-0 text-right font-extrabold tabular-nums text-ink/50 ${tv.body}`}>{i + 1}</span>
            <Sticker id={r.p.avatar} size={lg ? 54 : 36} />
            <span className={`min-w-0 flex-1 truncate font-bold ${lg ? tv.lead : tv.body}`}>
              {r.p.name}
              {r.sub && <span className="ml-2 font-semibold text-ink/60">{r.sub}</span>}
            </span>
            {!!r.gain && (
              <motion.span
                initial={{ scale: 0, rotate: -12 }}
                animate={{ scale: 1, rotate: -4 }}
                transition={{ ...spring.settle, delay: 0.5 }}
                className={`font-display rounded-cut border-[1.5px] border-ink bg-leaf px-[0.45em] font-extrabold text-paper ${lg ? tv.lead : tv.body}`}
              >
                +{r.gain}
              </motion.span>
            )}
            <TvNumber value={r.s} className={`font-display w-[2.4em] shrink-0 text-right font-extrabold ${lg ? tv.title : tv.lead}`} />
          </motion.li>
        ))}
      </ol>
      {rows.length > max && <div className={`pt-[0.6vh] text-ink/55 ${tv.body}`}>+{rows.length - max} aur</div>}
    </div>
  );
}

function Crown({ size = 54 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size * 0.63} viewBox="0 0 38 24">
      <path d="M3 21 L1 6 L11 13 L19 2 L27 13 L37 6 L35 21 Z" fill="#f2b632" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="19" cy="15" r="2" fill="var(--vermilion)" stroke="var(--ink)" strokeWidth="1" />
    </svg>
  );
}

/** Final podium for the TV: 3rd, 2nd, then 1st rise in turn. */
export function TvPodium({ rows, color = "var(--turmeric)", className = "" }: { rows: TvRow[]; color?: string; className?: string }) {
  // Only people who scored stand on the podium.
  const top = rows.filter((r) => r.s > 0).slice(0, 3);
  if (!top.length)
    return (
      <div className={`flex min-h-0 items-center justify-center text-ink/60 ${tv.lead} ${className}`}>Is baar kisi ke points nahi bane.</div>
    );
  const slots = [
    { r: top[1], place: 2, h: "50%", delay: 0.75, bg: "var(--paper)" },
    { r: top[0], place: 1, h: "66%", delay: 1.3, bg: color },
    { r: top[2], place: 3, h: "36%", delay: 0.2, bg: "var(--paper)" },
  ];
  return (
    <div className={`flex min-h-0 items-end justify-center gap-[1.4vw] border-b-[1.5px] border-ink ${className}`}>
      {slots.map(({ r, place, h, delay, bg }) =>
        r ? (
          <div key={r.p.id} className="flex h-full w-[28%] max-w-[22rem] flex-col justify-end">
            <motion.div
              className="flex h-full flex-col items-center justify-end"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ y: { ...spring.settle, delay }, opacity: { duration: 0.15, delay } }}
            >
              {place === 1 && <Crown />}
              <Sticker id={r.p.avatar} size={place === 1 ? 84 : 66} tilt={place === 1 ? -5 : place === 2 ? 4 : -3} />
              <div className={`mt-[0.6vh] w-full truncate text-center font-bold ${tv.lead}`}>{r.p.name}</div>
              <div
                className="paper-rule mt-[0.8vh] flex w-full flex-col items-center rounded-t-cut border-[1.5px] border-b-0 border-ink pt-[1vh]"
                style={{ height: h, background: bg, boxShadow: "3px 0 0 0 var(--ink)" }}
              >
                <CountUp from={0} to={r.s} delay={delay + 0.2} className={`font-display font-extrabold ${tv.title}`} />
                <span className={`${tv.label} text-ink/60`}>{place === 1 ? "1st" : place === 2 ? "2nd" : "3rd"}</span>
              </div>
            </motion.div>
          </div>
        ) : (
          <div key={place} className="w-[28%] max-w-[22rem]" />
        ),
      )}
    </div>
  );
}

/** A row of player stickers with a one-word status under each. */
export function TvPeople({
  people,
  status,
  size = 64,
  className = "",
}: {
  people: Player[];
  status: (p: Player) => { text: string; done?: boolean; tone?: "leaf" | "ink" | "vermilion" };
  size?: number;
  className?: string;
}) {
  return (
    <ul className={`flex flex-wrap content-start gap-x-[1.6vw] gap-y-[1.6vh] ${className}`}>
      {people.map((p, i) => {
        const st = status(p);
        return (
          <motion.li
            key={p.id}
            layout
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: p.connected ? 1 : 0.45, y: 0 }}
            transition={{ ...spring.select, delay: Math.min(i * 0.04, 0.3) }}
            className="flex w-[clamp(5.5rem,9vw,9rem)] flex-col items-center text-center"
          >
            <span className={st.done ? "" : "opacity-70"} style={{ filter: st.done ? undefined : "grayscale(0.35)" }}>
              <Sticker id={p.avatar} size={size} tilt={st.done ? (i % 2 ? 4 : -4) : 0} />
            </span>
            <span className={`mt-[0.6vh] w-full truncate font-bold ${tv.body}`}>{p.name}</span>
            <span
              className="w-full text-[clamp(0.8rem,1.8vh,1.25rem)] font-bold leading-tight"
              style={{ color: st.tone === "leaf" ? "var(--leaf)" : st.tone === "vermilion" ? "var(--vermilion)" : "color-mix(in srgb, var(--ink) 60%, transparent)" }}
            >
              {st.text}
            </span>
          </motion.li>
        );
      })}
    </ul>
  );
}
