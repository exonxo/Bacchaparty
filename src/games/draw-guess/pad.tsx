"use client";
import { COLORS, WIDTHS, type Stroke } from "./shared";

/** Renders strokes (0–1000 units) as SVG. Decorative inner content; the caller labels the picture. */
export function StrokesSvg({ strokes }: { strokes: Stroke[] }) {
  return (
    <>
      {strokes.map((s, i) => {
        const color = COLORS[s.c] ?? COLORS[0];
        const w = WIDTHS[s.w] ?? WIDTHS[1];
        return s.p.length === 2 ? (
          <circle key={i} cx={s.p[0]} cy={s.p[1]} r={w / 2} fill={color} />
        ) : (
          <polyline key={i} points={s.p.join(" ")} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
        );
      })}
    </>
  );
}

export function PadDrawing({ strokes, className = "", label = "The drawing" }: { strokes: Stroke[]; className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 1000 1000" role="img" aria-label={label} className={`block aspect-square w-full ${className}`}>
      <StrokesSvg strokes={strokes} />
    </svg>
  );
}
