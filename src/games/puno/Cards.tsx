"use client";
import type { PunoCard, PunoColor } from "./shared";
import { ACTION_LABEL, COLOR_INK, COLOR_LABEL } from "./shared";

function glyph(card: PunoCard) {
  if (card.kind === "number") return String(card.value);
  if (card.value === "ruk-ja") return "✋";
  if (card.value === "ulta") return "↺";
  if (card.value === "do-le") return "+2";
  if (card.value === "rang-badal") return "☼";
  return "+4";
}

export function CardFace({
  card,
  wildTint,
  small,
  dim,
  selected,
  onClick,
}: {
  card: PunoCard;
  /** Shown colour for wild cards once picked. */
  wildTint?: PunoColor | null;
  small?: boolean;
  dim?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const tint: PunoColor | "wild" = card.color === "wild" ? wildTint ?? "wild" : card.color;
  const bg = tint === "wild" ? "#fffdf8" : COLOR_INK[tint];
  const fg = tint === "wild" || tint === "haldi" ? "#1e1a17" : "#fffdf8";
  const label = card.color === "wild" ? ACTION_LABEL[card.value as "rang-badal" | "chaar-le"] : COLOR_LABEL[card.color];
  const h = small ? "h-[4.75rem] w-[3.25rem]" : "h-[7.25rem] w-[4.75rem]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`font-display relative shrink-0 rounded-[10px] border-[2px] border-ink text-left shadow-[3px_3px_0_0_var(--ink)] transition-transform duration-200 ${h} ${dim ? "opacity-40" : ""} ${selected ? "-translate-y-3 scale-105" : ""} ${onClick ? "cursor-pointer" : "cursor-default"}`}
      style={{ background: `linear-gradient(145deg, ${bg} 0%, #fffdf8 55%)`, color: fg }}
    >
      <span className="absolute left-1 top-0.5 text-[0.55rem] font-extrabold uppercase tracking-wide opacity-90">{label}</span>
      <span className="absolute inset-0 flex items-center justify-center text-[1.65rem] font-extrabold leading-none">{glyph(card)}</span>
      <span
        className="pointer-events-none absolute inset-1 rounded-[7px] opacity-30"
        style={{
          backgroundImage: "repeating-linear-gradient(-12deg, transparent, transparent 4px, rgba(30,26,23,0.06) 4px, rgba(30,26,23,0.06) 5px)",
        }}
        aria-hidden
      />
    </button>
  );
}
