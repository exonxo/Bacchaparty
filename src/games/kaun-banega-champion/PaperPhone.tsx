"use client";
import { Armchair, Baby, Brain, Check, Flag, Pause, Play, Shield, SkipForward, Trophy, Users } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useState } from "react";
import { dur, ease, screenIn, spring, staggerDelay } from "@/components/paper/motion";
import { InkDefs, Stamp, VerdictSlip } from "@/components/paper/objects";
import { PaperButton, PaperSheet, Sticker } from "@/components/paper/Paper";
import { celebrate } from "@/lib/celebrate";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import type { Level, PhoneProps, Player } from "@/lib/types";
import { LADDER, SAFE, type Priv, type Pub } from "./index";

const NAVY = "#23407a";
const NAVY_DEEP = "#182d57";
const CREAM = "#fffdf8";
const INK = "#1e1a17";

type Shape = "triangle" | "diamond" | "circle" | "square";

/** Each answer has a colour AND a shape, so colour-blind players (and a room shouting "the triangle!") can tell them apart. */
const OPTION_LOOK: { color: string; on: string; shape: Shape; name: string }[] = [
  { color: "#c23a22", on: CREAM, shape: "triangle", name: "Triangle" },
  { color: "#1d4ed8", on: CREAM, shape: "diamond", name: "Diamond" },
  { color: "#2f7d4f", on: CREAM, shape: "circle", name: "Circle" },
  { color: "#f2b632", on: INK, shape: "square", name: "Square" },
];

const LEVELS: { id: Level; name: string; hint: string; Icon: typeof Baby }[] = [
  { id: "kids", name: "Kids", hint: "Aasaan sawaal · 7–10 saal", Icon: Baby },
  { id: "family", name: "Family", hint: "Sabke liye · thode tricky", Icon: Users },
  { id: "adults", name: "Grown-ups", hint: "Mushkil · GK champions", Icon: Brain },
];

const LEVEL_NAME: Record<Level, string> = { kids: "Kids", family: "Family", adults: "Grown-ups" };

function ShapeIcon({ shape, size = 22, fill, stroke = INK }: { shape: Shape; size?: number; fill: string; stroke?: string }) {
  const common = { fill, stroke, strokeWidth: 2, strokeLinejoin: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      {shape === "triangle" && <path d="M12 3 L21.5 20 H2.5 Z" {...common} />}
      {shape === "diamond" && <path d="M12 2 L22 12 L12 22 L2 12 Z" {...common} />}
      {shape === "circle" && <circle cx="12" cy="12" r="9.5" {...common} />}
      {shape === "square" && <rect x="3" y="3" width="18" height="18" rx="2" {...common} />}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Ladder, timer, lifelines                                             */
/* ------------------------------------------------------------------ */

/** Ten rungs in a row: cleared ones are filled, the current one is navy, the safe level carries a shield. */
function Ladder({ rung, phase }: { rung: number; phase: Pub["phase"] }) {
  return (
    <div aria-label={`Level ${rung + 1} of ${LADDER}. Safe level ${SAFE}.`} role="img">
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: LADDER }, (_, i) => {
          const cleared = i < rung || (i === rung && phase === "reveal");
          const current = i === rung;
          const safe = i + 1 === SAFE;
          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <motion.div
                layout
                transition={spring.select}
                className={`font-display flex h-8 w-full items-center justify-center rounded-[3px] border-[1.5px] text-p-note font-extrabold tabular-nums ${
                  current ? "border-ink text-paper" : cleared ? "border-ink bg-leaf text-paper" : "border-line bg-card text-muted"
                }`}
                style={current ? { background: NAVY, boxShadow: "2px 2px 0 0 var(--ink)" } : undefined}
              >
                {i + 1 === LADDER ? <Trophy className="h-3.5 w-3.5" strokeWidth={2.6} /> : i + 1}
              </motion.div>
              <span className="h-3.5">{safe && <Shield className="h-3.5 w-3.5 text-turmeric-ink" strokeWidth={2.6} aria-hidden />}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Timer({ view, now }: { view: Pub; now: number }) {
  const sfx = useSfx();
  const paused = view.pausedLeft !== null;
  const msLeft = paused ? view.pausedLeft! : view.deadline ? Math.max(0, view.deadline - now) : 0;
  const secs = Math.ceil(msLeft / 1000);
  const frac = Math.max(0, Math.min(1, msLeft / (view.seconds * 1000)));
  const urgent = !paused && secs <= 5;
  useOnChange(secs, (n, p) => {
    if (!paused && n < p && n <= 5 && n > 0) sfx.shared("tick");
  });
  return (
    <div role="timer" aria-label={paused ? `Paused with ${secs} seconds left` : `${secs} seconds left`} className="flex items-center gap-3">
      <div className="h-3 flex-1 overflow-hidden rounded-full border-[1.5px] border-ink bg-card">
        <div
          className={`h-full ${urgent ? "bg-vermilion" : ""}`}
          style={{ width: `${frac * 100}%`, background: urgent ? undefined : NAVY, transition: paused ? "none" : "width 0.25s linear", opacity: paused ? 0.45 : 1 }}
        />
      </div>
      <span className={`font-display w-14 text-right text-p-title font-extrabold tabular-nums ${urgent ? "text-vermilion" : ""}`}>{paused ? <Pause className="ml-auto h-6 w-6" /> : `${secs}s`}</span>
    </div>
  );
}

/** A lifeline as a tear-off coupon. Used coupons are stamped. */
function Coupon({ label, hint, used, onUse, Icon }: { label: string; hint: string; used: boolean; onUse?: () => void; Icon: typeof Users }) {
  const live = !!onUse && !used;
  return (
    <button
      type="button"
      disabled={!live}
      onClick={onUse}
      aria-label={used ? `${label}, already used` : label}
      className={`press relative flex min-h-14 items-stretch overflow-hidden rounded-cut border-[1.5px] text-left ${
        used ? "border-line bg-tint text-muted" : live ? "cut border-ink bg-card" : "border-ink bg-card"
      }`}
    >
      <span className={`flex w-11 shrink-0 items-center justify-center border-r-[1.5px] border-dashed ${used ? "border-line" : "border-ink"}`} style={used ? undefined : { background: NAVY, color: CREAM }}>
        <Icon className="h-5 w-5" strokeWidth={2.4} />
      </span>
      <span className="min-w-0 flex-1 px-2.5 py-1.5">
        <span className={`font-display block text-p-body font-extrabold leading-tight ${used ? "line-through decoration-2" : ""}`}>{label}</span>
        <span className="flex items-center gap-1 truncate text-p-note">
          {used && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />}
          {used ? "Ho gaya" : hint}
        </span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Question and answers                                                 */
/* ------------------------------------------------------------------ */

/** Seconds left, also shown on the question card so it stays in view while scrolling to the answers. */
function secondsLeft(view: Pub, now: number) {
  const ms = view.pausedLeft !== null ? view.pausedLeft : view.deadline ? Math.max(0, view.deadline - now) : 0;
  return Math.ceil(ms / 1000);
}

function QuestionCard({ view, now }: { view: Pub; now: number }) {
  const q = view.question!;
  const answering = view.phase === "question";
  const secs = secondsLeft(view, now);
  const paused = view.pausedLeft !== null;
  return (
    <motion.section
      key={q.q}
      aria-label="Question"
      initial={{ rotateX: -18, y: -10, opacity: 0 }}
      animate={{ rotateX: 0, y: 0, opacity: 1, transition: spring.settle }}
      className="cut relative rounded-soft p-4 pb-5"
      style={{ background: NAVY, color: CREAM }}
    >
      <div className="flex items-center justify-between text-p-note font-bold uppercase tracking-[0.16em] opacity-80">
        <span>
          Sawaal {view.rung + 1}
          {view.level && ` · ${LEVEL_NAME[view.level]}`}
        </span>
        {answering && (
          <span
            aria-hidden
            className={`rounded-full border-[1.5px] px-2.5 py-0.5 normal-case tabular-nums tracking-normal ${!paused && secs <= 5 ? "border-paper bg-vermilion text-paper opacity-100" : "border-paper/60"}`}
          >
            {paused ? "Ruka" : `${secs}s`}
          </span>
        )}
      </div>
      <h2 className="font-display mt-2 text-[1.4rem] font-extrabold leading-snug text-balance">{q.q}</h2>
      <div aria-hidden className="absolute inset-x-3 -bottom-[7px] h-2 rounded-b-[4px] border-x-[1.5px] border-b-[1.5px] border-ink" style={{ background: NAVY_DEEP }} />
    </motion.section>
  );
}

function Option({
  i,
  text,
  removed,
  picked,
  correct,
  onPick,
}: {
  i: number;
  text: string;
  removed: boolean;
  /** This is the answer that was locked (by the hot seat, or by me in the audience). */
  picked: boolean;
  /** null until the answer is revealed. */
  correct: number | null;
  onPick?: () => void;
}) {
  const look = OPTION_LOOK[i];
  const revealed = correct !== null;
  const isRight = revealed && correct === i;
  const isWrongPick = revealed && picked && !isRight;
  if (removed) {
    return (
      <div className="flex min-h-14 items-center gap-3 rounded-cut border-[1.5px] border-dashed border-line px-3 text-p-note font-semibold text-muted" aria-label={`${look.name}: removed by 50:50`}>
        <ShapeIcon shape={look.shape} fill="transparent" stroke="var(--line)" />
        50:50 ne hataya
      </div>
    );
  }
  const dim = revealed && !isRight && !isWrongPick;
  return (
    <motion.button
      type="button"
      disabled={!onPick}
      onClick={onPick}
      aria-pressed={picked}
      aria-label={`${look.name}: ${text}`}
      whileTap={onPick ? { scale: 0.97, x: 1, y: 1, boxShadow: "0 0 0 0 var(--ink)", transition: { duration: dur.pressDown, ease: ease.out } } : undefined}
      animate={{ opacity: dim ? 0.4 : 1, rotate: picked && !revealed ? -0.8 : 0 }}
      transition={spring.select}
      className="cut relative flex min-h-[3.75rem] w-full items-center gap-3 rounded-cut px-3 py-2 text-left"
      style={{ background: look.color, color: look.on, outline: picked ? `3px solid ${INK}` : undefined, outlineOffset: 2 }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink bg-paper">
        <ShapeIcon shape={look.shape} fill={look.color} size={20} />
      </span>
      <span className="font-display min-w-0 flex-1 text-p-lead font-extrabold leading-tight">{text}</span>
      {(picked || isRight) && (
        <motion.span
          key={isRight ? "right" : isWrongPick ? "wrong" : "lock"}
          className="pointer-events-none -my-2 shrink-0 origin-right"
          initial={{ scale: 1.6, opacity: 0, rotate: -18 }}
          animate={{ scale: 0.62, opacity: 1, rotate: -10, transition: { duration: 0.22, ease: ease.out } }}
        >
          <span className="inline-block rounded-cut bg-paper">
            <Stamp tone={isRight ? "leaf" : isWrongPick ? "vermilion" : "ink"}>{isRight ? "Sahi" : isWrongPick ? "Galat" : "Lock"}</Stamp>
          </span>
        </motion.span>
      )}
    </motion.button>
  );
}

/** Ask the Family: how the audience voted, only for options still on the card. */
function FamilyBars({ counts, removed }: { counts: number[]; removed: number[] }) {
  const shown = counts.map((c, i) => ({ c, i })).filter(({ i }) => !removed.includes(i));
  const total = shown.reduce((a, b) => a + b.c, 0);
  return (
    <section aria-label="Ask the Family results" className="cut rounded-cut bg-card p-3">
      <div className="font-display text-p-body font-extrabold">Family ne kya kaha</div>
      {total === 0 && <p className="mt-1 text-p-note text-muted">Abhi kisi ne vote nahi kiya. Audience jaise jaise jawab dega, yahan bars dikhenge.</p>}
      <ul className={`mt-2 space-y-1.5 ${total === 0 ? "hidden" : ""}`}>
        {shown.map(({ c, i }) => {
          const pct = total ? Math.round((c / total) * 100) : 0;
          const look = OPTION_LOOK[i];
          return (
            <li key={i} className="flex items-center gap-2">
              <ShapeIcon shape={look.shape} fill={look.color} size={18} />
              <div className="h-5 flex-1 overflow-hidden rounded-[3px] border-[1.5px] border-ink bg-paper">
                <motion.div className="h-full" style={{ background: look.color }} initial={{ width: 0 }} animate={{ width: `${pct}%`, transition: { duration: dur.reveal, ease: ease.expo } }} />
              </div>
              <span className="w-10 text-right text-p-note font-bold tabular-nums">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Standings                                                            */
/* ------------------------------------------------------------------ */

function Standings({ view, players, me }: { view: Pub; players: Player[]; me: Player }) {
  const rows = players
    .filter((p) => p.id in view.scores || p.connected)
    .map((p) => ({ p, best: view.best[p.id] ?? 0, bonus: view.bonus[p.id] ?? 0, total: view.scores[p.id] ?? 0, played: view.played.includes(p.id) }))
    .sort((a, b) => b.total - a.total || a.p.name.localeCompare(b.p.name));
  return (
    <section aria-label="Standings" className="mt-6">
      <h3 className="text-p-note font-bold uppercase tracking-[0.16em] text-muted">Score board</h3>
      <ul className="mt-2 border-t-[1.5px] border-ink">
        {rows.map(({ p, best, bonus, total, played }, i) => (
          <motion.li
            key={p.id}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: p.connected ? 1 : 0.5, y: 0, transition: { duration: dur.screen, ease: ease.out, delay: staggerDelay(i) } }}
            className="flex items-center gap-3 border-b-[1.5px] border-line py-2"
          >
            <span className="w-5 text-p-note font-bold text-muted tabular-nums">{i + 1}</span>
            <Sticker id={p.avatar} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-p-body font-bold">
                {p.name} {p.id === me.id && <span className="text-p-note font-semibold text-muted">you</span>}
              </span>
              <span className="block text-p-note text-muted">
                {played ? `Hot seat: Level ${best}` : "Hot seat baaki hai"}
                {bonus > 0 && ` · +${bonus} audience`}
              </span>
            </span>
            <span className="font-display text-p-title font-extrabold tabular-nums">{total}</span>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Host controls                                                        */
/* ------------------------------------------------------------------ */

function HostBar({ children }: { children: React.ReactNode }) {
  return (
    <section aria-label="Host controls" className="mt-6 border-t-[1.5px] border-dashed border-ink/40 pt-4">
      <h3 className="mb-2 text-p-note font-bold uppercase tracking-[0.16em] text-muted">Host ke controls</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Phases                                                               */
/* ------------------------------------------------------------------ */

function PickStage({ view, players, me, isHost, hostAct }: PhoneProps<Pub, Priv>) {
  const online = players.filter((p) => p.connected);
  if (isHost) {
    return (
      <div>
        <h1 className="text-p-show font-extrabold leading-none">Hot seat par kaun?</h1>
        <p className="mt-2 text-p-body text-muted">Tap a player. Baaki sab audience mein chupke se khelenge aur bonus kamayenge.</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {online.map((p, i) => {
            const played = view.played.includes(p.id);
            return (
              <motion.button
                key={p.id}
                type="button"
                onClick={() => hostAct("hotseat", p.id)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { duration: dur.screen, ease: ease.out, delay: staggerDelay(i) } }}
                whileTap={{ scale: 0.96, transition: { duration: dur.pressDown } }}
                className="cut relative flex min-h-[8.5rem] flex-col items-center justify-center gap-2 rounded-soft bg-card p-3 text-center"
                style={{ rotate: `${[-1.2, 0.8, -0.5, 1.1][i % 4]}deg` }}
              >
                <Sticker id={p.avatar} size={60} />
                <span className="font-display w-full truncate text-p-lead font-extrabold">{p.id === me.id ? `${p.name} (you)` : p.name}</span>
                <span className="text-p-note font-semibold text-muted">{played ? `Pehle: Level ${view.best[p.id] ?? 0}` : "Abhi tak nahi khela"}</span>
              </motion.button>
            );
          })}
        </div>
        <Standings view={view} players={players} me={me} />
      </div>
    );
  }
  return (
    <div>
      <div className="cut flex items-center gap-4 rounded-soft p-4" style={{ background: NAVY, color: CREAM }}>
        <Armchair className="breathe h-12 w-12 shrink-0" strokeWidth={1.8} />
        <div>
          <h1 className="font-display text-p-title font-extrabold leading-tight">Host hot seat chun raha hai…</h1>
          <p className="mt-1 text-p-body opacity-85">Aapka naam bhi aa sakta hai! Taiyaar raho.</p>
        </div>
      </div>
      <Standings view={view} players={players} me={me} />
    </div>
  );
}

function LevelStage({ view, players, me, send, isHost, hostAct }: PhoneProps<Pub, Priv>) {
  const isHot = view.hotSeat === me.id;
  const hot = players.find((p) => p.id === view.hotSeat);
  return (
    <div>
      {isHot ? (
        <>
          <motion.div
            initial={{ scale: 0.85, rotate: -4, opacity: 0 }}
            animate={{ scale: 1, rotate: -1.2, opacity: 1, transition: spring.settle }}
            className="cut flex items-center gap-4 rounded-soft p-4"
            style={{ background: NAVY, color: CREAM }}
          >
            <Armchair className="h-12 w-12 shrink-0" strokeWidth={1.8} />
            <div>
              <h1 className="font-display text-p-title font-extrabold leading-tight">Aap hot seat par ho!</h1>
              <p className="mt-0.5 text-p-body opacity-85">Sab aapko dekh rahe hain. Shabash!</p>
            </div>
          </motion.div>
          <p className="mt-5 text-p-lead">Apna level chuno. Saare sawaal isi level ke honge.</p>
          <div className="mt-5 space-y-3">
            {LEVELS.map(({ id, name, hint, Icon }, i) => (
              <motion.button
                key={id}
                type="button"
                onClick={() => send("level", id)}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0, transition: { duration: dur.screen, ease: ease.out, delay: staggerDelay(i, 0.15) } }}
                whileTap={{ scale: 0.97, transition: { duration: dur.pressDown } }}
                className="cut flex min-h-[4.5rem] w-full items-center gap-4 rounded-soft bg-card px-4 text-left"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink" style={{ background: NAVY, color: CREAM }}>
                  <Icon className="h-6 w-6" strokeWidth={2.2} />
                </span>
                <span>
                  <span className="font-display block text-p-lead font-extrabold">{name}</span>
                  <span className="block text-p-note text-muted">{hint}</span>
                </span>
              </motion.button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center text-center">
          <span className="breathe mt-4 inline-block">
            <Sticker id={hot?.avatar} size={88} tilt={-5} />
          </span>
          <h1 className="mt-4 text-p-title font-extrabold">{hot?.name ?? "Koi"} hot seat par hai!</h1>
          <p className="mt-1 text-p-body text-muted">Level chun rahe hain… Aap audience ho: har sahi jawab pe +1 bonus.</p>
          {hot && !hot.connected && <p className="mt-3 text-p-note font-semibold text-vermilion">{hot.name} ka phone disconnected hai. Thodi der mein skip ho jayega.</p>}
        </div>
      )}
      {isHost && (
        <HostBar>
          <div className="text-p-note text-muted">Galat insaan? Kisi aur ko bithao:</div>
          <div className="flex flex-wrap gap-2">
            {players
              .filter((p) => p.connected && p.id !== view.hotSeat)
              .map((p) => (
                <button key={p.id} type="button" onClick={() => hostAct("hotseat", p.id)} className="press flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-line bg-card py-1 pl-1 pr-3 text-p-body font-bold">
                  <Sticker id={p.avatar} size={30} /> {p.name}
                </button>
              ))}
          </div>
          <SkipButton hostAct={hostAct} name={hot?.name} />
        </HostBar>
      )}
    </div>
  );
}

function SkipButton({ hostAct, name }: { hostAct: PhoneProps<Pub, Priv>["hostAct"]; name?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PaperButton tone="paper" onClick={() => setOpen(true)}>
        <SkipForward className="h-4 w-4" /> Hot seat skip karo
      </PaperButton>
      <PaperSheet open={open} onClose={() => setOpen(false)} title={`${name ?? "Is player"} ko skip karein?`}>
        <p className="text-p-body text-muted">Unka score wahi rahega. Aap agla hot seat chun sakte ho.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <PaperButton tone="paper" size="lg" onClick={() => setOpen(false)}>
            Rehne do
          </PaperButton>
          <PaperButton
            tone="vermilion"
            size="lg"
            onClick={() => {
              hostAct("skip");
              setOpen(false);
            }}
          >
            Skip
          </PaperButton>
        </div>
      </PaperSheet>
    </>
  );
}

function PlayStage({ view, priv, players, me, send, now, isHost, hostAct }: PhoneProps<Pub, Priv>) {
  const [quitOpen, setQuitOpen] = useState(false);
  const isHot = view.hotSeat === me.id;
  const hot = players.find((p) => p.id === view.hotSeat);
  const q = view.question!;
  const answering = view.phase === "question";
  const revealed = view.phase === "reveal" ? view.answer : null;
  const mine = priv?.myAnswer ?? null;
  const right = revealed !== null && view.hotAnswer === revealed;
  const lastRung = view.rung === LADDER - 1;

  const pick = (i: number) => {
    if (isHot && answering) send("answer", i);
    else if (!isHot && mine === null && (view.phase === "question" || view.phase === "locked")) send("audience", i);
  };
  const canPick = isHot ? answering : mine === null && (view.phase === "question" || view.phase === "locked");

  return (
    <div>
      {/* Who's playing and where they are on the ladder */}
      <div className="flex items-center gap-3">
        <Sticker id={hot?.avatar} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-display truncate text-p-body font-extrabold leading-tight">{isHot ? "Aap hot seat par ho" : `${hot?.name ?? "Koi"} hot seat par`}</div>
          <div className="text-p-note text-muted">
            Level {view.rung + 1} of {LADDER} · safe at {SAFE}
          </div>
        </div>
        {!isHot && <span className="rounded-cut border-[1.5px] border-ink bg-turmeric px-2 py-0.5 text-p-note font-bold text-ink">Audience</span>}
      </div>
      <div className="mt-3">
        <Ladder rung={view.rung} phase={view.phase} />
      </div>

      {answering && (
        <div className="mt-3">
          <Timer view={view} now={now} />
        </div>
      )}

      <div className="mt-4">
        <QuestionCard view={view} now={now} />
      </div>

      <div className="mt-5 grid gap-2.5">
        {q.options.map((text, i) => (
          <Option
            key={i}
            i={i}
            text={text}
            removed={view.removed.includes(i)}
            picked={isHot ? view.hotAnswer === i : mine === i}
            correct={revealed}
            onPick={canPick ? () => pick(i) : undefined}
          />
        ))}
      </div>

      {/* What's happening, in words */}
      <div aria-live="polite" className="mt-4 min-h-6 text-center">
        {view.phase === "question" &&
          (isHot ? (
            <p className="text-p-body text-muted">Soch ke tap karo — tap karte hi jawab lock ho jayega.</p>
          ) : mine === null ? (
            <p className="text-p-body text-muted">Chupke se jawab do: sahi hua toh +1 bonus.</p>
          ) : (
            <p className="text-p-body font-semibold">Aapka jawab lock. {hot?.name ?? "Hot seat"} abhi soch raha hai…</p>
          ))}
        {view.phase === "locked" && (
          <p className="text-p-body font-semibold">{isHot ? "Lock ho gaya! Host jawab kholega." : `${hot?.name ?? "Hot seat"} ne jawab lock kar diya. Dil thaam ke baitho…`}</p>
        )}
        {view.phase === "reveal" && (
          <>
            {!isHot && <p className="mb-1 text-p-note font-bold uppercase tracking-[0.14em] text-muted">{hot?.name ?? "Hot seat"} ka jawab</p>}
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1, transition: spring.settle }} className="inline-block">
              <VerdictSlip tone={view.timedOut ? "ink" : right ? "leaf" : "vermilion"} seed={view.rung + 3} tilt={-3}>
                {view.timedOut ? "Time khatam!" : right ? (lastRung ? "Champion!" : "Sahi jawab!") : "Galat jawab"}
              </VerdictSlip>
            </motion.div>
          </>
        )}
        {view.phase === "reveal" && !isHot && (
          <p className="mt-3 text-p-body font-semibold">
            {mine === null ? "Aapne is baar audience jawab nahi diya." : mine === revealed ? "Aur aapka audience jawab bhi sahi: +1 bonus!" : "Aapka audience jawab galat tha. Agla sawaal!"}
          </p>
        )}
        {view.phase === "reveal" && !right && (
          <p className="mt-2 text-p-body text-muted">{view.rung >= SAFE ? `Safe level ne bacha liya: Level ${SAFE} pakka.` : "Safe level tak nahi pahunche, is baar Level 0."}</p>
        )}
      </div>

      {/* Lifelines */}
      {view.phase !== "reveal" && (
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Coupon label="50:50" hint="Do galat hatao" used={view.lifelines.fifty} Icon={Flag} onUse={isHot && answering ? () => send("fifty") : undefined} />
          <Coupon label="Family vote" hint="Audience se poocho" used={view.lifelines.family} Icon={Users} onUse={isHot && answering ? () => send("family") : undefined} />
        </div>
      )}
      {view.family && <div className="mt-4">{<FamilyBars counts={view.family} removed={view.removed} />}</div>}

      {isHot && answering && (
        <button type="button" onClick={() => setQuitOpen(true)} className="press mx-auto mt-5 flex min-h-11 items-center gap-2 text-p-body font-semibold underline decoration-line decoration-2 underline-offset-4">
          Yahin ruk jao, Level {view.rung} le jao
        </button>
      )}

      {isHost && (
        <HostBar>
          {view.phase === "locked" && (
            <PaperButton size="lg" onClick={() => hostAct("reveal")}>
              <Check className="h-5 w-5" /> Jawab kholo
            </PaperButton>
          )}
          {view.phase === "reveal" && right && !lastRung && (
            <PaperButton size="lg" onClick={() => hostAct("next")}>
              <SkipForward className="h-5 w-5" /> Agla sawaal
            </PaperButton>
          )}
          {view.phase === "reveal" && (!right || lastRung) && (
            <PaperButton size="lg" onClick={() => hostAct("finish")}>
              <Trophy className="h-5 w-5" /> Result dekho
            </PaperButton>
          )}
          {view.phase === "question" && (
            <PaperButton tone="paper" onClick={() => hostAct("pause")}>
              {view.pausedLeft !== null ? (
                <>
                  <Play className="h-4 w-4" /> Timer chalu karo
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" /> Timer roko
                </>
              )}
            </PaperButton>
          )}
          {view.phase !== "reveal" && <SkipButton hostAct={hostAct} name={hot?.name} />}
          {hot && !hot.connected && <p className="text-p-note font-semibold text-vermilion">{hot.name} ka phone disconnected hai. 10 second mein apne aap skip hoga.</p>}
        </HostBar>
      )}

      <PaperSheet open={quitOpen} onClose={() => setQuitOpen(false)} title="Khel chhodna hai?">
        <p className="text-p-body">
          Aap <b>Level {view.rung}</b> ke saath nikal jaoge. Agar aage galat hua toh {view.rung >= SAFE ? `Level ${SAFE}` : "Level 0"} hi milega.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <PaperButton tone="paper" size="lg" onClick={() => setQuitOpen(false)}>
            Khelte hain
          </PaperButton>
          <PaperButton
            tone="vermilion"
            size="lg"
            onClick={() => {
              send("quit");
              setQuitOpen(false);
            }}
          >
            Ruk jao
          </PaperButton>
        </div>
      </PaperSheet>
    </div>
  );
}

function OverStage({ view, players, me, isHost, hostAct }: PhoneProps<Pub, Priv>) {
  const r = view.result!;
  const who = players.find((p) => p.id === r.playerId);
  const mine = r.playerId === me.id;
  const everyone = players.filter((p) => p.connected);
  const allPlayed = everyone.length > 0 && everyone.every((p) => view.played.includes(p.id));
  const title =
    r.how === "champion"
      ? `${mine ? "Aap" : who?.name ?? "Koi"} Champion!`
      : r.how === "quit"
        ? `${mine ? "Aap" : who?.name ?? "Koi"} Level ${r.won} pe ruke`
        : `${mine ? "Aap" : who?.name ?? "Koi"} Level ${r.won} tak`;
  const line =
    r.how === "champion"
      ? "Saare 10 level paar! Kamaal kar diya."
      : r.how === "quit"
        ? "Samajhdari se khel chhoda."
        : r.won
          ? `Galat jawab, par safe level ${SAFE} ne bacha liya.`
          : "Galat jawab. Agli baar pakka!";
  return (
    <div>
      <div className="flex flex-col items-center text-center">
        <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1, transition: spring.settle }}>
          <Sticker id={who?.avatar} size={84} tilt={-5} />
        </motion.div>
        <h1 aria-live="polite" className="mt-4 text-p-show font-extrabold leading-none text-balance">
          {title}
        </h1>
        <p className="mt-2 text-p-lead text-muted">{line}</p>
        <motion.div className="mt-4" initial={{ scale: 1.6, opacity: 0, rotate: -16 }} animate={{ scale: 1, opacity: 1, rotate: -6, transition: { delay: 0.35, duration: 0.22, ease: ease.out } }}>
          <Stamp tone={r.how === "champion" ? "leaf" : r.how === "quit" ? "ink" : "vermilion"}>{r.how === "champion" ? "Champion" : r.how === "quit" ? "Ruk gaye" : "Out"}</Stamp>
        </motion.div>
      </div>
      {allPlayed && <p className="mt-6 rounded-cut border-[1.5px] border-ink bg-turmeric px-3 py-2 text-center text-p-body font-bold text-ink">Sab ne hot seat le li! Lobby jao, ya phir se ek round khelo.</p>}
      <Standings view={view} players={players} me={me} />
      {isHost ? (
        <HostBar>
          <PaperButton size="lg" onClick={() => hostAct("nextSeat")}>
            <Armchair className="h-5 w-5" /> Agla hot seat
          </PaperButton>
        </HostBar>
      ) : (
        <p className="mt-6 text-center text-p-body text-muted">Host agla hot seat chunega…</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phone                                                                */
/* ------------------------------------------------------------------ */

export function Phone(props: PhoneProps<Pub, Priv>) {
  const { view, priv, me } = props;
  const sfx = useSfx();
  const isHot = view.hotSeat === me.id;

  useOnChange(view.phase, (next) => {
    if (next === "level" && isHot) sfx.mine("turn", [60, 40, 60]);
    if (next === "question") sfx.shared("whoosh");
    if (next === "reveal") {
      sfx.shared("reveal");
      const right = view.answer !== null && view.hotAnswer === view.answer;
      if (isHot) {
        if (right) sfx.mine("ding", [40]);
        else sfx.mine("buzz", [200]);
      } else if (priv?.myAnswer !== null && priv?.myAnswer !== undefined) {
        if (priv.myAnswer === view.answer) sfx.mine("ding", [30]);
      }
    }
    if (next === "over" && view.result?.how === "champion") {
      sfx.shared("fanfare");
      celebrate();
    }
  });
  useOnChange(view.rung, (n, p) => {
    if (n > p) sfx.shared("whoosh");
  });

  const stageKey =
    view.phase === "pick" ? "pick" : view.phase === "level" ? `level-${view.hotSeat}` : view.phase === "over" ? "over" : `play-${view.hotSeat}`;
  const stage =
    view.phase === "pick" ? (
      <PickStage {...props} />
    ) : view.phase === "level" ? (
      <LevelStage {...props} />
    ) : view.phase === "over" && view.result ? (
      <OverStage {...props} />
    ) : view.question ? (
      <PlayStage {...props} />
    ) : (
      <PickStage {...props} />
    );

  return (
    <MotionConfig reducedMotion="user">
      <InkDefs />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={stageKey} {...screenIn} className="overflow-x-clip pb-2">
          {stage}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}
