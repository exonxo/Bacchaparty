"use client";
import { motion } from "motion/react";
import { type CSSProperties, type ReactNode, useState } from "react";
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

export const FILL_HEX: Record<PunoColor, string> = {
  haldi: "#f2b632",
  sindoor: "#c23a22",
  mehndi: "#2f7d4f",
  neel: "#1d4ed8",
};

type CardSize = "hand" | "small" | "tv";

const DIM: Record<CardSize, { w: string; h: string; border: string; shadow: number; tag: string; center: string; icon: number }> = {
  hand: { w: "w-[58px]", h: "h-[84px]", border: "border-[3px]", shadow: 4, tag: "text-[6px] px-1 py-0.5", center: "text-[2rem]", icon: 9 },
  small: { w: "w-[52px]", h: "h-[76px]", border: "border-[3px]", shadow: 4, tag: "text-[5px] px-0.5 py-px", center: "text-[1.65rem]", icon: 8 },
  tv: { w: "w-[min(14vw,9.5rem)]", h: "h-[min(20vw,13.5rem)]", border: "border-[5px]", shadow: 8, tag: "text-[clamp(0.55rem,1.2vh,0.85rem)] px-2 py-0.5", center: "text-[clamp(2.5rem,8vh,5.5rem)]", icon: 18 },
};

function shadowStyle(px: number): CSSProperties {
  return { boxShadow: `${px}px ${px}px 0 0 ${INK}` };
}

function decoKind(id: string, corner: "bl" | "br"): 0 | 1 | 2 | 3 | 4 {
  let n = 0;
  for (let i = 0; i < id.length; i++) n += id.charCodeAt(i);
  return ((n + (corner === "br" ? 2 : 0)) % 5) as 0 | 1 | 2 | 3 | 4;
}

function CornerMark({ kind, size }: { kind: 0 | 1 | 2 | 3 | 4; size: number }) {
  const stroke = 2;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="shrink-0 text-ink">
      {kind === 0 && <circle cx="8" cy="8" r="5" fill="currentColor" />}
      {kind === 1 && (
        <g fill="none" stroke="currentColor" strokeWidth={stroke}>
          <rect x="3" y="3" width="10" height="10" rx="1" />
          <path d="M5 5 L11 11 M11 5 L5 11" />
        </g>
      )}
      {kind === 2 && (
        <g fill="none" stroke="currentColor" strokeWidth={stroke}>
          <circle cx="8" cy="8" r="3.5" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const r = (a * Math.PI) / 180;
            return <line key={a} x1={8 + Math.cos(r) * 4} y1={8 + Math.sin(r) * 4} x2={8 + Math.cos(r) * 7} y2={8 + Math.sin(r) * 7} />;
          })}
        </g>
      )}
      {kind === 3 && (
        <g fill="none" stroke="currentColor" strokeWidth={stroke}>
          <path d="M4 12 L8 4 L12 12 Z" />
          <path d="M6 9 H10" />
        </g>
      )}
      {kind === 4 && (
        <g fill="currentColor">
          <path d="M8 2 L9.8 6.2 L14 6.2 L10.6 8.8 L12 13 L8 10.4 L4 13 L5.4 8.8 L2 6.2 L6.2 6.2 Z" />
        </g>
      )}
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
    <svg viewBox="0 0 64 32" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="square">
      <path d="M6 16 H34 M30 8 L38 16 L30 24" />
      <path d="M58 16 H30 M34 8 L26 16 L34 24" />
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

function CenterArt({ card, size }: { card: PunoCard; size: CardSize }) {
  const d = DIM[size];
  const isChaar = card.value === "chaar-le";
  const fg = isChaar ? "#fffdf8" : INK;
  if (card.kind === "number") {
    return (
      <span className={`font-display font-extrabold leading-none tracking-tighter ${d.center}`} style={{ color: fg }}>
        {card.value}
      </span>
    );
  }
  if (card.value === "ruk-ja") {
    return (
      <div className="flex flex-col items-center gap-0.5 px-1" style={{ color: fg }}>
        <HandIcon className={size === "tv" ? "h-[clamp(3rem,10vh,6rem)] w-auto" : "h-9 w-auto"} />
        <span className={`font-display font-extrabold uppercase leading-none ${size === "tv" ? "text-[clamp(0.65rem,1.6vh,1.1rem)]" : "text-[7px]"}`}>Ruk Ja</span>
      </div>
    );
  }
  if (card.value === "ulta") {
    return (
      <div className="flex flex-col items-center gap-0.5" style={{ color: fg }}>
        <span className={`font-display font-extrabold uppercase ${size === "tv" ? "text-[clamp(0.7rem,1.8vh,1.2rem)]" : "text-[7px]"}`}>Ulta</span>
        <ReverseIcon className={size === "tv" ? "w-[70%]" : "w-10"} />
      </div>
    );
  }
  if (card.value === "do-le") {
    return (
      <div className="flex flex-col items-center leading-none" style={{ color: fg }}>
        <span className={`font-display font-extrabold ${d.center}`}>+2</span>
        <span className={`font-display font-extrabold uppercase ${size === "tv" ? "text-[clamp(0.65rem,1.6vh,1rem)]" : "text-[7px]"}`}>Do Le</span>
      </div>
    );
  }
  if (card.value === "rang-badal") {
    return (
      <div className="relative flex w-[78%] flex-col items-center">
        <WildGrid className="w-full" />
        <span
          className={`font-display pointer-events-none absolute inset-0 flex items-center justify-center text-center font-extrabold uppercase leading-[0.95] text-ink ${size === "tv" ? "text-[clamp(0.55rem,1.4vh,0.95rem)]" : "text-[6px]"}`}
        >
          Rang
          <br />
          Badal
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center leading-none" style={{ color: fg }}>
      <WildGrid className={size === "tv" ? "mb-2 w-[55%]" : "mb-1 w-10"} />
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
}: {
  card: PunoCard;
  wildTint?: PunoColor | null;
  size?: CardSize;
  dim?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const d = DIM[size];
  const [pressed, setPressed] = useState(false);
  const lift = selected && !pressed;
  const shadowPx = pressed ? Math.max(1, d.shadow - 2) : lift ? d.shadow + 3 : d.shadow;
  const bg = faceBg(card, wildTint);
  const bl = decoKind(card.id, "bl");
  const br = decoKind(card.id, "br");

  const shell = (
    <>
      {dim && (
        <>
          <div className="pointer-events-none absolute inset-0 z-20 rounded-[4px] bg-[color-mix(in_srgb,var(--ink)_40%,transparent)]" aria-hidden />
          <div className="pointer-events-none absolute inset-0 z-[19] rounded-[4px] saturate-[0.45]" aria-hidden />
        </>
      )}
      <span className={`absolute left-0 top-0 z-10 bg-ink font-extrabold uppercase tracking-wide text-paper ${d.tag}`}>{cardTag(card)}</span>
      <div className="absolute inset-0 z-[1] flex items-center justify-center p-1 pt-4">
        <CenterArt card={card} size={size} />
      </div>
      <span className="absolute bottom-0.5 left-0.5 z-10 text-ink">
        <CornerMark kind={bl} size={d.icon} />
      </span>
      <span className="absolute bottom-0.5 right-0.5 z-10 text-ink">
        <CornerMark kind={br} size={d.icon} />
      </span>
    </>
  );

  const className = `font-display relative shrink-0 overflow-hidden rounded-md ${d.border} border-ink text-ink transition-[transform,box-shadow] duration-150 ${d.w} ${d.h} ${
    onClick ? "cursor-pointer touch-manipulation" : ""
  } ${lift ? "-translate-y-2 scale-[1.04]" : pressed ? "translate-x-px translate-y-px" : ""}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        className={className}
        style={{ ...shadowStyle(shadowPx), background: bg }}
      >
        {shell}
      </button>
    );
  }

  return (
    <div className={className} style={{ ...shadowStyle(shadowPx), background: bg }}>
      {shell}
    </div>
  );
}

export function CardBack({ size = "hand", onClick }: { size?: CardSize; onClick?: () => void }) {
  const d = DIM[size];
  const [pressed, setPressed] = useState(false);
  const shadowPx = pressed ? Math.max(1, d.shadow - 2) : d.shadow;
  const label = size === "tv" ? "text-[clamp(1.2rem,3.5vh,2.4rem)]" : "text-sm";

  const inner = (
    <>
      <span className={`absolute left-0 top-0 z-10 bg-ink px-1 py-0.5 font-extrabold uppercase tracking-widest text-paper ${d.tag}`}>PUNO</span>
      <span className={`font-display font-extrabold uppercase tracking-[0.25em] text-paper ${label}`}>Puno</span>
    </>
  );

  const className = `${d.w} ${d.h} relative flex items-center justify-center overflow-hidden rounded-md ${d.border} border-ink bg-ink transition-[transform,box-shadow] duration-150 ${
    onClick ? "cursor-pointer" : ""
  } ${pressed ? "translate-x-px translate-y-px" : ""}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        className={className}
        style={shadowStyle(shadowPx)}
        aria-label="Deck"
      >
        {inner}
      </button>
    );
  }
  return (
    <div className={className} style={shadowStyle(shadowPx)} aria-hidden>
      {inner}
    </div>
  );
}

/** Neo-brutalist control: thick ink border, hard shadow, bold caps. */
export function NeoButton({
  children,
  onClick,
  disabled,
  variant = "paper",
  className = "",
  full,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "paper" | "turmeric" | "vermilion" | "ink";
  className?: string;
  full?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const bg =
    variant === "turmeric"
      ? "var(--turmeric)"
      : variant === "vermilion"
        ? "var(--vermilion)"
        : variant === "ink"
          ? "var(--ink)"
          : "var(--paper)";
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
      className={`font-display min-h-11 border-[3px] border-ink px-3 py-2.5 text-p-body font-extrabold uppercase tracking-wide transition-[transform,box-shadow,opacity] duration-150 ${
        full ? "w-full" : ""
      } ${disabled ? "cursor-not-allowed opacity-45" : ""} ${pressed ? "translate-x-px translate-y-px" : ""} ${className}`}
      style={{ background: bg, color: fg, ...shadowStyle(shadowPx) }}
    >
      {children}
    </button>
  );
}

export function NeoPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-md border-[3px] border-ink bg-paper p-3 ${className}`} style={shadowStyle(4)}>
      {children}
    </div>
  );
}

export function ColorSwatch({ color, label, onClick }: { color: PunoColor; label: string; onClick: () => void }) {
  const [pressed, setPressed] = useState(false);
  const shadowPx = pressed ? 2 : 4;
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className={`font-display flex min-h-14 w-full items-center gap-3 border-[3px] border-ink px-3 py-2 text-left font-extrabold uppercase tracking-wide transition-[transform,box-shadow] duration-150 ${
        pressed ? "translate-x-px translate-y-px" : ""
      }`}
      style={{ background: FILL[color], color: color === "haldi" ? INK : "#fffdf8", ...shadowStyle(shadowPx) }}
    >
      <span className="inline-block h-8 w-8 border-[2px] border-ink bg-paper/20" aria-hidden />
      {label}
    </button>
  );
}

export function DeckStack({ size = "hand", onClick }: { size?: CardSize; onClick?: () => void }) {
  const d = DIM[size];
  const offset = size === "tv" ? 10 : 6;
  return (
    <div className={`relative ${d.w} ${d.h}`}>
      <div className="pointer-events-none absolute opacity-95" style={{ left: offset, top: offset }}>
        <CardBack size={size} />
      </div>
      <motion.div className="absolute left-0 top-0" whileHover={onClick ? { y: -3, x: -2 } : undefined}>
        <CardBack size={size} onClick={onClick} />
      </motion.div>
    </div>
  );
}
