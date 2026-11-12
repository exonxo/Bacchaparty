"use client";
import { useRef } from "react";
import { applyOp, decodeDrawing, type PadView, type Stroke } from "./shared";

interface Cache {
  turn: number;
  n: number;
  strokes: Stroke[];
  /** Waiting for a keyframe because an update was missed. */
  stale: boolean;
}

/**
 * Rebuilds the drawing on a phone from the op tail in each update, falling back
 * to keyframes when it falls behind. Safe to call on every render: ops are only
 * applied once (tracked by their index).
 */
export function usePadStrokes(pad: PadView): { strokes: Stroke[]; stale: boolean } {
  const cache = useRef<Cache>({ turn: -1, n: 0, strokes: [], stale: false });
  let c = cache.current;
  if (c.turn !== pad.turn) c = { turn: pad.turn, n: 0, strokes: [], stale: false };
  if (pad.full !== null) {
    if (c.n !== pad.n || c.stale) c = { turn: pad.turn, n: pad.n, strokes: decodeDrawing(pad.full), stale: false };
  } else if (pad.n > c.n) {
    const first = pad.tail[0]?.i ?? pad.n;
    if (first > c.n) {
      c = { ...c, stale: true };
    } else {
      let strokes = c.strokes;
      for (const op of pad.tail) if (op.i >= c.n) strokes = applyOp(strokes, op);
      c = { turn: pad.turn, n: pad.n, strokes, stale: false };
    }
  }
  cache.current = c;
  return { strokes: c.strokes, stale: c.stale };
}
