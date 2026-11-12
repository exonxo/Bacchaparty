import type { Level } from "@/lib/types";

/**
 * Draw & Guess wire format.
 *
 * The drawing used to travel in full in every room update (about 8 per second
 * while someone draws). Now the host keeps an append-only log of drawing ops
 * for the turn, and each update carries only the last few ops plus a counter.
 * Phones replay ops they haven't seen. A full copy of the drawing ("keyframe")
 * is included every few seconds, and always at reveal, for phones that joined
 * late or missed an update.
 */

export type Phase = "choosing" | "drawing" | "reveal" | "over";

/** A stroke: colour index, width index and flat [x0,y0,x1,y1,…] in 0–1000 units. */
export interface Stroke {
  c: number;
  w: number;
  p: number[];
}

/** One drawing op. "a" adds points to stroke `s` (a new stroke when s is the next index). */
export type Op = { k: "a"; s: number; c: number; w: number; p: string } | { k: "u" } | { k: "x" };

/** An op with its position in the turn's log. */
export type LoggedOp = Op & { i: number };

export interface PadView {
  /** Identifies the page; a new turn is a new page. */
  turn: number;
  /** Number of ops logged so far this turn. */
  n: number;
  /** The most recent ops (at most TAIL_OPS), oldest first. */
  tail: LoggedOp[];
  /** The whole drawing, encoded, when this update carries a keyframe; otherwise null. */
  full: string | null;
}

export interface FeedEntry {
  playerId: string;
  /** null = guessed correctly (the text is hidden so nobody copies it). */
  text: string | null;
}

export interface Pub {
  drawerId: string | null;
  turn: number;
  totalTurns: number;
  phase: Phase;
  seconds: number;
  deadline: number;
  hintAt: number;
  mask: string;
  firstLetter: string;
  pad: PadView;
  correct: string[];
  feed: FeedEntry[];
  scores: Record<string, number>;
  /** Points gained this turn, per player. */
  gains: Record<string, number>;
  answer: string | null;
  /** When the reveal ends (host clock ms). */
  revealUntil: number | null;
  /** Set while the drawer's phone is disconnected (host clock ms); the turn is skipped after a while. */
  drawerAwaySince: number | null;
}

export interface Priv {
  choices?: string[];
  word?: string;
}

export interface Options {
  level: Level;
  roundsPerPlayer: number;
  seconds: number;
}

/** Crayons that read well on paper. Index is what travels on the wire. */
export const COLORS = ["#1e1a17", "#c23a22", "#1d4ed8", "#2f7d4f", "#e8a317", "#8b5a2b", "#d6336c", "#5b2a6e"];
export const COLOR_NAMES = ["Kaala", "Laal", "Neela", "Hara", "Peela", "Bhoora", "Gulabi", "Jamuni"];
export const WIDTHS = [6, 14, 28];

export const TAIL_OPS = 16;
/** How often the host includes a full keyframe while someone draws. */
export const KEYFRAME_EVERY = 4000;
/** How long a keyframe stays in updates (covers a couple of updates). */
export const KEYFRAME_FOR = 600;
/** Drawer disconnected this long → turn is skipped. */
export const DRAWER_AWAY_SKIP = 10_000;
/** Total coordinates kept per drawing, and per stroke. */
export const MAX_POINTS = 12_000;
export const MAX_STROKE_POINTS = 1_600;

/* --------------------------- compact encoding --------------------------- */

/** Each coordinate (0–1000) as two base-36 characters. */
export function encodePoints(p: number[]): string {
  let out = "";
  for (const n of p) out += Math.max(0, Math.min(1000, Math.round(n))).toString(36).padStart(2, "0");
  return out;
}

export function decodePoints(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < s.length; i += 2) {
    const n = parseInt(s.slice(i, i + 2), 36);
    if (Number.isFinite(n)) out.push(Math.min(1000, n));
  }
  return out;
}

/** Whole drawing: strokes joined by "|", each "<colour><width><points>". */
export function encodeDrawing(strokes: Stroke[]): string {
  return strokes.map((s) => `${s.c}${s.w}${encodePoints(s.p)}`).join("|");
}

export function decodeDrawing(s: string): Stroke[] {
  if (!s) return [];
  return s.split("|").map((part) => ({ c: Number(part[0]) || 0, w: Number(part[1]) || 0, p: decodePoints(part.slice(2)) }));
}

/** Applies one op to a drawing (returns a new array). Shared by host and phones. */
export function applyOp(strokes: Stroke[], op: Op): Stroke[] {
  if (op.k === "x") return [];
  if (op.k === "u") return strokes.slice(0, -1);
  const p = decodePoints(op.p);
  if (op.s === strokes.length) return [...strokes, { c: op.c, w: op.w, p }];
  if (op.s === strokes.length - 1) {
    const last = strokes[strokes.length - 1];
    return [...strokes.slice(0, -1), { ...last, p: [...last.p, ...p] }];
  }
  return strokes;
}
