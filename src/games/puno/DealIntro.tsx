"use client";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sticker } from "@/components/paper/Paper";
import { preloadSfx } from "@/lib/sfx";
import type { Player } from "@/lib/types";
import { CardBack } from "./Cards";
import { DEAL_MS } from "./shared";

const SHUFFLE_MS = 1300;
const DEAL_START = 1400;
const DEAL_END = DEAL_MS - 450;
const HAND = 7;

type Seat = { id: string; x: number; y: number; me: boolean };

/** Where each player sits around the table, in % of the screen: others along the top, you at the bottom. */
function layout(seatIds: string[], meId: string | null): Seat[] {
  const others = seatIds.filter((id) => id !== meId);
  const out: Seat[] = others.map((id, i) => {
    const t = others.length === 1 ? 0 : (i / (others.length - 1)) * 2 - 1;
    return { id, x: 50 + t * 38, y: 15 + Math.abs(t) * 7, me: false };
  });
  if (meId && seatIds.includes(meId)) out.push({ id: meId, x: 50, y: 84, me: true });
  return out;
}

/**
 * Opening of a Puno game: the deck is riffle-shuffled, then seven cards are dealt
 * round the table, one to each player per round.
 */
export function DealIntro({
  seatIds,
  players,
  meId,
  big = false,
  onSound,
  onDone,
}: {
  seatIds: string[];
  players: Player[];
  meId: string | null;
  big?: boolean;
  onSound: (s: "shuffle" | "deal") => void;
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  const seats = useMemo(() => layout(seatIds, meId), [seatIds, meId]);
  const order = useMemo(() => {
    // Deal starts with the player after the dealer, like at a real table.
    const ids = seatIds.length ? [...seatIds.slice(1), seatIds[0]] : [];
    return ids.map((id) => seats.find((s) => s.id === id)).filter((s): s is Seat => !!s);
  }, [seatIds, seats]);
  const total = order.length * HAND;
  const gap = total ? (DEAL_END - DEAL_START - 350) / total : 0;
  const [elapsed, setElapsed] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const soundRef = useRef(onSound);
  soundRef.current = onSound;

  useEffect(() => {
    preloadSfx(["shuffle", "deal"]);
    const start = performance.now();
    soundRef.current("shuffle");
    let lastDealSound = 0;
    let raf = 0;
    const step = () => {
      const t = performance.now() - start;
      setElapsed(t);
      // A soft tick as cards go out, at most every 160ms so it sounds like dealing, not a buzz.
      if (!reduce && t > DEAL_START && t < DEAL_END && t - lastDealSound > 160) {
        lastDealSound = t;
        soundRef.current("deal");
      }
      if (t >= (reduce ? 1200 : DEAL_MS)) {
        doneRef.current();
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  const dealt = (seatIdx: number) => {
    if (reduce) return elapsed > 300 ? HAND : 0;
    const t = elapsed - DEAL_START - 350;
    if (t < 0) return 0;
    const done = Math.floor(t / gap) + 1;
    const rounds = Math.floor(done / order.length) + (done % order.length > seatIdx ? 1 : 0);
    return Math.min(HAND, rounds);
  };

  const card = big ? "pile" : "small";
  const label = elapsed < DEAL_START ? "Patte phent rahe hain…" : "Patte baant rahe hain…";

  return (
    <motion.div
      role="status"
      aria-label="Patte baante ja rahe hain"
      className="fixed inset-0 z-[480] overflow-hidden bg-bg-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: elapsed > DEAL_MS - 300 ? 0 : 1 }}
      transition={{ duration: 0.25 }}
      style={{
        backgroundImage:
          "linear-gradient(color-mix(in srgb, var(--ink) 8%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--ink) 8%, transparent) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    >
      {seats.map((s) => {
        const p = players.find((x) => x.id === s.id);
        const idx = order.findIndex((o) => o.id === s.id);
        const n = dealt(idx);
        return (
          <div key={s.id} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
            <Sticker id={p?.avatar} size={big ? 72 : s.me ? 52 : 40} />
            <span className={`max-w-[6rem] truncate font-display font-extrabold uppercase ${big ? "text-2xl" : "text-[11px]"}`}>{s.me ? "Aap" : (p?.name ?? "…")}</span>
            <span className={`rounded-full border-[2px] border-ink bg-paper px-2 font-display font-extrabold tabular-nums ${big ? "text-xl" : "text-[11px]"}`}>{n}</span>
          </div>
        );
      })}

      {/* Deck, riffle-shuffled: two halves split and fall back together, twice. */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {[-1, 1].map((side) => (
          <motion.div
            key={side}
            className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2"
            animate={
              reduce
                ? undefined
                : {
                    x: [0, side * (big ? 90 : 54), side * (big ? 90 : 54), 0, side * (big ? 90 : 54), side * (big ? 90 : 54), 0],
                    rotate: [0, side * 9, side * 9, 0, side * 9, side * 9, 0],
                    y: [0, -6, -6, 0, -6, -6, 0],
                  }
            }
            transition={{ duration: SHUFFLE_MS / 1000, times: [0, 0.18, 0.4, 0.5, 0.68, 0.9, 1], ease: "easeInOut" }}
            style={{ zIndex: side === 1 ? 2 : 1 }}
          >
            {[2, 1, 0].map((k) => (
              <div key={k} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: k * 2, top: -k * 2 }}>
                <CardBack size={card} />
              </div>
            ))}
          </motion.div>
        ))}
      </div>

      {/* Cards going out, one per player per round. */}
      {!reduce &&
        order.flatMap((s, seatIdx) =>
          Array.from({ length: HAND }, (_, round) => {
            const i = round * order.length + seatIdx;
            const delay = (DEAL_START + i * gap) / 1000;
            return (
              <motion.div
                key={`${s.id}-${round}`}
                className="pointer-events-none absolute left-1/2 top-1/2"
                initial={{ x: "-50%", y: "-50%", opacity: 0, rotate: 0 }}
                animate={{
                  left: ["50%", `${s.x}%`],
                  top: ["50%", `${s.y}%`],
                  opacity: [1, 1, 0],
                  rotate: [0, (seatIdx % 2 ? 1 : -1) * (160 + round * 9)],
                  scale: [1, s.me ? 0.9 : 0.6],
                }}
                transition={{ delay, duration: 0.42, ease: [0.2, 0.8, 0.3, 1], opacity: { delay, duration: 0.42, times: [0, 0.85, 1] } }}
              >
                <CardBack size={card} />
              </motion.div>
            );
          }),
        )}

      <p className={`absolute inset-x-0 text-center font-display font-extrabold uppercase tracking-wider text-ink/70 ${big ? "top-[64%] text-3xl" : "top-[63%] text-xs"}`}>{label}</p>
    </motion.div>
  );
}
