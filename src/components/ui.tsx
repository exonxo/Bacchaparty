"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Level, Player } from "@/lib/types";
import { Avatar } from "./Avatar";

type Tone = "saffron" | "pink" | "teal" | "gold" | "green" | "red" | "blue" | "ghost";

const toneClass: Record<Tone | "me", string> = {
  saffron: "bg-turmeric text-[#1e1a17]",
  pink: "bg-pink text-white",
  teal: "bg-teal text-bg",
  gold: "bg-turmeric text-[#1e1a17]",
  green: "bg-green text-bg",
  red: "bg-red text-white",
  blue: "bg-blue text-white",
  me: "bg-me text-[#1e1a17]",
  ghost: "bg-tint text-ink border border-line hover:bg-tint-2",
};

export function Button({
  tone = "saffron",
  size = "md",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone | "me"; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = { sm: "px-3.5 py-2 text-sm", md: "px-5 py-3 text-base", lg: "px-6 py-4 text-lg", xl: "px-8 py-5 text-xl" };
  return (
    <button
      {...rest}
      className={`${toneClass[tone]} ${sizes[size]} font-display rounded-xl font-bold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none ${className}`}
    />
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function Title({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-2xl font-extrabold tracking-tight ${className}`}>{children}</h2>;
}

export function PlayerChip({ player, highlight, extra }: { player: Player; highlight?: boolean; extra?: ReactNode }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-base font-semibold ${
        highlight ? "bg-saffron text-[#1e1a17]" : "bg-tint"
      } ${player.connected ? "" : "opacity-50"}`}
    >
      <Avatar id={player.avatar} className="text-base" />
      <span className="max-w-[9rem] truncate">{player.name}</span>
      {extra}
    </div>
  );
}

export function Scoreboard({
  players,
  scores,
  title = "Scores",
  big = false,
}: {
  players: Player[];
  scores: Record<string, number>;
  title?: string;
  big?: boolean;
}) {
  const rows = players
    .filter((p) => p.id in scores)
    .map((p) => ({ p, s: scores[p.id] ?? 0 }))
    .sort((a, b) => b.s - a.s);
  return (
    <Panel>
      <div className="mb-3 text-sm font-bold uppercase tracking-widest text-muted">{title}</div>
      <ol className="space-y-1.5">
        {rows.map(({ p, s }, i) => (
          <li key={p.id} className={`flex items-center justify-between gap-3 ${big ? "text-2xl" : "text-lg"}`}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-6 text-muted">{i + 1}.</span>
              <Avatar id={p.avatar} />
              <span className="truncate font-semibold">{p.name}</span>
            </span>
            <span className="font-display font-extrabold text-saffron tabular-nums">{s}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function Countdown({ deadline, now, big = false }: { deadline: number | null | undefined; now: number; big?: boolean }) {
  if (!deadline) return null;
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full font-extrabold tabular-nums ${
        left <= 5 ? "bg-red text-white" : "bg-tint"
      } ${big ? "h-24 w-24 text-5xl" : "h-12 w-12 text-xl"}`}
    >
      {left}
    </div>
  );
}

export function Stopwatch({ since, now }: { since: number | null | undefined; now: number }) {
  if (!since) return null;
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return (
    <span className="rounded-full bg-tint px-4 py-1 font-bold tabular-nums">
      ⏱ {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}

/** Full-height centred message for phones. `emoji` is accepted for older games but no longer shown. */
export function PhoneMessage({ icon, title, children }: { icon?: ReactNode; emoji?: string; title: string; children?: ReactNode }) {
  return (
    <div className="rise-in flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
      {icon && <div className="text-saffron">{icon}</div>}
      <div className="font-display text-2xl font-extrabold">{title}</div>
      {children && <div className="text-base text-muted">{children}</div>}
    </div>
  );
}

export function LevelPicker({ value, onChange }: { value: Level; onChange: (l: Level) => void }) {
  const opts: { v: Level; label: string; hint: string }[] = [
    { v: "kids", label: "🧒 Kids", hint: "Easy, for ages 7–10" },
    { v: "family", label: "👨‍👩‍👧 Family", hint: "Mix of easy & medium" },
    { v: "adults", label: "🧠 Grown-ups", hint: "Harder" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-xl border px-3 py-2 text-left ${value === o.v ? "border-saffron bg-saffron/15" : "border-line bg-tint"}`}
        >
          <div className="font-bold">{o.label}</div>
          <div className="text-xs text-muted">{o.hint}</div>
        </button>
      ))}
    </div>
  );
}

export function NumberPicker({
  label,
  value,
  onChange,
  options,
  format = (n) => String(n),
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  options: number[];
  format?: (n: number) => string;
}) {
  return (
    <div>
      <div className="mb-1 text-sm font-semibold text-muted">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`rounded-lg border px-3 py-1.5 font-bold ${value === n ? "border-saffron bg-saffron/15" : "border-line bg-tint"}`}
          >
            {format(n)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="flex items-center gap-3 text-left">
      <span className={`relative h-7 w-12 rounded-full transition ${value ? "bg-green" : "bg-tint-2"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${value ? "left-6" : "left-1"}`} />
      </span>
      <span className="font-semibold">{label}</span>
    </button>
  );
}

export function TextAnswer({
  onSubmit,
  placeholder = "Type your answer",
  disabled,
  buttonLabel = "Send",
}: {
  onSubmit: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  buttonLabel?: string;
}) {
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem("answer") as HTMLInputElement;
        const v = input.value.trim();
        if (!v) return;
        onSubmit(v);
        input.value = "";
      }}
    >
      <input
        name="answer"
        autoComplete="off"
        autoCapitalize="off"
        disabled={disabled}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-xl border border-line bg-tint px-4 py-3 text-lg outline-none placeholder:text-muted/70 focus:border-saffron"
      />
      <Button type="submit" disabled={disabled}>
        {buttonLabel}
      </Button>
    </form>
  );
}

/** Slide-up panel for phones (game details, scores, settings). */
export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button aria-label="Close" className="fade-in absolute inset-0 bg-ink/45 backdrop-blur-sm" onClick={onClose} />
      <div className="rise-in relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-bg-2 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-tint-2 sm:hidden" />
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <div className="font-display text-xl font-bold">{title}</div>}
          <button onClick={onClose} className="ml-auto rounded-full bg-tint px-3 py-1 text-sm font-semibold text-muted">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Small uppercase label above a section. */
export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`text-[11px] font-bold uppercase tracking-[0.18em] text-muted ${className}`}>{children}</div>;
}
