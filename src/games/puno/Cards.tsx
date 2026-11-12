"use client";
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

type Dim = { w: number; h: number; border: number; shadow: number; tag: string; center: string; icon: number; lift: number };

const DIM: Record<CardSize, Dim> = {
  fan: { w: FAN_CARD.w, h: FAN_CARD.h, border: 4, shadow: 5, tag: "text-[9px] px-2 py-0.5", center: "text-[4.5rem]", icon: 14, lift: 24 },
  pile: { w: TABLE_CARD.w, h: TABLE_CARD.h, border: 4, shadow: 4, tag: "text-[8px] px-1.5 py-0.5", center: "text-[2.4rem]", icon: 11, lift: 8 },
  table: { w: TABLE_CARD.w, h: TABLE_CARD.h, border: 4, shadow: 4, tag: "text-[8px] px-1.5 py-0.5", center: "text-[2.4rem]", icon: 11, lift: 8 },
  hand: { w: 58, h: 84, border: 3, shadow: 4, tag: "text-[7px] px-1.5 py-0.5", center: "text-[2rem]", icon: 9, lift: 8 },
  small: { w: 52, h: 76, border: 3, shadow: 4, tag: "text-[7px] px-1 py-0.5", center: "text-[1.65rem]", icon: 8, lift: 6 },
  tv: { w: 152, h: 216, border: 5, shadow: 8, tag: "text-sm px-2 py-0.5", center: "text-[5rem]", icon: 18, lift: 12 },
};

function shadowStyle(px: number): CSSProperties {
  return { boxShadow: `${px}px ${px}px 0 0 ${INK}` };
}

function hashId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h += cardIdChar(id, i);
  return h;
}

function cardIdChar(id: string, i: number) {
  return id.charCodeAt(i) * (i + 1);
}

function CornerMark({ kind, size }: { kind: number; size: number }) {
  const stroke = 2;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="shrink-0 text-ink">
      {kind === 0 && <circle cx="8" cy="8" r="5" fill="currentColor" />}
      {kind === 1 && (
        <g fill="none" stroke="currentColor" strokeWidth={stroke}>
          <path d="M4 4 L12 12 M12 4 L4 12" strokeLinecap="square" />
        </g>
      )}
      {kind === 2 && (
        <g fill="none" stroke="currentColor" strokeWidth={stroke}>
          <circle cx="8" cy="8" r="3.2" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const r = (a * Math.PI) / 180;
            return <line key={a} x1={8 + Math.cos(r) * 4.2} y1={8 + Math.sin(r) * 4.2} x2={8 + Math.cos(r) * 7.2} y2={8 + Math.sin(r) * 7.2} />;
          })}
        </g>
      )}
      {kind === 3 && (
        <path fill="currentColor" d="M8 2 C6 6 4 10 4 12 L6 12 C6 10 7 7 8 5 C9 7 10 10 10 12 L12 12 C12 10 10 6 8 2 Z" />
      )}
      {kind === 4 && (
        <g fill="currentColor">
          <circle cx="8" cy="8" r="2.2" />
          {[0, 72, 144, 216, 288].map((a) => {
            const r = (a * Math.PI) / 180;
            return <ellipse key={a} cx={8 + Math.cos(r) * 4.5} cy={8 + Math.sin(r) * 4.5} rx="2.2" ry="1.1" transform={`rotate(${a} ${8 + Math.cos(r) * 4.5} ${8 + Math.sin(r) * 4.5})`} />;
          })}
        </g>
      )}
    </svg>
  );
}

function WildHatch({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <rect width="16" height="16" fill={INK} />
      <path d="M-2 2 L18 22 M-2 6 L18 26 M-2 10 L18 30" stroke="#fffdf8" strokeWidth="1.2" />
    </svg>
  );
}

/** Bold stop / skip motif — no palm or fingers. */
function StopSkipIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="square">
      <circle cx="32" cy="32" r="22" />
      <path d="M22 32 H42" />
    </svg>
  );
}

function ReverseIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 36" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="square">
      <path d="M4 18 H32 M28 8 L38 18 L28 28" />
      <path d="M76 18 H48 M52 8 L42 18 L52 28" />
    </svg>
  );
}

function WildGrid({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-2 grid-rows-2 border-[2px] border-ink ${className}`}>
      <div className="aspect-square" style={{ background: WILD_QUAD.sindoor }} />
      <div className="aspect-square" style={{ background: WILD_QUAD.haldi }} />
      <div className="aspect-square" style={{ background: WILD_QUAD.mehndi }} />
      <div className="aspect-square" style={{ background: WILD_QUAD.neel }} />
    </div>
  );
}

function faceBg(card: PunoCard, wildTint?: PunoColor | null): string | undefined {
  if (card.value === "rang-badal") return undefined;
  if (card.value === "chaar-le") return INK;
  if (card.color === "wild") return wildTint ? FILL[wildTint] : "#fffdf8";
  return FILL[card.color as PunoColor];
}

function glyphForColor(card: PunoCard): { bl: number; br: number } {
  if (card.color === "wild" || card.value === "rang-badal" || card.value === "chaar-le") return { bl: 1, br: -1 };
  const map: Record<PunoColor, { bl: number; br: number }> = {
    sindoor: { bl: 4, br: 0 },
    neel: { bl: 1, br: 1 },
    mehndi: { bl: 3, br: 3 },
    haldi: { bl: 2, br: 2 },
  };
  return map[card.color as PunoColor] ?? { bl: 0, br: 0 };
}

function CenterArt({ card, size }: { card: PunoCard; size: CardSize }) {
  const d = DIM[size];
  const isChaar = card.value === "chaar-le";
  const fg = isChaar ? "#fffdf8" : INK;
  const big = size === "fan";
  if (card.kind === "number") {
    return (
      <span className={`font-display font-extrabold leading-[0.85] tracking-tighter ${d.center}`} style={{ color: fg }}>
        {card.value}
      </span>
    );
  }
  if (card.value === "ruk-ja") {
    return <StopSkipIcon className={`text-ink ${big ? "h-[4.5rem] w-[4.5rem]" : "h-10 w-10"}`} />;
  }
  if (card.value === "ulta") {
    return <ReverseIcon className={big ? "w-[78%] max-w-[9rem]" : "w-12"} />;
  }
  if (card.value === "do-le") {
    return (
      <span className={`font-display font-extrabold leading-none ${d.center}`} style={{ color: fg }}>
        +2
      </span>
    );
  }
  if (card.value === "rang-badal") {
    return null;
  }
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 leading-none">
      <WildGrid className={big ? "w-[3.2rem]" : "w-10"} />
      <span className={`font-display font-extrabold ${d.center}`} style={{ color: fg }}>
        +4
      </span>
    </div>
  );
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
  const glyphs = glyphForColor(card);
  const isWild = card.color === "wild" || card.value === "rang-badal" || card.value === "chaar-le";
  const isRangBadal = card.value === "rang-badal";

  const shell = (
    <>
      {dim && <div className="pointer-events-none absolute inset-0 z-30 rounded-[14px] bg-ink/[0.08] saturate-[0.72]" aria-hidden />}
      {isRangBadal && (
        <div className="absolute inset-0 z-0 grid grid-cols-2 grid-rows-2 overflow-hidden rounded-[14px] border-[2px] border-ink">
          <div className="h-full w-full" style={{ background: WILD_QUAD.sindoor }} />
          <div className="h-full w-full" style={{ background: WILD_QUAD.haldi }} />
          <div className="h-full w-full" style={{ background: WILD_QUAD.mehndi }} />
          <div className="h-full w-full" style={{ background: WILD_QUAD.neel }} />
        </div>
      )}
      <motion.div layout={false} className="absolute inset-0 z-[1] flex items-center justify-center px-3 py-3">
        <CenterArt card={card} size={size} />
      </motion.div>
      <span className="absolute bottom-2.5 left-2.5 z-20 h-2 w-2 rounded-full bg-ink" aria-hidden />
      <span className="absolute bottom-2 right-2 z-20 rounded-sm border-2 border-ink bg-paper p-0.5 shadow-[1px_1px_0_0_#1e1a17]">
        {isWild ? <WildHatch size={d.icon} /> : <CornerMark kind={glyphs.br} size={d.icon} />}
      </span>
    </>
  );

  const frameStyle: CSSProperties = {
    width: d.w,
    height: d.h,
    ...shadowStyle(shadowPx),
    transform: `translateY(${liftY}px)`,
  };

  const frameClass = `font-display relative shrink-0 rounded-[18px] border-ink bg-paper p-[3px] transition-[transform,box-shadow] duration-150 ${onClick ? "cursor-pointer touch-manipulation" : ""} ${className}`;

  frameStyle.borderWidth = d.border;
  frameStyle.borderStyle = "solid";
  frameStyle.borderColor = INK;

  const inner = (
    <div className="relative h-full w-full overflow-hidden rounded-[14px] border-2 border-[#fffdf8]" style={{ background: bg }}>
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
        className={frameClass}
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
    <div className="flex h-full w-full flex-col items-center justify-center rounded-[14px] border-2 border-[#fffdf8] bg-ink">
      <span className={`font-display font-extrabold uppercase tracking-[0.28em] text-paper ${word}`}>Puno</span>
    </div>
  );

  const style: CSSProperties = { width: d.w, height: d.h, ...shadowStyle(shadowPx), transform: pressed ? "translate(1px,1px)" : undefined };
  const cls = `rounded-[18px] border-4 border-ink bg-paper p-[3px] ${onClick ? "cursor-pointer" : ""}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)} className={cls} style={style} aria-label="Draw from deck">
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
