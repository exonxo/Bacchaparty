"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Level, Player } from "@/lib/types";

type Tone = "saffron" | "pink" | "teal" | "gold" | "green" | "red" | "blue" | "ghost";

const toneClass: Record<Tone, string> = {
  saffron: "bg-saffron text-bg",
  pink: "bg-pink text-white",
  teal: "bg-teal text-bg",
  gold: "bg-gold text-bg",
  green: "bg-green text-bg",
  red: "bg-red text-white",
  blue: "bg-blue text-white",
  ghost: "bg-white/10 text-ink border border-white/15",
};

export function Button({
  tone = "saffron",
  size = "md",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-5 py-2.5 text-base", lg: "px-6 py-3.5 text-xl", xl: "px-8 py-5 text-2xl" };
  return (
    <button
      {...rest}
      className={`${toneClass[tone]} ${sizes[size]} rounded-2xl font-bold shadow-[0_4px_0_rgba(0,0,0,0.35)] transition active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    />
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-white/10 bg-card/80 p-5 shadow-xl backdrop-blur ${className}`}>{children}</div>;
}

export function Title({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-2xl font-extrabold tracking-tight ${className}`}>{children}</h2>;
}

export function PlayerChip({ player, highlight, extra }: { player: Player; highlight?: boolean; extra?: ReactNode }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-base font-semibold ${
        highlight ? "bg-gold text-bg" : "bg-white/10"
      } ${player.connected ? "" : "opacity-50"}`}
    >
      <span className="text-xl">{player.avatar}</span>
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
              <span>{p.avatar}</span>
              <span className="truncate font-semibold">{p.name}</span>
            </span>
            <span className="font-extrabold text-gold">{s}</span>
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
        left <= 5 ? "bg-red text-white" : "bg-white/10"
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
    <span className="rounded-full bg-white/10 px-4 py-1 font-bold tabular-nums">
      ⏱ {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}

/** Full-height centred message for phones. */
export function PhoneMessage({ emoji, title, children }: { emoji?: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
      {emoji && <div className="text-6xl">{emoji}</div>}
      <div className="text-2xl font-extrabold">{title}</div>
      {children && <div className="text-lg text-muted">{children}</div>}
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
          className={`rounded-2xl border px-3 py-2 text-left ${value === o.v ? "border-gold bg-gold/15" : "border-white/10 bg-white/5"}`}
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
            className={`rounded-xl border px-3 py-1.5 font-bold ${value === n ? "border-gold bg-gold/15" : "border-white/10 bg-white/5"}`}
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
      <span className={`relative h-7 w-12 rounded-full transition ${value ? "bg-green" : "bg-white/20"}`}>
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
        className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-lg outline-none placeholder:text-muted/70 focus:border-gold"
      />
      <Button type="submit" disabled={disabled}>
        {buttonLabel}
      </Button>
    </form>
  );
}
