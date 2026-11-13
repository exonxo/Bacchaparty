"use client";
import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { type CSSProperties, type ReactNode, type Ref, useState } from "react";
import type { PunoCard, PunoColor } from "./shared";

const INK = "#1e1a17";

export const TAG_CAPS: Record<PunoColor | "wild", string> = {
  haldi: "HALDI",
  sindoor: "SINDOOR",
  mehndi: "MEHNDI",
  neel: "NEEL",
  wild: "WILD",
};

/** Paper inks: haldi, sindoor, mehndi and neel as printed on cream card stock. */
const FILL: Record<PunoColor, string> = {
  sindoor: "#cf4a33",
  neel: "#2f5ba8",
  mehndi: "#3f8a55",
  haldi: "#eab53c",
};

const WILD_QUAD = { sindoor: FILL.sindoor, haldi: FILL.haldi, mehndi: FILL.mehndi, neel: FILL.neel } as const;

/** Cream card stock used for wild cards. */
const CREAM_CARD = "#fffdf8";

/** Card back: turmeric paper with a printed jaali (lattice) pattern. */
const BACK_PATTERN: CSSProperties = {
  backgroundColor: "#eab53c",
  backgroundImage:
    "repeating-linear-gradient(45deg, rgba(30,26,23,0.22) 0 2px, transparent 2px 10px), repeating-linear-gradient(-45deg, rgba(30,26,23,0.22) 0 2px, transparent 2px 10px)",
};

/* ---------------- Suit motifs: each colour has its own pattern, so cards read without colour too. ---------------- */

/** Motif paths in a 20×20 box. Haldi = marigold, Sindoor = bindi, Mehndi = leaf, Neel = peacock-feather eye. */
function motifSvg(color: PunoColor, fill: string, stroke: string, sw: number) {
  if (color === "haldi") {
    const petals = Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      return `<circle cx='${(10 + Math.cos(a) * 5.4).toFixed(2)}' cy='${(10 + Math.sin(a) * 5.4).toFixed(2)}' r='3.3' fill='${fill}' stroke='${stroke}' stroke-width='${sw}'/>`;
    }).join("");
    return `${petals}<circle cx='10' cy='10' r='3.4' fill='${stroke}'/>`;
  }
  if (color === "sindoor") return `<circle cx='10' cy='10' r='8.2' fill='none' stroke='${stroke}' stroke-width='${sw}' stroke-dasharray='2 2.4'/><circle cx='10' cy='10' r='5' fill='${fill}' stroke='${stroke}' stroke-width='${sw}'/><circle cx='10' cy='10' r='1.6' fill='${stroke}'/>`;
  if (color === "mehndi") return `<path d='M10 1.5 C17 5.5 17 14.5 10 18.5 C3 14.5 3 5.5 10 1.5 Z' fill='${fill}' stroke='${stroke}' stroke-width='${sw}'/><path d='M10 4 L10 17 M10 8 L13 6 M10 11 L7 9 M10 14 L13 12' stroke='${stroke}' stroke-width='${sw * 0.75}' fill='none' stroke-linecap='round'/>`;
  return `<ellipse cx='10' cy='10' rx='7' ry='9' fill='${fill}' stroke='${stroke}' stroke-width='${sw}'/><ellipse cx='10' cy='11' rx='4.2' ry='5.6' fill='${stroke}' opacity='0.55'/><ellipse cx='10' cy='11.6' rx='2.2' ry='3' fill='${fill}' stroke='${stroke}' stroke-width='${sw * 0.7}'/>`;
}

/** Small suit mark for corners and the colour picker. */
export function SuitMark({ color, px }: { color: PunoColor; px: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 20 20" aria-hidden className="shrink-0" dangerouslySetInnerHTML={{ __html: motifSvg(color, "#fffdf8", INK, 1.6) }} />
  );
}

/** Faint repeating print of the suit motif across the card face. */
const SUIT_PATTERN: Record<PunoColor, string> = (["haldi", "sindoor", "mehndi", "neel"] as PunoColor[]).reduce(
  (acc, c) => {
    const m = motifSvg(c, "none", "rgba(30,26,23,0.16)", 1.4);
    const tile = `<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 44 44'><g transform='translate(1 1)'>${m}</g><g transform='translate(23 23)'>${m}</g></svg>`;
    acc[c] = `url("data:image/svg+xml;utf8,${encodeURIComponent(tile)}")`;
    return acc;
  },
  {} as Record<PunoColor, string>,
);

/** Paper grain for every card face. */
const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.12  0 0 0 0 0.1  0 0 0 0 0.09  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23g)'/></svg>",
)}")`;

/** A soft fold line at an angle that's fixed per card, plus grain, so each card looks like handled card stock. */
function PaperOverlay({ cardId }: { cardId: string }) {
  const h = hashId(cardId);
  const angle = 20 + (h % 140);
  const at = 38 + (h % 25);
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[25] rounded-[14px]"
        style={{ backgroundImage: `linear-gradient(${angle}deg, transparent ${at - 0.5}%, rgba(255,255,255,0.32) ${at}%, rgba(30,26,23,0.08) ${at + 0.45}%, transparent ${at + 1.2}%)` }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[25] rounded-[14px] mix-blend-multiply" style={{ backgroundImage: GRAIN, backgroundSize: "120px 120px", opacity: 0.07 }} />
    </>
  );
}

export const FAN_CARD = { w: 124, h: 176 };
export const TABLE_CARD = { w: 92, h: 132 };

type CardSize = "hand" | "fan" | "pile" | "table" | "small" | "tv";

type Dim = { w: number; h: number; border: number; shadow: number; corner: string; center: string; cornerIcon: number; lift: number };

const DIM: Record<CardSize, Dim> = {
  fan: { w: FAN_CARD.w, h: FAN_CARD.h, border: 3, shadow: 4, corner: "text-3xl", center: "text-[3.4rem]", cornerIcon: 18, lift: 18 },
  pile: { w: TABLE_CARD.w, h: TABLE_CARD.h, border: 4, shadow: 4, corner: "text-2xl", center: "text-[2.4rem]", cornerIcon: 14, lift: 8 },
  table: { w: TABLE_CARD.w, h: TABLE_CARD.h, border: 4, shadow: 4, corner: "text-2xl", center: "text-[2.4rem]", cornerIcon: 14, lift: 8 },
  hand: { w: 58, h: 84, border: 3, shadow: 4, corner: "text-xl", center: "text-[2rem]", cornerIcon: 11, lift: 8 },
  small: { w: 52, h: 76, border: 3, shadow: 4, corner: "text-lg", center: "text-[1.65rem]", cornerIcon: 10, lift: 6 },
  tv: { w: 152, h: 216, border: 5, shadow: 8, corner: "text-5xl", center: "text-[5rem]", cornerIcon: 28, lift: 12 },
};

function shadowStyle(px: number): CSSProperties {
  return { boxShadow: `${px}px ${px}px 0 0 ${INK}` };
}

const FACE_RIM = "#fffdf8";

/** Inner rim drawn with inset shadow — avoids the p-[3px] paper gutter paint glitch on card edges. */
function faceRimStyle(): CSSProperties {
  return { boxShadow: `inset 0 0 0 2px ${FACE_RIM}` };
}

function hashId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h += cardIdChar(id, i);
  return h;
}

function cardIdChar(id: string, i: number) {
  return id.charCodeAt(i) * (i + 1);
}

const CREAM = "#fffdf8";

/** S1 — cream circle with diagonal slash (Ruk Ja corner). */
function SlashCircleIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke={INK}>
      <circle cx="12" cy="12" r="8.5" strokeWidth={2.6} />
      <line x1="6.5" y1="6.5" x2="17.5" y2="17.5" strokeWidth={2.8} strokeLinecap="square" />
    </svg>
  );
}

const ULTA_CORNER_TUBE = { ink: 4.2, cream: 2.8, arrow: 3.6 };

function ultaArcD(r: number) {
  const gapHalf = 30;
  const start = 90 + gapHalf;
  const end = 90 - gapHalf;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const x1 = r * Math.cos(rad(start));
  const y1 = r * Math.sin(rad(start));
  const x2 = r * Math.cos(rad(end));
  const y2 = r * Math.sin(rad(end));
  return { d: `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`, tipX: x2, tipY: y2, headDeg: end + 90 };
}

function ultaArrowHead(tipX: number, tipY: number, headDeg: number, size: number) {
  const rad = (headDeg * Math.PI) / 180;
  const bx = tipX - size * Math.cos(rad);
  const by = tipY - size * Math.sin(rad);
  const px = -Math.sin(rad);
  const py = Math.cos(rad);
  const w = size * 0.62;
  return `${tipX},${tipY} ${bx + px * w},${by + py * w} ${bx - px * w},${by - py * w}`;
}

/** ~300° cream tube arc + single bold arrowhead (R6) — draw around (0,0). */
function UltaR6Glyph({ r, ink, cream, arrow }: { r: number; ink: number; cream: number; arrow: number }) {
  const { d, tipX, tipY, headDeg } = ultaArcD(r);
  return (
    <>
      <path d={d} fill="none" stroke={INK} strokeWidth={ink} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={CREAM} strokeWidth={cream} strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={ultaArrowHead(tipX, tipY, headDeg, arrow)} fill={INK} />
    </>
  );
}

/** R6 — same reverse glyph as centre art, scaled for corners (24×24 like skip). */
function UltaCornerIcon({ className = "" }: { className?: string }) {
  const r = 8.5;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <g transform="translate(12 12) translate(0 0.49)">
        <UltaR6Glyph r={r} {...ULTA_CORNER_TUBE} />
      </g>
    </svg>
  );
}

function SwapIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke={INK} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8 H19 M15 4 L19 8 L15 12" />
      <path d="M20 16 H5 M9 12 L5 16 L9 20" />
    </svg>
  );
}

function PlusTwoIcon({ className = "" }: { className?: string }) {
  return <span className={`font-display font-extrabold leading-none ${className}`}>+2</span>;
}

function PlusFourIcon({ className = "", light }: { className?: string; light?: boolean }) {
  return <span className={`font-display font-extrabold leading-none ${className}`} style={{ color: light ? "#fffdf8" : INK }}>+4</span>;
}

function WildHatchMini({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <rect width="16" height="16" fill={INK} />
      <path d="M0 1 L16 15 M0 4 L16 18" stroke="#fffdf8" strokeWidth="1.2" />
    </svg>
  );
}

/** Four-colour wheel for rang-badal corners at small sizes. */
function CornerColorWheel({ px }: { px: number }) {
  const cols = [WILD_QUAD.sindoor, WILD_QUAD.haldi, WILD_QUAD.mehndi, WILD_QUAD.neel];
  const cx = 8;
  const cy = 8;
  const r = 6.5;
  return (
    <svg width={px} height={px} viewBox="0 0 16 16" className="shrink-0" aria-hidden>
      <circle cx={cx} cy={cy} r="7.4" fill="#fffdf8" stroke={INK} strokeWidth="1.3" />
      {cols.map((fill, i) => {
        const a0 = (i * Math.PI) / 2 - Math.PI / 2;
        const a1 = ((i + 1) * Math.PI) / 2 - Math.PI / 2;
        const x0 = cx + Math.cos(a0) * r;
        const y0 = cy + Math.sin(a0) * r;
        const x1 = cx + Math.cos(a1) * r;
        const y1 = cy + Math.sin(a1) * r;
        return <path key={i} d={`M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z`} fill={fill} stroke={INK} strokeWidth="0.6" />;
      })}
      <circle cx={cx} cy={cy} r="2.2" fill="#fffdf8" stroke={INK} strokeWidth="0.8" />
    </svg>
  );
}

function faceBg(card: PunoCard, wildTint?: PunoColor | null): CSSProperties {
  const suit: PunoColor | null = card.color === "wild" ? wildTint ?? null : card.color;
  if (!suit) return { backgroundColor: CREAM_CARD };
  return { backgroundColor: FILL[suit], backgroundImage: SUIT_PATTERN[suit], backgroundSize: "44px 44px" };
}

export type ActionArtKind = "ruk-ja" | "ulta" | "do-le" | "chaar-le" | "rang-badal" | "rishtedaar";

function artPx(size: CardSize) {
  return size === "tv" ? 118 : size === "fan" ? 86 : size === "pile" || size === "table" ? 68 : 58;
}

function SparkleGfx({ x, y, s = 4 }: { x: number; y: number; s?: number }) {
  return (
    <path
      fill={INK}
      d={`M${x} ${y - s} L${x + s * 0.35} ${y - s * 0.35} L${x + s} ${y} L${x + s * 0.35} ${y + s * 0.35} L${x} ${y + s} L${x - s * 0.35} ${y + s * 0.35} L${x - s} ${y} L${x - s * 0.35} ${y - s * 0.35} Z`}
    />
  );
}

/** A folded paper chit with a few lines of writing. */
function ChitGfx({ x, y, rot }: { x: number; y: number; rot: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d="M-15 -20 H8 L15 -13 V20 H-15 Z" fill={CREAM} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d="M8 -20 V-13 H15" fill="#e9dcc4" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M-9 -8 H6 M-9 -1 H9 M-9 6 H3 M-9 13 H7" stroke={INK} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
    </g>
  );
}

/** Do Le: two chits being handed over. */
function GfxDoLe() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="block h-full w-full">
      <ChitGfx x={36} y={52} rot={-14} />
      <ChitGfx x={62} y={48} rot={11} />
    </svg>
  );
}

/** One laddoo: a round sweet with a few boondi dots. */
function LaddooGfx({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={11} fill="#e8a23a" stroke={INK} strokeWidth={3} />
      <circle cx={-4} cy={-3} r={1.4} fill={INK} opacity={0.45} />
      <circle cx={3} cy={-5} r={1.2} fill={INK} opacity={0.45} />
      <circle cx={4} cy={3} r={1.4} fill={INK} opacity={0.45} />
      <circle cx={-3} cy={5} r={1.2} fill={INK} opacity={0.45} />
      <path d="M-6 -6 A8 8 0 0 1 2 -9" stroke="#fffdf8" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.8} />
    </g>
  );
}

/** Chaar Le: four laddoos on a thali. */
function GfxChaarLe() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="block h-full w-full">
      <ellipse cx={50} cy={74} rx={38} ry={10} fill="#d9c9a8" stroke={INK} strokeWidth={3} />
      <ellipse cx={50} cy={72} rx={30} ry={6.5} fill={CREAM} stroke={INK} strokeWidth={2} />
      <LaddooGfx x={32} y={63} />
      <LaddooGfx x={50} y={65} />
      <LaddooGfx x={68} y={63} />
      <LaddooGfx x={50} y={45} />
      <SparkleGfx x={18} y={22} s={4} />
      <SparkleGfx x={82} y={20} s={3.5} />
    </svg>
  );
}

/** Ulta: an auto-rickshaw taking a U-turn. */
function GfxUlta() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="block h-full w-full">
      {/* U-turn arrow */}
      <path d="M64 30 V20 A12 12 0 0 0 40 20 V27" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
      <path d="M64 30 V20 A12 12 0 0 0 40 20 V27" fill="none" stroke={CREAM} strokeWidth={4.5} strokeLinecap="round" />
      <polygon points="31,26 49,26 40,37" fill={INK} />
      {/* rickshaw */}
      <path d="M16 74 V56 Q16 42 32 40 H64 Q80 41 84 58 L86 74 Z" fill={CREAM} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
      <path d="M16 54 Q16 42 32 40 H64 Q76 41 81 50 Z" fill={INK} />
      <rect x={30} y={53} width={22} height={13} rx={2} fill="none" stroke={INK} strokeWidth={2.5} />
      <circle cx={84} cy={63} r={3} fill="#eab53c" stroke={INK} strokeWidth={2} />
      <circle cx={30} cy={77} r={9} fill={INK} />
      <circle cx={30} cy={77} r={3.5} fill={CREAM} />
      <circle cx={74} cy={77} r={9} fill={INK} />
      <circle cx={74} cy={77} r={3.5} fill={CREAM} />
    </svg>
  );
}

/** Ruk Ja: a raised palm. Drawn as an ink silhouette with the cream hand on top, so finger gaps stay as fine lines. */
function GfxRukJa() {
  const parts = (
    <>
      <rect x={30} y={46} width={40} height={36} rx={12} />
      <rect x={30.5} y={20} width={9.5} height={36} rx={4.75} />
      <rect x={40.5} y={13} width={9.5} height={42} rx={4.75} />
      <rect x={50.5} y={16} width={9.5} height={39} rx={4.75} />
      <rect x={60.5} y={25} width={9.5} height={30} rx={4.75} />
      <rect x={21} y={52} width={11} height={28} rx={5.5} transform="rotate(-32 27 79)" />
      <rect x={37} y={76} width={26} height={14} rx={3} />
    </>
  );
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="block h-full w-full">
      <g fill={INK} stroke={INK} strokeWidth={7} strokeLinejoin="round">{parts}</g>
      <g fill={CREAM}>{parts}</g>
      <path d="M40 66 Q50 72 60 64" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" opacity={0.55} />
      <path d="M37 84 H63" stroke={INK} strokeWidth={2} opacity={0.4} />
    </svg>
  );
}

/** Rishtedaar: two relatives trading places. */
function GfxRishtedaar() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="block h-full w-full">
      <path d="M38 22 Q50 12 62 22" fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
      <polygon points="64,15 67,27 56,24" fill={INK} />
      <path d="M62 84 Q50 94 38 84" fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
      <polygon points="36,91 33,79 44,82" fill={INK} />
      {/* left: in a sindoor kurta, with a bindi */}
      <path d="M14 76 Q14 58 30 57 Q46 58 46 76 Z" fill={FILL.sindoor} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <circle cx={30} cy={44} r={10} fill={CREAM} stroke={INK} strokeWidth={3} />
      <path d="M20 41 Q22 31 30 32 Q38 31 40 41 Q36 36 30 37 Q24 36 20 41 Z" fill={INK} />
      <circle cx={30} cy={41.5} r={1.8} fill={FILL.sindoor} />
      {/* right: in neel, with a haldi pagdi */}
      <path d="M54 76 Q54 58 70 57 Q86 58 86 76 Z" fill={FILL.neel} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <circle cx={70} cy={45} r={10} fill={CREAM} stroke={INK} strokeWidth={3} />
      <path d="M59 42 Q60 29 70 29 Q81 29 81 42 Q75 37 70 38 Q64 37 59 42 Z" fill={FILL.haldi} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M66 49 Q70 51.5 74 49" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function GfxRangBadal() {
  const cols = [WILD_QUAD.sindoor, WILD_QUAD.haldi, WILD_QUAD.mehndi, WILD_QUAD.neel];
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="block h-full w-full">
      {/* Rangoli flower: eight petals in the four inks around a cream centre. */}
      <g transform="translate(50 50)">
        <circle cx={0} cy={0} r={38} fill="none" stroke={INK} strokeWidth={1.6} strokeDasharray="2 4" />
        {Array.from({ length: 8 }, (_, i) => (
          <ellipse key={i} cx={0} cy={-19} rx={9} ry={17} transform={`rotate(${i * 45})`} fill={cols[i % 4]} stroke={INK} strokeWidth={2} />
        ))}
        <circle cx={0} cy={0} r={9} fill={CREAM_CARD} stroke={INK} strokeWidth={2.4} />
        <circle cx={0} cy={0} r={3} fill={INK} />
      </g>
      <SparkleGfx x={18} y={20} s={4} />
      <SparkleGfx x={82} y={22} s={3.5} />
      <SparkleGfx x={20} y={80} s={3} />
    </svg>
  );
}

/** Theme F — bold graphic centre art for action cards. */
export function ActionArt({ kind, size }: { kind: ActionArtKind; size: CardSize }) {
  const px = artPx(size);
  const wrap = (child: ReactNode) => (
    <span className="inline-flex shrink-0 items-center justify-center" style={{ width: px, height: px }} aria-hidden data-puno-center-art>
      {child}
    </span>
  );
  if (kind === "do-le") return wrap(<GfxDoLe />);
  if (kind === "chaar-le") return wrap(<GfxChaarLe />);
  if (kind === "ulta") return wrap(<GfxUlta />);
  if (kind === "ruk-ja") return wrap(<GfxRukJa />);
  if (kind === "rishtedaar") return wrap(<GfxRishtedaar />);
  return wrap(<GfxRangBadal />);
}

/** Number cards: the number on a round cream badge with a dotted rangoli ring. */
function NumberBadge({ value, size }: { value: number; size: CardSize }) {
  const px = size === "tv" ? 104 : size === "fan" ? 74 : size === "pile" || size === "table" ? 54 : 40;
  const text = size === "tv" ? "text-6xl" : size === "fan" ? "text-[2.6rem]" : size === "pile" || size === "table" ? "text-3xl" : "text-xl";
  return (
    <span
      data-puno-center-art
      className={`relative inline-flex items-center justify-center rounded-full border-[3px] border-ink bg-[#fffdf8] font-display font-extrabold leading-none tabular-nums text-ink ${text}`}
      style={{ width: px, height: px, boxShadow: "3px 3px 0 0 #1e1a17" }}
    >
      <span aria-hidden className="absolute inset-[5px] rounded-full border-2 border-dotted border-ink/35" />
      {/* 6 and 9 are underlined so they read the right way up. */}
      <span className={value === 6 || value === 9 ? "underline decoration-[3px] underline-offset-[3px]" : ""}>{value}</span>
    </span>
  );
}

function actionKind(card: PunoCard): ActionArtKind {
  if (card.value === "ruk-ja") return "ruk-ja";
  if (card.value === "ulta") return "ulta";
  if (card.value === "do-le") return "do-le";
  if (card.value === "rang-badal") return "rang-badal";
  if (card.value === "rishtedaar") return "rishtedaar";
  return "chaar-le";
}

function CornerSlot({ card, size, inverted }: { card: PunoCard; size: CardSize; inverted?: boolean }) {
  const d = DIM[size];
  const fg = INK;
  const spin = inverted ? "rotate-180" : "";
  const suit = card.color === "wild" ? null : card.color;
  const mark = suit ? <SuitMark color={suit} px={Math.max(11, d.cornerIcon)} /> : null;
  if (card.kind === "number") {
    return (
      <span className={`flex flex-col items-center gap-1 ${spin}`}>
        <span
          className={`font-display font-extrabold leading-none tabular-nums ${d.corner} ${card.value === 6 || card.value === 9 ? "underline decoration-[3px] underline-offset-2" : ""}`}
          style={{ color: fg, display: "inline-block" }}
        >
          {card.value}
        </span>
        {mark}
      </span>
    );
  }
  const mini = d.cornerIcon;
  const miniCls = mini <= 12 ? "h-3 w-3" : mini <= 16 ? "h-4 w-4" : "h-5 w-5";
  const textMini = mini <= 12 ? "text-[9px]" : mini <= 16 ? "text-[11px]" : "text-sm";
  let inner: ReactNode;
  if (card.value === "ruk-ja") inner = <SlashCircleIcon className={`text-ink ${miniCls}`} />;
  else if (card.value === "ulta") inner = <UltaCornerIcon className={`text-ink ${miniCls}`} />;
  else if (card.value === "do-le") inner = <PlusTwoIcon className={textMini} />;
  else if (card.value === "rang-badal") inner = <CornerColorWheel px={Math.max(12, mini)} />;
  else if (card.value === "chaar-le") inner = <PlusFourIcon className={textMini} />;
  else if (card.value === "rishtedaar") inner = <SwapIcon className={miniCls} />;
  else inner = <WildHatchMini size={mini} />;
  return (
    <span className={`flex flex-col items-center gap-1 ${spin}`}>
      <span className="inline-flex items-center justify-center">{inner}</span>
      {mark}
    </span>
  );
}

function CenterArt({ card, size }: { card: PunoCard; size: CardSize }) {
  if (card.kind === "number") return <NumberBadge value={card.value as number} size={size} />;
  return <ActionArt kind={actionKind(card)} size={size} />;
}

export function CardFace({
  card,
  wildTint,
  size = "hand",
  dim,
  selected,
  onClick,
  className = "",
}: {
  card: PunoCard;
  wildTint?: PunoColor | null;
  size?: CardSize;
  dim?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const d = DIM[size];
  const [pressed, setPressed] = useState(false);
  const lift = selected && !pressed;
  const shadowPx = pressed ? Math.max(1, d.shadow - 2) : lift ? d.shadow + 6 : d.shadow;
  const liftY = reduce ? (lift ? -8 : pressed ? 1 : 0) : lift ? -d.lift : pressed ? 2 : 0;
  const bg = faceBg(card, wildTint);

  const shell = (
    <>
      {dim && <div className="pointer-events-none absolute inset-0 z-30 rounded-[14px] bg-[#fbf6ee]/50" aria-hidden />}
      <span className="absolute left-2.5 top-2.5 z-20 leading-none">
        <CornerSlot card={card} size={size} />
      </span>
      <span className="absolute bottom-2.5 right-2.5 z-20 leading-none">
        <CornerSlot card={card} size={size} inverted />
      </span>
      <motion.div layout={false} data-puno-center-mount className="absolute inset-0 z-[1] flex items-center justify-center">
        <CenterArt card={card} size={size} />
      </motion.div>
    </>
  );

  const frameStyle: CSSProperties = {
    width: d.w,
    height: d.h,
    ...shadowStyle(shadowPx),
    transform: `translateY(${liftY}px)`,
  };

  const frameClass = `font-display relative shrink-0 rounded-[18px] border-ink bg-paper p-0 transition-[transform,box-shadow] duration-150 ${onClick ? "cursor-pointer touch-manipulation" : ""} ${className}`;

  frameStyle.borderWidth = d.border;
  frameStyle.borderStyle = "solid";
  frameStyle.borderColor = INK;

  const inner = (
    <div className="relative h-full w-full overflow-hidden rounded-[14px]" style={{ ...bg, ...faceRimStyle() }}>
      {shell}
      <PaperOverlay cardId={card.id} />
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        className={`${frameClass} select-none [-webkit-tap-highlight-color:transparent]`}
        style={frameStyle}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className={frameClass} style={frameStyle}>
      {inner}
    </div>
  );
}

export function radialPose(cardId: string, index: number, total: number) {
  const h = hashId(cardId) + index * 53;
  const angle = (index / Math.max(1, total)) * Math.PI * 2 + (h % 100) * 0.028;
  const r = 8 + (index % 6) * 4.5 + (h % 11);
  const deg = 15 + (h % 21);
  const sign = h % 2 === 0 ? 1 : -1;
  return {
    rotate: sign * deg,
    x: Math.cos(angle) * r,
    y: Math.sin(angle) * r,
    scale: 0.78 - index * 0.032,
    zIndex: index + 1,
  };
}

/** Extra jitter so the player fan reads as one messy pile, not a neat block. */
export function fanMessyOffset(cardId: string, index: number) {
  const h = hashId(cardId) + index * 41;
  return {
    rotate: ((h % 15) - 7) * 1.15,
    x: ((h % 11) - 5) * 2.2,
    y: ((h >> 2) % 9) - 4,
  };
}

export function pilePose(cardId: string, layer: number) {
  return radialPose(cardId, layer, 8);
}

const DECO_COLORS: PunoColor[] = ["haldi", "neel", "mehndi", "sindoor"];

/** Visual-only cards so the discard looks messy from frame one (5–7 under the top). */
export function seedDecorativePile(top: PunoCard): PunoCard[] {
  const n = 5 + (hashId(top.id) % 3);
  return Array.from({ length: n }, (_, i) => ({
    id: `deco-${top.id}-${i}`,
    color: DECO_COLORS[(hashId(top.id) + i) % DECO_COLORS.length],
    kind: "number" as const,
    value: 1 + ((hashId(top.id) + i * 5) % 9),
  }));
}

export function MiniCardBack({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-9 w-6 shrink-0 items-center justify-center overflow-hidden rounded-sm border-[2.5px] border-ink shadow-[2px_2px_0_0_#1e1a17] ${className}`}
      style={BACK_PATTERN}
    >
      <span className="h-2 w-2 rounded-full border border-ink bg-vermilion" />
    </span>
  );
}

export function CardBack({ size = "pile", onClick }: { size?: CardSize; onClick?: () => void }) {
  const d = DIM[size] ?? DIM.pile;
  const [pressed, setPressed] = useState(false);
  const shadowPx = pressed ? 2 : 5;
  const seal = size === "tv" ? 54 : 34;

  const inner = (
    <div className="flex h-full w-full items-center justify-center rounded-[14px]" style={{ ...faceRimStyle(), ...BACK_PATTERN }}>
      <span
        className="flex items-center justify-center rounded-full border-[3px] border-ink bg-vermilion"
        style={{ width: seal, height: seal, boxShadow: "2px 2px 0 0 #1e1a17" }}
      >
        <span className="h-1/3 w-1/3 rounded-full bg-[#fffdf8]" />
      </span>
    </div>
  );

  const style: CSSProperties = { width: d.w, height: d.h, ...shadowStyle(shadowPx), transform: pressed ? "translate(1px,1px)" : undefined };
  const cls = `rounded-[18px] border-4 border-ink bg-paper p-0 ${onClick ? "cursor-pointer" : ""}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        className={`${cls} select-none [-webkit-tap-highlight-color:transparent]`}
        style={style}
        aria-label="Draw from deck"
      >
        {inner}
      </button>
    );
  }
  return (
    <div className={cls} style={style} aria-hidden>
      {inner}
    </div>
  );
}

export function DeckStack({
  size = "pile",
  onClick,
  innerRef,
}: {
  size?: CardSize;
  onClick?: () => void;
  innerRef?: Ref<HTMLDivElement>;
}) {
  const d = DIM[size === "tv" ? "tv" : "pile"];
  const step = size === "tv" ? 3 : 2;
  const layers = [5, 4, 3, 2, 1];
  return (
    <div ref={innerRef} className="relative" style={{ width: d.w + step * 6, height: d.h + step * 2 }}>
      {layers.map((i) => (
        <div
          key={i}
          className="pointer-events-none absolute rounded-[18px] border-[3px] border-ink bg-[#fffdf8]"
          style={{ width: d.w, height: d.h, left: i * step, top: -i * step, zIndex: i, boxShadow: `${step}px ${step}px 0 0 ${INK}` }}
        />
      ))}
      <motion.div className="absolute left-0 top-0 z-10" whileTap={onClick ? { scale: 0.98 } : undefined}>
        <CardBack size={size === "tv" ? "tv" : "pile"} onClick={onClick} />
      </motion.div>
    </div>
  );
}

export function NeoButton({
  children,
  onClick,
  disabled,
  variant = "paper",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "paper" | "turmeric" | "vermilion" | "ink";
  className?: string;
}) {
  const [pressed, setPressed] = useState(false);
  const bg =
    variant === "turmeric" ? "var(--turmeric)" : variant === "vermilion" ? "var(--vermilion)" : variant === "ink" ? "var(--ink)" : "var(--paper)";
  const fg = variant === "ink" || variant === "vermilion" ? "var(--paper)" : "var(--ink)";
  const shadowPx = pressed ? 2 : 4;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className={`font-display min-h-10 border-[3px] border-ink px-2.5 py-2 text-[10px] font-extrabold uppercase tracking-wide ${disabled ? "opacity-45" : ""} ${pressed ? "translate-x-px translate-y-px" : ""} ${className}`}
      style={{ background: bg, color: fg, ...shadowStyle(shadowPx) }}
    >
      {children}
    </button>
  );
}

export function ColorSwatch({ color, label, onClick }: { color: PunoColor; label: string; onClick: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className={`font-display flex min-h-14 w-full items-center gap-3 border-[3px] border-ink bg-paper px-3 py-2 ${pressed ? "translate-x-px translate-y-px" : ""}`}
      style={shadowStyle(pressed ? 2 : 4)}
    >
      <span
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center border-[3px] border-ink"
        style={{ backgroundColor: FILL[color], backgroundImage: SUIT_PATTERN[color], backgroundSize: "44px 44px" }}
      >
        <SuitMark color={color} px={22} />
      </span>
      <span className="rounded-sm border-[3px] border-ink bg-ink px-2.5 py-1 text-sm font-extrabold uppercase text-paper">{label}</span>
    </button>
  );
}
