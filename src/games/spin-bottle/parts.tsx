"use client";
import { Flag, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Sticker } from "@/components/paper/Paper";
import type { Player } from "@/lib/types";
import { fillName, type Pub, type Reaction } from "./logic";

export const MAT = "#2f6f5e";
export const KIND_PAPER = {
  truth: { bg: "#8cc8f0", fg: "#1e1a17", label: "SACH", sub: "Truth" },
  dare: { bg: "#e2557a", fg: "#fffdf8", label: "HIMMAT", sub: "Dare" },
} as const;

export const findP = (players: Player[], id: string | null | undefined) => players.find((p) => p.id === id);
export const nameOf = (players: Player[], id: string | null | undefined) => findP(players, id)?.name ?? "Koi";

/** The bottle, drawn in the paper style. Points up at rotation 0. */
export function BottleArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 120" className={className} aria-hidden>
      <path d="M15 4h10v6c0 4 2 7 4 10 5 7 7 12 7 22v64c0 6-4 10-10 10H14c-6 0-10-4-10-10V42c0-10 2-15 7-22 2-3 4-6 4-10z" fill="#3e8e5a" stroke="#1e1a17" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="13.5" y="2" width="13" height="8" rx="2" fill="#f2b632" stroke="#1e1a17" strokeWidth="2.5" />
      <rect x="8" y="58" width="24" height="26" rx="3" fill="#fffdf8" stroke="#1e1a17" strokeWidth="2" />
      <path d="M12 66h16M12 72h11M12 78h14" stroke="#1e1a17" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 46c0-6 2-10 5-14" stroke="#fffdf8" strokeWidth="3" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

/**
 * Players in a circle with the bottle in the middle. The bottle animates from where it last
 * stopped to `rotation`, and the picked player lights up once it stops.
 */
export function BottleCircle({
  view,
  players,
  me,
  size,
  now,
}: {
  view: Pub;
  players: Player[];
  me?: string;
  /** Diameter in px. */
  size: number;
  now: number;
}) {
  const seats = view.n > 0 ? view.seats : players.filter((p) => p.connected).map((p) => p.id);
  const spinning = view.phase === "spinning";
  const landed = view.phase === "choose" || view.phase === "card";
  // Spin length: what's left of the spin when this screen sees it (late joiners don't replay it).
  const msLeft = spinning ? Math.max(0, view.spinEnd - now) : 0;
  const startRef = useRef<{ n: number; ms: number }>({ n: -1, ms: 0 });
  if (startRef.current.n !== view.n) startRef.current = { n: view.n, ms: msLeft };
  const duration = spinning ? Math.max(0.2, startRef.current.ms / 1000) : 0.4;
  const sticker = Math.max(30, Math.min(64, Math.round(size / (seats.length > 10 ? 8 : 6))));
  const radius = size / 2 - sticker * 0.75;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <div className="absolute inset-[8%] rounded-full border-[1.5px] border-dashed border-ink/25" style={{ background: "color-mix(in srgb, #2f6f5e 14%, transparent)" }} />
      {seats.map((id, i) => {
        const a = (i / seats.length) * Math.PI * 2;
        const x = Math.sin(a) * radius;
        const y = -Math.cos(a) * radius;
        const p = findP(players, id);
        const hit = landed && id === view.target;
        return (
          <motion.div
            key={id}
            className="absolute flex flex-col items-center"
            style={{ left: size / 2 + x, top: size / 2 + y, x: "-50%", y: "-50%" }}
            animate={{ scale: hit ? 1.25 : 1, opacity: landed && !hit ? 0.55 : p?.connected === false ? 0.4 : 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
          >
            <span className={`rounded-full ${hit ? "ring-4 ring-turmeric ring-offset-2 ring-offset-bg" : ""}`}>
              <Sticker id={p?.avatar} size={sticker} />
            </span>
            <span className="mt-0.5 max-w-[7ch] truncate rounded-full bg-paper px-1.5 text-[clamp(0.7rem,1.6vh,1.1rem)] font-bold text-ink">
              {id === me ? "Aap" : (p?.name ?? "?")}
            </span>
          </motion.div>
        );
      })}
      <motion.div
        className="absolute left-1/2 top-1/2"
        style={{ width: size * 0.16, height: size * 0.48, x: "-50%", y: "-50%" }}
        initial={false}
        animate={{ rotate: view.rotation }}
        transition={spinning ? { duration, ease: [0.12, 0.6, 0.2, 1] } : { duration: 0 }}
      >
        <BottleArt className="h-full w-full drop-shadow-[2px_3px_0_rgba(30,26,23,0.35)]" />
      </motion.div>
    </div>
  );
}

/** The two-sided card. Flipping turns it over to the alternate prompt. */
export function PromptCard({
  view,
  players,
  big = false,
}: {
  view: Pub;
  players: Player[];
  big?: boolean;
}) {
  if (!view.card || !view.kind) return null;
  const paper = KIND_PAPER[view.kind];
  const text = fillName(view.card.text, findP(players, view.target)?.name);
  return (
    <div style={{ perspective: 1200 }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${view.n}-${view.card.side}-${view.card.text}`}
          className={`cut relative rounded-cut text-center ${big ? "px-[4%] py-[clamp(1.5rem,5vh,3.5rem)]" : "px-4 py-6"}`}
          style={{ background: paper.bg, color: paper.fg }}
          initial={{ rotateY: -90, opacity: 0.4 }}
          animate={{ rotateY: 0, opacity: 1, rotate: view.card.side ? 1.2 : -1.2, transition: { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] } }}
          exit={{ rotateY: 90, opacity: 0.4, transition: { duration: 0.18, ease: [0.6, 0, 1, 0.6] } }}
        >
          <div className={`font-display font-extrabold tracking-[0.2em] ${big ? "text-[clamp(1.2rem,3vh,2rem)]" : "text-p-body"}`}>
            {paper.label} <span className="font-semibold tracking-normal opacity-75">· {paper.sub}</span>
            {view.card.flipped && <span className="ml-2 rounded-full border border-current px-2 py-0.5 text-[0.7em] tracking-normal">side {view.card.side === 0 ? "A" : "B"}</span>}
          </div>
          {view.card.social && (
            <div className={`mx-auto mt-2 w-fit rounded-full bg-ink px-3 py-0.5 font-bold text-paper ${big ? "text-[clamp(1rem,2.4vh,1.5rem)]" : "text-p-note"}`}>📱 Social dare · rare!</div>
          )}
          <p className={`font-display mt-3 font-extrabold leading-snug ${big ? "text-[clamp(2rem,6vh,4.5rem)]" : "text-p-title"}`}>{text}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Floating emoji reactions from the room. */
export function ReactionFloat({ reactions, players, big = false }: { reactions: Reaction[]; players: Player[]; big?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-full overflow-hidden">
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.div
            key={r.id}
            className="absolute bottom-2 flex flex-col items-center"
            style={{ left: `${10 + ((r.id * 37) % 80)}%` }}
            initial={{ y: 20, opacity: 0, scale: 0.6 }}
            animate={{ y: big ? -260 : -140, opacity: [0, 1, 1, 0], scale: 1, transition: { duration: 2.8, ease: "easeOut" } }}
            exit={{ opacity: 0 }}
          >
            <span className={big ? "text-[clamp(2.5rem,7vh,5rem)]" : "text-4xl"}>{r.emoji}</span>
            <span className="rounded-full bg-paper px-2 text-xs font-bold text-ink">{nameOf(players, r.from)}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Small "report this card" control with a confirm tap. */
export function ReportButton({ onReport }: { onReport: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-p-note font-semibold text-muted underline-offset-2 hover:underline"
      onClick={() => {
        if (armed) {
          onReport();
          setArmed(false);
        } else setArmed(true);
      }}
    >
      {armed ? <RefreshCw className="h-4 w-4" /> : <Flag className="h-4 w-4" />}
      {armed ? "Tap again: hata do, naya card do" : "Not okay? Report this card"}
    </button>
  );
}
