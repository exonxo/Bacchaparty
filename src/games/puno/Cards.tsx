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

/** Mockup-saturated face fills (flat, no gradient). */
const FILL: Record<PunoColor, string> = {
  sindoor: "#E03A2F",
  neel: "#1E5FD8",
  mehndi: "#1F9A3C",
  haldi: "#F5BE1A",
};

const WILD_QUAD = { sindoor: "#E03A2F", haldi: "#F5BE1A", mehndi: "#1F9A3C", neel: "#1E5FD8" } as const;

export const FAN_CARD = { w: 168, h: 238 };
export const TABLE_CARD = { w: 92, h: 132 };

type CardSize = "hand" | "fan" | "pile" | "table" | "small" | "tv";

type Dim = { w: number; h: number; border: number; shadow: number; corner: string; center: string; cornerIcon: number; lift: number };

const DIM: Record<CardSize, Dim> = {
  fan: { w: FAN_CARD.w, h: FAN_CARD.h, border: 4, shadow: 5, corner: "text-4xl", center: "text-[4.5rem]", cornerIcon: 22, lift: 24 },
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

const ULTA_SKIP_R = 32;
const ULTA_CENTER_TUBE = { ink: 18, cream: 12, arrow: 14 };
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

function faceBg(card: PunoCard, wildTint?: PunoColor | null): string | undefined {
  if (card.value === "rang-badal") return undefined;
  if (card.value === "chaar-le") return INK;
  if (card.color === "wild") return wildTint ? FILL[wildTint] : "#fffdf8";
  return FILL[card.color as PunoColor];
}

export type ActionArtKind = "ruk-ja" | "ulta" | "do-le" | "chaar-le" | "rang-badal";

function artPx(size: CardSize) {
  return size === "fan" || size === "tv" ? 118 : size === "pile" || size === "table" ? 68 : 58;
}

function SparkleGfx({ x, y, s = 4 }: { x: number; y: number; s?: number }) {
  return (
    <path
      fill={INK}
      d={`M${x} ${y - s} L${x + s * 0.35} ${y - s * 0.35} L${x + s} ${y} L${x + s * 0.35} ${y + s * 0.35} L${x} ${y + s} L${x - s * 0.35} ${y + s * 0.35} L${x - s} ${y} L${x - s * 0.35} ${y - s * 0.35} Z`}
    />
  );
}

function MiniCardGfx({ x, y, w, h, rot, fill, dark }: { x: number; y: number; w: number; h: number; rot: number; fill: string; dark?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={3} fill={fill} stroke={INK} strokeWidth={2.2} />
      <rect x={-w / 2 + 2} y={-h / 2 + 2} width={w - 4} height={h - 4} rx={2} fill="none" stroke="#fffdf8" strokeWidth={1.2} />
      {dark && <rect x={-w / 2 + 4} y={-h / 2 + 6} width={w - 8} height={h - 12} rx={1} fill={INK} />}
    </g>
  );
}

function GfxDoLe() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="block h-full w-full">
      <g transform="translate(50 50)">
        <MiniCardGfx x={-15} y={-2} w={26} h={36} rot={-14} fill={WILD_QUAD.sindoor} />
        <MiniCardGfx x={15} y={2} w={26} h={36} rot={10} fill={WILD_QUAD.mehndi} />
      </g>
    </svg>
  );
}

function GfxChaarLe() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="block h-full w-full">
      <g transform="translate(50 50)">
        <MiniCardGfx x={-30} y={2} w={22} h={32} rot={-22} fill={WILD_QUAD.neel} />
        <MiniCardGfx x={-10} y={-2} w={22} h={32} rot={-6} fill={WILD_QUAD.haldi} />
        <MiniCardGfx x={10} y={0} w={22} h={32} rot={8} fill={INK} dark />
        <MiniCardGfx x={30} y={4} w={22} h={32} rot={22} fill={WILD_QUAD.sindoor} />
      </g>
      <SparkleGfx x={20} y={18} s={4} />
      <SparkleGfx x={80} y={18} s={3.5} />
      <SparkleGfx x={78} y={82} s={3} />
    </svg>
  );
}

function GfxUlta() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="block h-full w-full">
      <g transform="translate(50 50)">
        <g transform="translate(0 1.85)">
          <UltaR6Glyph r={ULTA_SKIP_R} {...ULTA_CENTER_TUBE} />
        </g>
      </g>
    </svg>
  );
}

/** S1 — bold cream circle + slash (Ruk Ja). */
function GfxRukJa() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="block h-full w-full">
      <g transform="translate(50 50)">
        <circle cx={0} cy={0} r={32} fill={CREAM} stroke={INK} strokeWidth={4} />
        <line x1={-22} y1={-22} x2={22} y2={22} stroke={INK} strokeWidth={7} strokeLinecap="square" />
      </g>
    </svg>
  );
}

function GfxRangBadal() {
  const cols = [WILD_QUAD.sindoor, WILD_QUAD.haldi, WILD_QUAD.mehndi, WILD_QUAD.neel];
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="block h-full w-full">
      <g transform="translate(50 50) rotate(-12)">
        <ellipse cx={0} cy={0} rx={40} ry={34} fill="#fffdf8" stroke={INK} strokeWidth={2.8} />
        {Array.from({ length: 8 }, (_, i) => {
          const a0 = (i * Math.PI) / 4 - Math.PI / 2;
          const a1 = ((i + 1) * Math.PI) / 4 - Math.PI / 2;
          const r = 24;
          const x0 = Math.cos(a0) * r;
          const y0 = Math.sin(a0) * r;
          const x1 = Math.cos(a1) * r;
          const y1 = Math.sin(a1) * r;
          return (
            <path key={i} d={`M0 0 L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z`} fill={cols[i % 4]} stroke={INK} strokeWidth={1.4} />
          );
        })}
        <circle cx={0} cy={0} r={6} fill="#fffdf8" stroke={INK} strokeWidth={2} />
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
  return wrap(<GfxRangBadal />);
}

function PunoOval({ size }: { size: CardSize }) {
  const big = size === "fan" || size === "tv";
  return (
    <span
      data-puno-center-art
      className={`inline-flex -rotate-12 items-center justify-center rounded-[50%] border-[3px] border-ink bg-[#fffdf8] font-display font-extrabold uppercase tracking-[0.22em] text-ink shadow-[4px_4px_0_0_#1e1a17] ${
        big ? "h-[4.25rem] w-[7.5rem] text-base" : "h-11 w-20 text-[10px]"
      }`}
    >
      Puno
    </span>
  );
}

function actionKind(card: PunoCard): ActionArtKind {
  if (card.value === "ruk-ja") return "ruk-ja";
  if (card.value === "ulta") return "ulta";
  if (card.value === "do-le") return "do-le";
  if (card.value === "rang-badal") return "rang-badal";
  return "chaar-le";
}

function CornerSlot({ card, size, inverted }: { card: PunoCard; size: CardSize; inverted?: boolean }) {
  const d = DIM[size];
  const fg = card.value === "chaar-le" ? "#fffdf8" : INK;
  const spin = inverted ? "rotate-180" : "";
  if (card.kind === "number") {
    return (
      <span className={`font-display font-extrabold leading-none tabular-nums ${d.corner} ${spin}`} style={{ color: fg, display: "inline-block" }}>
        {card.value}
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
  else if (card.value === "chaar-le") inner = <PlusFourIcon className={textMini} light />;
  else inner = <WildHatchMini size={mini} />;
  return <span className={`inline-flex items-center justify-center ${spin}`}>{inner}</span>;
}

function CenterArt({ card, size }: { card: PunoCard; size: CardSize }) {
  if (card.kind === "number") return <PunoOval size={size} />;
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
  const isRangBadal = card.value === "rang-badal";

  const shell = (
    <>
      {dim && <div className="pointer-events-none absolute inset-0 z-30 rounded-[14px] bg-ink/[0.08] saturate-[0.72]" aria-hidden />}
      {isRangBadal && (
        <div className="absolute inset-0 z-0 grid grid-cols-2 grid-rows-2 overflow-hidden rounded-[14px]">
          <div className="h-full w-full" style={{ background: WILD_QUAD.sindoor }} />
          <div className="h-full w-full" style={{ background: WILD_QUAD.haldi }} />
          <div className="h-full w-full" style={{ background: WILD_QUAD.mehndi }} />
          <div className="h-full w-full" style={{ background: WILD_QUAD.neel }} />
        </div>
      )}
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
    <div className="relative h-full w-full overflow-hidden rounded-[14px]" style={{ background: bg, ...faceRimStyle() }}>
      {shell}
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
      className={`inline-flex h-9 w-6 shrink-0 flex-col items-center justify-center overflow-hidden rounded-sm border-[2.5px] border-ink bg-ink font-extrabold uppercase leading-none text-paper shadow-[2px_2px_0_0_#1e1a17] ${className}`}
    >
      <span className="text-[6px] tracking-tighter">PU</span>
      <span className="text-[5px] tracking-tighter">NO</span>
    </span>
  );
}

export function CardBack({ size = "pile", onClick }: { size?: CardSize; onClick?: () => void }) {
  const d = DIM[size] ?? DIM.pile;
  const [pressed, setPressed] = useState(false);
  const shadowPx = pressed ? 2 : 5;
  const word = size === "fan" || size === "pile" || size === "table" ? "text-2xl" : "text-sm";

  const inner = (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-[14px] bg-ink" style={faceRimStyle()}>
      <span className={`font-display font-extrabold uppercase tracking-[0.28em] text-paper ${word}`}>Puno</span>
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
      <span className="inline-block h-10 w-10 shrink-0 border-[3px] border-ink" style={{ background: FILL[color as PunoColor] }} />
      <span className="rounded-sm border-[3px] border-ink bg-ink px-2.5 py-1 text-sm font-extrabold uppercase text-paper">{label}</span>
    </button>
  );
}
