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

const FILL: Record<PunoColor, string> = {
  haldi: "var(--turmeric)",
  sindoor: "var(--vermilion)",
  mehndi: "var(--leaf)",
  neel: "var(--blue)",
};

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

function HandIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M18 54V22c0-4.4 3.6-8 8-8 .8 0 1.5.1 2.2.4V14c0-4.4 3.6-8 8-8s8 3.6 8 8v2h2c4.4 0 8 3.6 8 8v22c0 6.6-5.4 12-12 12H30c-6.6 0-12-5.4-12-12zm8-30v28h4V18h-4zm12 0v24h4V18h-4zm12 4v20h4V22h-4z"
      />
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
      <div className="aspect-square bg-[var(--vermilion)]" />
      <div className="aspect-square bg-[var(--turmeric)]" />
      <div className="aspect-square bg-[var(--leaf)]" />
      <div className="aspect-square bg-[var(--blue)]" />
    </div>
  );
}

function cardTag(card: PunoCard): string {
  if (card.color === "wild") return "WILD";
  return TAG_CAPS[card.color];
}

function faceBg(card: PunoCard, wildTint?: PunoColor | null): string {
  if (card.value === "chaar-le") return INK;
  if (card.value === "rang-badal") return "var(--paper)";
  if (card.color === "wild") return wildTint ? FILL[wildTint] : "var(--paper)";
  return FILL[card.color];
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
    return (
      <div className="flex flex-col items-center gap-1" style={{ color: fg }}>
        <HandIcon className={big ? "h-16 w-auto" : "h-10 w-auto"} />
        {big && <span className="font-display text-sm font-extrabold uppercase">Ruk Ja</span>}
      </div>
    );
  }
  if (card.value === "ulta") {
    return (
      <div className="flex w-full flex-col items-center gap-0.5 px-1" style={{ color: fg }}>
        <span className={`font-display font-extrabold uppercase ${big ? "text-xl" : "text-[10px]"}`}>Ulta</span>
        <ReverseIcon className={big ? "w-[78%]" : "w-12"} />
      </div>
    );
  }
  if (card.value === "do-le") {
    return (
      <div className="flex flex-col items-center leading-none" style={{ color: fg }}>
        <span className={`font-display font-extrabold ${d.center}`}>+2</span>
        <span className={`font-display font-extrabold uppercase ${big ? "text-sm" : "text-[10px]"}`}>Do Le</span>
      </div>
    );
  }
  if (card.value === "rang-badal") {
    const label = big ? "text-[13px]" : size === "pile" || size === "table" ? "text-[11px]" : "text-[10px]";
    return (
      <div className="relative flex w-[82%] flex-col items-center">
        <WildGrid className="w-full" />
        <span className={`font-display pointer-events-none absolute inset-0 flex items-center justify-center text-center font-extrabold uppercase leading-[0.9] text-ink ${label}`}>
          Rang
          <br />
          Badal
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center leading-none" style={{ color: fg }}>
      <WildGrid className={big ? "mb-2 w-[58%]" : "mb-1 w-12"} />
      <span className={`font-display font-extrabold ${d.center}`}>+4</span>
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

  const shell = (
    <>
      {dim && <div className="pointer-events-none absolute inset-0 z-30 rounded-[10px] bg-ink/[0.08] saturate-[0.72]" aria-hidden />}
      <span className={`absolute left-2 top-2 z-20 rounded-sm border-2 border-ink bg-ink font-extrabold uppercase tracking-tight text-paper ${d.tag}`}>{cardTag(card)}</span>
      <motion.div layout={false} className="absolute inset-0 z-[1] flex items-center justify-center px-2 pb-3 pt-7">
        <CenterArt card={card} size={size} />
      </motion.div>
      <span className="absolute bottom-2 left-2 z-20 text-ink">
        <CornerMark kind={glyphs.bl} size={d.icon} />
      </span>
      {isWild ? (
        <span className="absolute bottom-2 right-2 z-20">
          <WildHatch size={d.icon} />
        </span>
      ) : (
        <span className="absolute bottom-2 right-2 z-20 text-ink">
          <CornerMark kind={glyphs.br} size={d.icon} />
        </span>
      )}
    </>
  );

  const frameStyle: CSSProperties = {
    width: d.w,
    height: d.h,
    ...shadowStyle(shadowPx),
    transform: `translateY(${liftY}px)`,
  };

  const frameClass = `font-display relative shrink-0 rounded-2xl border-ink bg-paper p-[3px] transition-[transform,box-shadow] duration-150 ${onClick ? "cursor-pointer touch-manipulation" : ""} ${className}`;

  frameStyle.borderWidth = d.border;
  frameStyle.borderStyle = "solid";
  frameStyle.borderColor = INK;

  const inner = <div className="relative h-full w-full overflow-visible rounded-xl border-[3px] border-paper" style={{ background: bg }}>{shell}</div>;

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
  const angle = (index / Math.max(1, total)) * Math.PI * 2 + (h % 100) * 0.02;
  const r = 6 + (index % 5) * 5 + (h % 7);
  return {
    rotate: ((h % 50) - 25) * 1.1,
    x: Math.cos(angle) * r,
    y: Math.sin(angle) * r,
    scale: 0.88 - index * 0.04,
    zIndex: index + 1,
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
    <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border-[3px] border-paper/90 bg-ink">
      <span className={`font-display font-extrabold uppercase tracking-[0.28em] text-paper ${word}`}>Puno</span>
    </div>
  );

  const style: CSSProperties = { width: d.w, height: d.h, ...shadowStyle(shadowPx), transform: pressed ? "translate(1px,1px)" : undefined };
  const cls = `rounded-2xl border-4 border-ink bg-ink p-[3px] ${onClick ? "cursor-pointer" : ""}`;

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
  const layers = [4, 3, 2, 1];
  return (
    <div ref={innerRef} className="relative" style={{ width: d.w + step * 5, height: d.h + step * 2 }}>
      {layers.map((i) => (
        <div
          key={i}
          className="pointer-events-none absolute rounded-2xl border-[3px] border-ink bg-paper"
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
      <span className="inline-block h-10 w-10 shrink-0 border-[3px] border-ink" style={{ background: FILL[color] }} />
      <span className="rounded-sm border-[3px] border-ink bg-ink px-2.5 py-1 text-sm font-extrabold uppercase text-paper">{label}</span>
    </button>
  );
}
