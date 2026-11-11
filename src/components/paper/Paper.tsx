"use client";
import {
  Bird, Cat, Dog, Feather, Fish, Flame, Flower2, Gem, Moon, Origami, Panda, Rabbit, Rocket, Snail, Squirrel, Star, Sun, Turtle, X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, animate, motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { playerColor } from "@/lib/colors";
import { dur, ease, spring } from "./motion";

/* ------------------------------------------------------------------ */
/* Theme scope                                                          */
/* ------------------------------------------------------------------ */

/** Switches the document to the paper theme while the calling view is mounted. */
export function usePaperTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.dataset.theme;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevColor = meta?.content;
    root.dataset.theme = "paper";
    if (meta) meta.content = "#fbf6ee";
    return () => {
      if (prev) root.dataset.theme = prev;
      else delete root.dataset.theme;
      if (meta && prevColor) meta.content = prevColor;
    };
  }, []);
}

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.12  0 0 0 0 0.1  0 0 0 0 0.09  0 0 0 0.9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/** Full-screen paper: covers the shell's dark background and adds a faint grain. */
export function PaperBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-bg">
      <div className="absolute inset-0 opacity-[0.045] mix-blend-multiply" style={{ backgroundImage: GRAIN }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Torn edges                                                           */
/* ------------------------------------------------------------------ */

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * A clip-path polygon with a hand-torn top and/or bottom edge. Points are
 * generated from a seed, so every piece of paper tears differently and the
 * pattern never visibly repeats.
 */
export function tornClip(seed: number, edges: { top?: boolean; bottom?: boolean } = { top: true }, amp = 4): string {
  const r = rng(seed);
  const pts: string[] = [];
  const steps = 22 + Math.floor(r() * 8);
  if (edges.top) {
    let x = 0;
    pts.push(`0% ${(r() * amp).toFixed(1)}px`);
    for (let i = 1; i < steps; i++) {
      x += (100 / steps) * (0.55 + r() * 0.9);
      if (x >= 99) break;
      pts.push(`${x.toFixed(1)}% ${(r() * amp).toFixed(1)}px`);
    }
    pts.push(`100% ${(r() * amp).toFixed(1)}px`);
  } else pts.push("0% 0%", "100% 0%");
  if (edges.bottom) {
    let x = 100;
    pts.push(`100% calc(100% - ${(r() * amp).toFixed(1)}px)`);
    for (let i = 1; i < steps; i++) {
      x -= (100 / steps) * (0.55 + r() * 0.9);
      if (x <= 1) break;
      pts.push(`${x.toFixed(1)}% calc(100% - ${(r() * amp).toFixed(1)}px)`);
    }
    pts.push(`0% calc(100% - ${(r() * amp).toFixed(1)}px)`);
  } else pts.push("100% 100%", "0% 100%");
  return `polygon(${pts.join(", ")})`;
}

/* ------------------------------------------------------------------ */
/* Buttons                                                              */
/* ------------------------------------------------------------------ */

type Tone = "ink" | "turmeric" | "vermilion" | "paper" | "me";

const toneStyle: Record<Tone, string> = {
  ink: "bg-ink text-bg",
  turmeric: "bg-turmeric text-ink",
  vermilion: "bg-vermilion text-paper",
  paper: "bg-paper text-ink",
  me: "bg-me text-ink",
};

/** Cut-paper button: hard shadow that the button "presses into" on tap. */
export function PaperButton({
  tone = "turmeric",
  size = "md",
  className = "",
  children,
  disabled,
  ...rest
}: Omit<HTMLMotionProps<"button">, "children"> & { tone?: Tone; size?: "md" | "lg"; children: ReactNode }) {
  const sizes = { md: "min-h-12 px-4 text-p-body", lg: "min-h-14 px-5 text-p-lead" };
  return (
    <motion.button
      {...rest}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.96, x: 1, y: 1, boxShadow: "0px 0px 0 0 var(--ink)", transition: { duration: dur.pressDown, ease: ease.out } }}
      transition={{ duration: dur.pressUp, ease: ease.out }}
      className={`cut font-display inline-flex items-center justify-center gap-2 rounded-cut font-bold ${toneStyle[tone]} ${sizes[size]} ${
        disabled ? "cursor-not-allowed opacity-45" : ""
      } ${className}`}
    >
      {children}
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Avatars                                                              */
/* ------------------------------------------------------------------ */

const ICONS: Record<string, LucideIcon> = {
  cat: Cat, dog: Dog, bird: Bird, fish: Fish, rabbit: Rabbit, squirrel: Squirrel, turtle: Turtle, snail: Snail, panda: Panda,
  rocket: Rocket, flower: Flower2, sun: Sun, moon: Moon, star: Star, flame: Flame, gem: Gem, feather: Feather, origami: Origami,
};

/** Player avatar as a round paper sticker: solid player colour, ink outline and icon. */
export function Sticker({ id, size = 40, tilt = 0, className = "" }: { id: string | undefined; size?: number; tilt?: number; className?: string }) {
  const Icon = (id && ICONS[id]) || Star;
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink text-ink ${className}`}
      style={{ width: size, height: size, background: playerColor(id), transform: tilt ? `rotate(${tilt}deg)` : undefined, boxShadow: "1.5px 1.5px 0 0 var(--ink)" }}
    >
      <Icon style={{ width: size * 0.56, height: size * 0.56 }} strokeWidth={2.2} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Sheet                                                                */
/* ------------------------------------------------------------------ */

/** Bottom sheet on paper: springs up, leaves faster, traps focus, closes on Escape. */
export function PaperSheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => panel.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key !== "Tab" || !panel.current) return;
      const items = panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])');
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      restore.current?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.button
            aria-label="Close"
            tabIndex={-1}
            className="absolute inset-0 bg-ink/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2 } }}
            exit={{ opacity: 0, transition: { duration: dur.sheetClose, ease: ease.in } }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="relative flex max-h-[86dvh] w-full max-w-lg flex-col rounded-t-soft border-x-[1.5px] border-t-[1.5px] border-ink bg-bg outline-none"
            initial={{ y: "100%" }}
            animate={{ y: 0, transition: spring.sheet }}
            exit={{ y: "100%", transition: { duration: dur.sheetClose, ease: ease.in } }}
          >
            <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
              <h2 id={titleId} className="font-display text-p-title font-extrabold">
                {title}
              </h2>
              <button onClick={onClose} aria-label="Close" className="-mr-1 flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-ink/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
            {footer && <div className="border-t-[1.5px] border-ink/15 bg-bg px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Numbers                                                              */
/* ------------------------------------------------------------------ */

/** Counts from `from` to `to` once, on mount (or instantly with reduced motion). */
export function CountUp({ from, to, delay = 0, className = "", style }: { from: number; to: number; delay?: number; className?: string; style?: CSSProperties }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? to : from);
  useEffect(() => {
    if (reduce || from === to) {
      setN(to);
      return;
    }
    const controls = animate(from, to, { duration: dur.count, ease: ease.expo, delay, onUpdate: (v) => setN(Math.round(v)) });
    return () => controls.stop();
  }, [from, to, delay, reduce]);
  return (
    <span className={`tabular-nums ${className}`} style={style}>
      {n}
    </span>
  );
}

/** Tally marks (||||) for small counts — reads as pencil on paper. */
export function Tally({ n, className = "" }: { n: number; className?: string }) {
  if (n <= 0) return null;
  const groups = Math.floor(n / 5);
  const rest = n % 5;
  const bar = (i: number, x: number) => <line key={i} x1={x} y1={2} x2={x + 0.8} y2={14} />;
  const w = groups * 22 + rest * 4.5 + 2;
  return (
    <svg aria-hidden width={w} height={16} viewBox={`0 0 ${w} 16`} className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      {Array.from({ length: groups }, (_, g) => (
        <g key={g} transform={`translate(${g * 22},0)`}>
          {[0, 1, 2, 3].map((i) => bar(i, 2 + i * 4.5))}
          <line x1={0} y1={12} x2={19} y2={4} />
        </g>
      ))}
      <g transform={`translate(${groups * 22},0)`}>{Array.from({ length: rest }, (_, i) => bar(i, 2 + i * 4.5))}</g>
    </svg>
  );
}
