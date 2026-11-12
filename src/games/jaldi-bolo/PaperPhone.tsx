"use client";
import { Check, Gavel, PenLine, SkipForward, Trophy } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { CountUp, PaperButton, PaperSheet, Sticker } from "@/components/paper/Paper";
import { dur, ease, screenIn, spring, staggerDelay } from "@/components/paper/motion";
import { InkDefs, Stamp } from "@/components/paper/objects";
import { celebrate } from "@/lib/celebrate";
import { playerColor } from "@/lib/colors";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import type { PhoneProps, Player } from "@/lib/types";
import { CATEGORIES, LETTERS, N, startsWithLetter, type Priv, type Pub } from "./shared";

/* Notebook palette */
export const COVER = "#cfe0f5";
export const BLUE_INK = "#1d3f78";
export const RULE = "rgba(70, 120, 200, 0.32)";
export const MARGIN = "rgba(214, 72, 56, 0.7)";
export const PAGE = "#fffef8";
export const RED_PEN = "#c8281e";

export function ranked(players: Player[], scores: Record<string, number>) {
  return players
    .filter((p) => p.id in scores)
    .map((p) => ({ p, s: scores[p.id] ?? 0 }))
    .sort((a, b) => b.s - a.s);
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                         */
/* ------------------------------------------------------------------ */

/** My score; counts up when it changes. */
function ScoreTick({ score }: { score: number }) {
  const prev = useRef(score);
  const from = prev.current;
  useEffect(() => {
    prev.current = score;
  }, [score]);
  return <CountUp key={score} from={from} to={score} />;
}

function TopBar({ round, rounds, score, onScores }: { round: number; rounds: number; score: number; onScores: () => void }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <div>
        <div className="font-display text-p-title font-extrabold leading-none">
          Akshar {round}
          <span className="text-p-lead font-bold text-muted"> / {rounds}</span>
        </div>
        <div className="mt-1.5 flex gap-1" aria-hidden>
          {Array.from({ length: rounds }, (_, i) => (
            <span
              key={i}
              className="h-1.5 w-3.5 rounded-full border border-ink transition-colors duration-300"
              style={{ background: i < round - 1 ? "var(--ink)" : i === round - 1 ? COVER : "transparent" }}
            />
          ))}
        </div>
      </div>
      <button
        onClick={onScores}
        aria-label={`Your score: ${score}. Show all scores`}
        className="press flex h-11 items-center gap-1.5 rounded-cut border-[1.5px] border-ink/25 px-2.5 text-p-body font-bold"
      >
        <Trophy className="h-4 w-4 text-turmeric-ink" strokeWidth={2.4} /> <ScoreTick score={score} />
      </button>
    </div>
  );
}

/** A ruler-like strip that shortens; calm until the last five seconds. */
function TimeStrip({ deadline, seconds, now, label }: { deadline: number; seconds: number; now: number; label: string }) {
  const left = Math.max(0, deadline - now);
  const secs = Math.ceil(left / 1000);
  const pct = Math.max(0, Math.min(100, (left / (seconds * 1000)) * 100));
  const low = secs <= 5;
  return (
    <div role="timer" aria-label={`${secs} seconds left`} className="flex items-center gap-3">
      <span className="w-14 text-p-note font-semibold text-muted">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full border-[1.5px] border-ink bg-paper">
        <div className="h-full" style={{ width: `${pct}%`, background: low ? "var(--vermilion)" : BLUE_INK, transition: "width 0.3s linear, background-color 0.3s" }} />
      </div>
      <span className={`font-display w-10 text-right text-p-title font-extrabold tabular-nums ${low ? "text-vermilion" : ""}`}>{secs}</span>
    </div>
  );
}

/** Two taps to confirm; the second tap must come within 3 seconds. */
function ConfirmButton({ label, confirmLabel, onConfirm, icon, now }: { label: string; confirmLabel: string; onConfirm: () => void; icon: ReactNode; now: number }) {
  const [armedAt, setArmedAt] = useState<number | null>(null);
  const armed = armedAt !== null && now - armedAt < 3000;
  return (
    <PaperButton
      tone={armed ? "vermilion" : "paper"}
      className="w-full"
      onClick={() => {
        if (armed) {
          setArmedAt(null);
          onConfirm();
        } else setArmedAt(now);
      }}
    >
      {icon} {armed ? confirmLabel : label}
    </PaperButton>
  );
}

/** The letter, rubber-stamped in blue ink. While shuffling it flicks through letters. */
export function LetterStamp({ letter, shuffling, now, size = 92 }: { letter: string; shuffling: boolean; now: number; size?: number }) {
  const shown = shuffling ? LETTERS[Math.floor(now / 90) % LETTERS.length] : letter;
  return (
    <motion.div
      key={shuffling ? "shuffle" : letter}
      initial={shuffling ? false : { scale: 1.6, rotate: -18, opacity: 0 }}
      animate={{ scale: 1, rotate: -6, opacity: 1 }}
      transition={spring.settle}
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        color: BLUE_INK,
        border: `4px solid ${BLUE_INK}`,
        outline: `1.5px solid ${BLUE_INK}`,
        outlineOffset: 3,
        filter: "url(#ink-rough)",
        opacity: shuffling ? 0.55 : 1,
      }}
    >
      <span className="font-display font-extrabold leading-none" style={{ fontSize: size * 0.62 }}>
        {shown}
      </span>
    </motion.div>
  );
}

/** A school notebook page: blue ruled lines, a red margin and a little paper grain. */
export function NotebookPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`cut relative overflow-hidden rounded-cut ${className}`}
      style={{
        background: `linear-gradient(to right, transparent 2.6rem, ${MARGIN} 2.6rem, ${MARGIN} calc(2.6rem + 1.5px), transparent calc(2.6rem + 1.5px)), ${PAGE}`,
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Writing                                                              */
/* ------------------------------------------------------------------ */

function AnswerRow({
  i,
  value,
  letter,
  disabled,
  onChange,
  onEnter,
  hideLetter,
}: {
  i: number;
  value: string;
  letter: string;
  disabled: boolean;
  /** While the letter is still shuffling, don't hint it in the placeholder. */
  hideLetter: boolean;
  onChange: (v: string) => void;
  onEnter: () => void;
}) {
  const id = useId();
  const c = CATEGORIES[i];
  const wrong = value.trim().length > 0 && !startsWithLetter(value, letter);
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  return (
    <div className="flex items-start">
      <span className="w-[2.6rem] shrink-0 pt-[1.85rem] text-center font-display text-p-lead font-extrabold leading-none" style={{ color: MARGIN }} aria-hidden>
        {i + 1}.
      </span>
      <div className="min-w-0 flex-1 pl-3 pr-4 pt-2.5">
        <label htmlFor={id} className="flex items-baseline gap-1.5 text-p-note font-bold uppercase tracking-[0.12em]" style={{ color: BLUE_INK }}>
          {c.desi}
          {c.desi !== c.label && <span className="font-semibold normal-case tracking-normal text-muted">· {c.label}</span>}
        </label>
        <input
          ref={ref}
          id={id}
          value={value}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint={i === N - 1 ? "done" : "next"}
          aria-invalid={wrong}
          aria-describedby={wrong ? `${id}-warn` : undefined}
          onFocus={() => {
            setFocused(true);
            // Wait for the on-screen keyboard, then keep this line in view.
            setTimeout(() => ref.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 280);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            }
          }}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hideLetter ? "…" : `${letter}…`}
          className={`font-display block h-11 w-full border-b-[1.5px] bg-transparent text-p-lead font-bold outline-none transition-colors duration-200 placeholder:font-semibold placeholder:text-ink/25 focus-visible:outline-none disabled:opacity-100 ${
            wrong ? "border-vermilion text-vermilion focus:border-b-2" : "focus:border-b-2"
          }`}
          // The underline is the focus indicator here (thicker + darker), so the global outline box is turned off.
          style={{ color: wrong ? undefined : BLUE_INK, borderBottomColor: wrong ? RED_PEN : focused ? BLUE_INK : RULE, outline: "none" }}
          onBlur={() => setFocused(false)}
        />
        <div className="flex h-6 items-center">
          {wrong && (
            <p id={`${id}-warn`} className="text-p-note font-semibold leading-tight text-vermilion">
              “{letter}” se shuru karo — ye gine nahi jayega
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Who has finished writing — stickers land as people tap "Ho gaya!". */
function Roster({ view, players, me }: { view: Pub; players: Player[]; me: Player }) {
  const people = view.participants.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => !!p);
  const counted = people.filter((p) => p.connected || view.done.includes(p.id));
  const done = counted.filter((p) => view.done.includes(p.id)).length;
  return (
    <section aria-label="Who has finished">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-p-note font-semibold uppercase tracking-[0.14em] text-muted">Kisne likh liya</h3>
        <span className="text-p-body font-bold tabular-nums">
          {done}/{counted.length} ne likh liya
        </span>
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-2">
        {people.map((p) => {
          const fin = view.done.includes(p.id);
          return (
            <li key={p.id} className={`flex w-16 flex-col items-center gap-0.5 ${p.connected || fin ? "" : "opacity-40"}`}>
              {fin ? (
                <motion.span initial={{ y: -14, scale: 0.6, rotate: -12, opacity: 0 }} animate={{ y: 0, scale: 1, rotate: 0, opacity: 1 }} transition={spring.settle} className="relative">
                  <Sticker id={p.avatar} size={40} />
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-ink bg-leaf text-paper">
                    <Check className="h-3 w-3" strokeWidth={3.5} />
                  </span>
                </motion.span>
              ) : (
                <span className="breathe flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-dashed border-ink/40">
                  <PenLine className="h-4 w-4 text-muted" />
                </span>
              )}
              <span className={`w-full truncate text-center text-p-note font-semibold ${fin ? "" : "text-muted"}`}>{p.id === me.id ? "You" : p.name}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Writing({
  view,
  priv,
  me,
  players,
  send,
  now,
  isHost,
  hostAct,
}: {
  view: Pub;
  priv: Priv | undefined;
  me: Player;
  players: Player[];
  send: (t: string, p?: unknown) => void;
  now: number;
  isHost: boolean;
  hostAct: (t: string, p?: unknown) => void;
}) {
  const { mine } = useSfx();
  const [vals, setVals] = useState<string[]>(() => priv?.answers ?? Array(N).fill(""));
  const roundRef = useRef(view.round);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shuffling = now < view.revealAt;
  const done = priv?.done ?? false;
  const playing = view.participants.includes(me.id);
  const filled = vals.filter((v) => v.trim() && startsWithLetter(v, view.letter)).length;

  // New letter: clear the page. Reconnect: restore what the host has.
  useEffect(() => {
    if (roundRef.current !== view.round) {
      roundRef.current = view.round;
      setVals(Array(N).fill(""));
    }
  }, [view.round]);
  useEffect(() => {
    if (priv?.answers && priv.answers.some((a) => a) && vals.every((v) => !v)) setVals(priv.answers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priv?.answers]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Keep the focused line visible when the on-screen keyboard resizes the page.
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const onResize = () => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement && el.closest("[data-notebook]")) el.scrollIntoView({ block: "center" });
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const update = (i: number, v: string) => {
    const next = vals.slice();
    next[i] = v.slice(0, 40);
    setVals(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => send("answers", next), 400);
  };
  const finish = () => {
    if (timer.current) clearTimeout(timer.current);
    send("answers", vals);
    send("done");
    mine("ding", [40]);
  };
  const focusNext = (i: number) => {
    const inputs = document.querySelectorAll<HTMLInputElement>("[data-notebook] input");
    if (i + 1 < inputs.length) inputs[i + 1].focus();
    else inputs[i]?.blur();
  };

  return (
    <div className="space-y-4">
      {view.deadline !== null && (
        <div className="h-7">{shuffling ? <p className="text-p-body font-semibold text-muted">Agla akshar aa raha hai…</p> : <TimeStrip deadline={view.deadline} seconds={view.seconds} now={now} label="Samay" />}</div>
      )}

      <NotebookPage>
        <div data-notebook className="relative">
          {/* Page header: the letter, stamped */}
          <div className="flex items-center gap-3 border-b-[1.5px] pb-3 pl-[3.6rem] pr-3 pt-4" style={{ borderColor: RULE }}>
            <div className="min-w-0 flex-1">
              <div className="text-p-note font-bold uppercase tracking-[0.16em]" style={{ color: MARGIN }}>
                {shuffling ? "Agla akshar…" : "Aaj ka akshar"}
              </div>
              <h2 className="mt-0.5 text-p-title font-extrabold leading-tight" style={{ color: BLUE_INK }}>
                {shuffling ? "Ruko, ruko…" : `“${view.letter}” se!`}
              </h2>
              {!shuffling && playing && !done && <p className="mt-1 text-p-note font-semibold text-muted">Sab isi se shuru. Jaldi likho!</p>}
            </div>
            <LetterStamp letter={view.letter} shuffling={shuffling} now={now} size={80} />
          </div>

          {playing ? (
            <div className={`pb-2 transition-opacity duration-300 ${shuffling ? "opacity-40" : ""}`}>
              {CATEGORIES.map((c, i) => (
                <AnswerRow key={c.id} i={i} value={vals[i] ?? ""} letter={view.letter} disabled={done || shuffling} hideLetter={shuffling} onChange={(v) => update(i, v)} onEnter={() => focusNext(i)} />
              ))}
            </div>
          ) : (
            <p className="px-4 pb-6 pl-[3.6rem] text-p-lead" style={{ color: BLUE_INK }}>
              Is round mein aap dekh rahe ho. Agle game mein aap bhi likhoge!
            </p>
          )}

          {/* Submitted: stamp the page */}
          <AnimatePresence>
            {done && (
              <motion.div
                key="jama"
                className="pointer-events-none absolute right-3 top-[45%]"
                initial={{ scale: 1.8, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: -10 }}
                transition={spring.settle}
              >
                <Stamp tone="leaf">Jama!</Stamp>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </NotebookPage>

      {playing && !done && (
        <div>
          <PaperButton size="lg" className="w-full" disabled={shuffling} onClick={finish}>
            <Check className="h-5 w-5" strokeWidth={3} /> Ho gaya!
          </PaperButton>
          <p className="mt-1.5 text-center text-p-note font-semibold text-muted">
            {filled}/{N} sahi akshar se · Khaali bhi chalega
          </p>
        </div>
      )}
      {playing && done && <p className="text-center text-p-body font-semibold text-muted">Shabash! Baaki log likh rahe hain…</p>}

      <Roster view={view} players={players} me={me} />

      {isHost && (
        <section aria-label="Host controls" className="mt-2 border-t-[1.5px] border-dashed border-ink/40 pt-3">
          <h3 className="mb-2 text-p-note font-semibold uppercase tracking-[0.14em] text-muted">Host ke controls</h3>
          <ConfirmButton label="Bas! Round roko" confirmLabel="Phir se tap karo — round band" icon={<Gavel className="h-4 w-4" strokeWidth={2.4} />} now={now} onConfirm={() => hostAct("stop")} />
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Review: the marked notebook                                          */
/* ------------------------------------------------------------------ */

/** Teacher's red-pen mark: a circled number. */
function Mark({ pts, muted }: { pts: number; muted?: boolean }) {
  return (
    <span
      aria-hidden
      className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-p-body font-extrabold tabular-nums"
      style={{ color: muted ? "rgba(30,26,23,0.35)" : RED_PEN, border: `2px solid ${muted ? "rgba(30,26,23,0.2)" : RED_PEN}`, transform: "rotate(-8deg)" }}
    >
      {pts}
    </span>
  );
}

function ReviewRow({
  p,
  answer,
  letter,
  pts,
  struck,
  isMe,
  canStrike,
  onStrike,
  delay,
}: {
  p: Player;
  answer: string;
  letter: string;
  pts: number;
  struck: boolean;
  isMe: boolean;
  canStrike: boolean;
  onStrike: () => void;
  delay: number;
}) {
  const blank = !answer.trim();
  const wrongLetter = !blank && !startsWithLetter(answer, letter);
  const note = struck ? "kaat diya" : wrongLetter ? "galat akshar" : pts === 10 ? "anokha" : pts === 5 ? "kisi aur ne bhi" : "";
  const label = `${p.name}: ${blank ? "blank" : answer}, ${pts} points${struck ? ", struck out" : ""}`;
  const body = (
    <>
      <Sticker id={p.avatar} size={30} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-p-note font-semibold text-muted">{isMe ? "You" : p.name}</span>
        <span className="relative inline-block max-w-full">
          <span className={`font-display block truncate text-p-lead font-bold ${blank ? "text-ink/30" : ""}`} style={{ color: blank ? undefined : BLUE_INK }}>
            {blank ? "—" : answer}
          </span>
          {/* Red-pen strike, drawn left to right */}
          <motion.span
            aria-hidden
            className="absolute left-[-2px] right-[-2px] top-1/2 h-[3px] origin-left rounded-full"
            style={{ background: RED_PEN, rotate: "-3deg" }}
            initial={false}
            animate={{ scaleX: struck ? 1 : 0 }}
            transition={{ duration: struck ? 0.28 : 0.16, ease: struck ? ease.out : ease.in }}
          />
        </span>
      </span>
      {note && <span className={`shrink-0 text-p-note font-semibold ${struck || wrongLetter ? "text-vermilion" : "text-muted"}`}>{note}</span>}
      <Mark pts={pts} muted={pts === 0} />
    </>
  );
  return (
    <motion.li initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: dur.screen, ease: ease.out, delay }}>
      {canStrike && !blank ? (
        <button
          style={{ borderBottom: `1px solid ${RULE}` }}
          onClick={onStrike}
          aria-pressed={struck}
          aria-label={`${label}. Tap to ${struck ? "put back" : "strike out"}`}
          className="press flex min-h-12 w-full items-center gap-2.5 rounded-cut px-2 py-1"
        >
          {body}
        </button>
      ) : (
        <div aria-label={label} className="flex min-h-12 w-full items-center gap-2.5 px-2 py-1" style={{ borderBottom: `1px solid ${RULE}` }}>
          {body}
        </div>
      )}
    </motion.li>
  );
}

function Review({ view, players, me, now, isHost, hostAct, onScores }: { view: Pub; players: Player[]; me: Player; now: number; isHost: boolean; hostAct: (t: string, p?: unknown) => void; onScores: () => void }) {
  const people = view.participants.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => !!p);
  const roundTotal = (id: string) => (view.points[id] ?? []).reduce((a, b) => a + b, 0);
  const mineRound = roundTotal(me.id);
  const iPlayed = view.participants.includes(me.id);
  const last = view.round >= view.rounds;
  const totals = people.map((p) => ({ p, round: roundTotal(p.id), total: (view.scores[p.id] ?? 0) + roundTotal(p.id) })).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <LetterStamp letter={view.letter} shuffling={false} now={now} size={68} />
        <div className="min-w-0 flex-1">
          <div className="text-p-note font-bold uppercase tracking-[0.16em]" style={{ color: MARGIN }}>
            Copy check ho rahi hai
          </div>
          {iPlayed ? (
            <h2 className="text-p-title font-extrabold leading-tight">
              Aapko +<CountUp from={0} to={mineRound} delay={0.3} />
            </h2>
          ) : (
            <h2 className="text-p-title font-extrabold leading-tight">“{view.letter}” ke jawab</h2>
          )}
        </div>
        <button onClick={onScores} aria-label="Show all scores" className="press flex h-11 items-center gap-1.5 rounded-cut border-[1.5px] border-ink/25 px-2.5 text-p-body font-bold">
          <Trophy className="h-4 w-4 text-turmeric-ink" strokeWidth={2.4} />
        </button>
      </div>
      <p className="text-p-note font-semibold text-muted">10 = anokha jawab · 5 = kisi aur ne bhi likha · 0 = galat akshar ya kaata gaya</p>
      {isHost && (
        <p className="flex items-center gap-2 rounded-cut border-[1.5px] border-dashed px-3 py-2 text-p-body font-semibold" style={{ borderColor: RED_PEN, color: RED_PEN }}>
          <PenLine className="h-4 w-4 shrink-0" /> Jo jawab nahi chalega, us par tap karo — laal pen se kat jayega.
        </p>
      )}

      <NotebookPage>
        <div className="py-2 pl-[2.9rem] pr-2">
          {CATEGORIES.map((c, ci) => (
            <section key={c.id} aria-label={c.label} className={ci ? "mt-2 border-t-[1.5px] border-dashed border-ink/15 pt-2" : ""}>
              <h3 className="px-2 text-p-note font-bold uppercase tracking-[0.12em]" style={{ color: BLUE_INK }}>
                {c.desi}
                {c.desi !== c.label && <span className="font-semibold normal-case tracking-normal text-muted"> · {c.label}</span>}
              </h3>
              <ul>
                {people
                  .filter((p) => (view.answers[p.id]?.[ci] ?? "").trim())
                  .map((p, pi) => (
                  <ReviewRow
                    key={p.id}
                    p={p}
                    answer={view.answers[p.id]?.[ci] ?? ""}
                    letter={view.letter}
                    pts={view.points[p.id]?.[ci] ?? 0}
                    struck={view.struck.includes(`${p.id}:${ci}`)}
                    isMe={p.id === me.id}
                    canStrike={isHost}
                    onStrike={() => hostAct("strike", { playerId: p.id, cat: ci })}
                    delay={staggerDelay(ci * people.length + pi)}
                  />
                ))}
              </ul>
              {(() => {
                const blanks = people.filter((p) => !(view.answers[p.id]?.[ci] ?? "").trim());
                if (!blanks.length) return null;
                if (blanks.length === people.length) return <p className="px-2 pb-1 pt-1 text-p-note font-semibold text-muted">Kisi ne nahi likha.</p>;
                return <p className="px-2 pb-1 pt-1 text-p-note text-muted">Khaali: {blanks.map((p) => (p.id === me.id ? "You" : p.name)).join(", ")}</p>;
              })()}
            </section>
          ))}
        </div>
      </NotebookPage>

      <section aria-label="Totals">
        <h3 className="mb-1 text-p-note font-semibold uppercase tracking-[0.14em] text-muted">Is akshar ke baad</h3>
        <ol className="divide-y-[1.5px] divide-ink/10 border-y-[1.5px] border-ink">
          {totals.map(({ p, round, total }, i) => (
            <motion.li key={p.id} layout transition={spring.settle} className="flex items-center gap-3 px-1 py-2">
              <span className="w-5 text-p-body font-semibold tabular-nums text-muted">{i + 1}</span>
              <Sticker id={p.avatar} size={32} />
              <span className="min-w-0 flex-1 truncate text-p-lead font-semibold">
                {p.name}
                {p.id === me.id && <span className="ml-1.5 text-p-note font-semibold text-muted">you</span>}
              </span>
              <span className="text-p-note font-bold tabular-nums text-leaf">+{round}</span>
              <CountUp from={view.scores[p.id] ?? 0} to={total} delay={0.5} className="font-display w-12 text-right text-p-title font-extrabold" />
            </motion.li>
          ))}
        </ol>
      </section>

      {isHost ? (
        <section aria-label="Host controls" className="border-t-[1.5px] border-dashed border-ink/40 pt-3">
          <h3 className="mb-2 text-p-note font-semibold uppercase tracking-[0.14em] text-muted">Host ke controls</h3>
          <PaperButton size="lg" className="w-full" onClick={() => hostAct("next")}>
            <SkipForward className="h-5 w-5" strokeWidth={2.4} /> {last ? "Result dikhao" : "Agla akshar"}
          </PaperButton>
        </section>
      ) : (
        <p className="text-center text-p-body font-semibold text-muted">Host copy check kar rahe hain… {last ? "phir result!" : "phir agla akshar."}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Final: podium                                                        */
/* ------------------------------------------------------------------ */

export function Crown() {
  return (
    <svg aria-hidden width="38" height="24" viewBox="0 0 38 24">
      <path d="M3 21 L1 6 L11 13 L19 2 L27 13 L37 6 L35 21 Z" fill="#f2b632" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="19" cy="15" r="2" fill="var(--vermilion)" stroke="var(--ink)" strokeWidth="1" />
    </svg>
  );
}

function Podium({ rows, meId }: { rows: { p: Player; s: number }[]; meId: string }) {
  const top = rows.slice(0, 3);
  const slots = [
    { r: top[1], place: 2, h: 92, delay: 0.75, bg: PAGE },
    { r: top[0], place: 1, h: 128, delay: 1.3, bg: COVER },
    { r: top[2], place: 3, h: 64, delay: 0.2, bg: PAGE },
  ];
  return (
    <div className="flex items-end justify-center gap-2.5 border-b-[1.5px] border-ink px-1" style={{ height: 250 }}>
      {slots.map(({ r, place, h, delay, bg }) =>
        r ? (
          <div key={r.p.id} className="flex w-[30%] max-w-28 flex-col items-center overflow-hidden" style={{ height: "100%", justifyContent: "flex-end" }}>
            <motion.div
              className="flex w-full flex-col items-center"
              initial={{ y: h + 110, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ y: { ...spring.settle, delay }, opacity: { duration: 0.15, delay } }}
            >
              {place === 1 && <Crown />}
              <Sticker id={r.p.avatar} size={place === 1 ? 56 : 46} tilt={place === 1 ? -5 : place === 2 ? 4 : -3} />
              <div className={`mt-1 w-full truncate text-center text-p-body font-bold ${r.p.id === meId ? "text-me-ink" : ""}`}>{r.p.id === meId ? "You" : r.p.name}</div>
              <div
                className="mt-1.5 flex w-full flex-col items-center rounded-t-cut border-[1.5px] border-b-0 border-ink pt-1.5"
                style={{
                  height: h,
                  background: `repeating-linear-gradient(to bottom, ${bg} 0 14px, ${RULE} 14px 15px), ${bg}`,
                  boxShadow: "2px 0 0 0 var(--ink)",
                }}
              >
                <CountUp from={0} to={r.s} delay={delay + 0.2} className="font-display text-p-title font-extrabold" />
                <span className="text-p-note font-bold uppercase tracking-[0.14em] text-ink/60">{place === 1 ? "1st" : place === 2 ? "2nd" : "3rd"}</span>
              </div>
            </motion.div>
          </div>
        ) : (
          <div key={place} className="w-[30%] max-w-28" />
        ),
      )}
    </div>
  );
}

function ScoreList({ rows, meId, from = 0 }: { rows: { p: Player; s: number }[]; meId: string; from?: number }) {
  return (
    <ol className="divide-y-[1.5px] divide-ink/10 border-y-[1.5px] border-ink">
      {rows.map(({ p, s }, i) => (
        <li key={p.id} className="flex items-center gap-3 px-1 py-2.5">
          <span className="w-5 text-p-body font-semibold tabular-nums text-muted">{from + i + 1}</span>
          <Sticker id={p.avatar} size={36} />
          <span className="min-w-0 flex-1 truncate text-p-lead font-semibold">
            {p.name}
            {p.id === meId && <span className="ml-1.5 text-p-note font-semibold text-muted">you</span>}
          </span>
          <span className="font-display text-p-title font-extrabold tabular-nums">{s}</span>
        </li>
      ))}
    </ol>
  );
}

function Results({ view, players, me, isHost }: { view: Pub; players: Player[]; me: Player; isHost: boolean }) {
  const rows = useMemo(() => ranked(players, view.scores), [players, view.scores]);
  const winner = rows[0];
  const myPlace = rows.findIndex((r) => r.p.id === me.id) + 1;
  const iWon = myPlace === 1 && (winner?.s ?? 0) > 0;
  const tie = rows.length > 1 && rows[0].s === rows[1].s;
  const [announced, setAnnounced] = useState(false);
  const winnerColor = winner ? playerColor(winner.p.avatar) : COVER;
  useEffect(() => {
    const t = setTimeout(() => {
      setAnnounced(true);
      celebrate([winnerColor, "#fffdf8", BLUE_INK]);
    }, 1750);
    return () => clearTimeout(t);
  }, [winnerColor]);
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-p-note font-bold uppercase tracking-[0.2em]" style={{ color: BLUE_INK }}>
          Copy band · {view.rounds} akshar ho gaye
        </div>
        <div className="relative mt-1 min-h-[5.75rem]">
          <AnimatePresence mode="wait" initial={false}>
            {announced ? (
              <motion.div key="winner" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.screen, ease: ease.out }}>
                <h2 className="text-p-show font-extrabold text-balance">
                  {tie ? "Barabar ki takkar!" : iWon ? "Aap jeet gaye!" : winner ? `Jeet: ${winner.p.name}!` : "Khel khatam!"}
                </h2>
                <p className="mt-1 text-p-lead text-muted">
                  {myPlace > 0 ? (iWon && !tie ? `Shabash! ${view.scores[me.id] ?? 0} points.` : `Aap #${myPlace} — ${view.scores[me.id] ?? 0} points.`) : "Thanks for watching."}
                </p>
              </motion.div>
            ) : (
              <motion.h2 key="wait" className="text-p-show font-extrabold" exit={{ opacity: 0, y: -8, transition: { duration: dur.screenExit, ease: ease.in } }}>
                Topper kaun…?
              </motion.h2>
            )}
          </AnimatePresence>
        </div>
      </div>
      <Podium rows={rows} meId={me.id} />
      {rows.length > 3 && (
        <section aria-label="Everyone else">
          <ScoreList rows={rows.slice(3)} meId={me.id} from={3} />
        </section>
      )}
      <p className="text-center text-p-body text-muted">{isHost ? "Agla game? Tap the home button at the top." : "Host agla game chun rahe hain…"}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phone                                                                */
/* ------------------------------------------------------------------ */

export function Phone({ view, priv, me, players, send, now, isHost, hostAct }: PhoneProps<Pub, Priv>) {
  const { shared, mine } = useSfx();
  const [showScores, setShowScores] = useState(false);
  const shuffling = view.phase === "answering" && now < view.revealAt;
  const secsLeft = view.phase === "answering" && view.deadline && !shuffling ? Math.ceil(Math.max(0, view.deadline - now) / 1000) : -1;

  useOnChange(shuffling, (s) => {
    if (!s) shared("whoosh");
  });
  useOnChange(secsLeft, (n) => {
    if (n > 0 && n <= 5) shared("tick");
  });
  useOnChange(view.struck.length, (n, p) => {
    if (view.phase === "review" && n !== p) shared("pop");
  });
  useOnChange(view.phase, (n) => {
    if (n === "review") shared("reveal");
    if (n === "final") {
      const top = ranked(players, view.scores)[0];
      if (top?.p.id === me.id) mine("fanfare", [60, 40, 120]);
      else shared("fanfare");
    }
  });

  const myScore = view.scores[me.id] ?? 0;
  const announce =
    view.phase === "final"
      ? "All letters done. Final scores are shown."
      : view.phase === "review"
        ? `Time to check answers for letter ${view.letter}.`
        : shuffling
          ? ""
          : `New letter: ${view.letter}.`;

  return (
    <MotionConfig reducedMotion="user">
      <InkDefs />
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {view.phase === "final" ? (
          <motion.div key="final" {...screenIn}>
            <Results view={view} players={players} me={me} isHost={isHost} />
          </motion.div>
        ) : view.phase === "review" ? (
          <motion.div key={`review-${view.round}`} {...screenIn}>
            <Review view={view} players={players} me={me} now={now} isHost={isHost} hostAct={hostAct} onScores={() => setShowScores(true)} />
          </motion.div>
        ) : (
          <motion.div key={`write-${view.round}`} {...screenIn} className="space-y-3">
            <TopBar round={view.round} rounds={view.rounds} score={myScore} onScores={() => setShowScores(true)} />
            <Writing view={view} priv={priv} me={me} players={players} send={send} now={now} isHost={isHost} hostAct={hostAct} />
          </motion.div>
        )}
      </AnimatePresence>

      <PaperSheet open={showScores} onClose={() => setShowScores(false)} title="Ab tak ke points">
        <ScoreList rows={ranked(players, view.scores)} meId={me.id} />
        {view.phase === "review" && <p className="mt-3 text-p-note text-muted">Is akshar ke points “Agla akshar” ke baad judenge.</p>}
      </PaperSheet>
    </MotionConfig>
  );
}
