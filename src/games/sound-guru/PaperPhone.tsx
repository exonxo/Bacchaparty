"use client";
import confetti from "canvas-confetti";
import { Ear, Eye, Hand, Lightbulb, Play, RefreshCw, Send, SkipForward, Trophy, UserRoundX, WifiOff } from "lucide-react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { dur, ease, screenIn, spring } from "@/components/paper/motion";
import { InkDefs, Stamp } from "@/components/paper/objects";
import { CountUp, PaperButton, PaperSheet, Sticker } from "@/components/paper/Paper";
import { celebrate } from "@/lib/celebrate";
import { playerColor } from "@/lib/colors";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import type { PhoneProps, Player } from "@/lib/types";
import { AWAY_MS, pointsFor, type Priv, type Pub } from "./index";

const INK = "#1e1a17";
/** The game's paper (coral) and a deeper shade that reads as text. */
export const CORAL = "#f27b5b";
const CORAL_DEEP = "#a8401f";
const HINT_KEY = "bacchaparty-sound-peeked";

function ranked(players: Player[], scores: Record<string, number>) {
  return players
    .filter((p) => p.id in scores)
    .map((p) => ({ p, s: scores[p.id] ?? 0 }))
    .sort((a, b) => b.s - a.s);
}

function smallConfetti(color: string) {
  try {
    confetti({ particleCount: 28, spread: 55, startVelocity: 26, gravity: 1.1, scalar: 0.8, ticks: 90, origin: { x: 0.5, y: 0.62 }, colors: [color, CORAL, "#f2b632"], disableForReducedMotion: true });
  } catch {}
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                         */
/* ------------------------------------------------------------------ */

/** A folded paper megaphone. Sound arcs ripple out while a sound is being made. */
export function Megaphone({ size = 150, loud = false, onCoral = false }: { size?: number; loud?: boolean; onCoral?: boolean }) {
  const reduce = useReducedMotion();
  // On the coral card the cone is cream paper, so it doesn't vanish into the background.
  const face = onCoral ? "#fffdf8" : CORAL;
  const fold = onCoral ? "#f3e6d4" : "#f59a80";
  return (
    <svg viewBox="0 0 200 120" width={size} height={(size * 120) / 200} aria-hidden>
      {/* Cone, folded from paper: two faces, a crease and a rolled rim */}
      <path d="M34 50 L34 72 L58 72 L128 104 L128 18 L58 50 Z" fill={face} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M58 50 L128 18 L128 61 Z" fill={fold} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M58 50 L58 72" stroke={INK} strokeWidth="1.5" opacity=".5" />
      <ellipse cx="128" cy="61" rx="6" ry="43" fill={fold} stroke={INK} strokeWidth="2" />
      <rect x="22" y="52" width="14" height="18" rx="3" fill={onCoral ? CORAL : "#fffdf8"} stroke={INK} strokeWidth="2" />
      {[0, 1, 2].map((i) => (
        <motion.path
          key={i}
          d={`M${142 + i * 14} ${40 - i * 8} Q${158 + i * 16} 61 ${142 + i * 14} ${82 + i * 8}`}
          fill="none"
          stroke={INK}
          strokeWidth="3"
          strokeLinecap="round"
          initial={false}
          animate={loud && !reduce ? { opacity: [0.15, 1, 0.15], x: [0, 4, 0] } : { opacity: loud ? 1 : 0.25, x: 0 }}
          transition={loud && !reduce ? { duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" } : { duration: 0.2 }}
        />
      ))}
    </svg>
  );
}

/** My score; counts up when it changes. */
function ScoreTick({ score }: { score: number }) {
  const prev = useRef(score);
  const from = prev.current;
  useEffect(() => {
    prev.current = score;
  }, [score]);
  return <CountUp key={score} from={from} to={score} />;
}

function TopBar({ turn, total, score, onScores }: { turn: number; total: number; score: number; onScores: () => void }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <div>
        <div className="font-display text-p-title font-extrabold leading-none">
          Awaaz {Math.min(turn + 1, total)}
          <span className="text-p-lead font-bold text-muted"> / {total}</span>
        </div>
        <div className="mt-1.5 flex gap-1" aria-hidden>
          {Array.from({ length: Math.min(total, 16) }, (_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full border border-ink transition-colors duration-300"
              style={{ width: total > 10 ? 10 : 14, background: i < turn ? "var(--ink)" : i === turn ? CORAL : "transparent" }}
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

/** Paper strip that shortens; turns red in the last five seconds. */
function TimeStrip({ deadline, seconds, now }: { deadline: number; seconds: number; now: number }) {
  const left = Math.max(0, deadline - now);
  const secs = Math.ceil(left / 1000);
  const pct = Math.max(0, Math.min(100, (left / (seconds * 1000)) * 100));
  const low = secs <= 5;
  return (
    <div role="timer" aria-label={`${secs} seconds left`} className="flex items-center gap-3">
      <div className="h-3 flex-1 overflow-hidden rounded-full border-[1.5px] border-ink bg-paper">
        <div className="h-full" style={{ width: `${pct}%`, background: low ? "var(--vermilion)" : CORAL, transition: "width 0.3s linear, background-color 0.3s" }} />
      </div>
      <span className={`font-display w-12 text-right text-p-title font-extrabold tabular-nums ${low ? "text-vermilion" : ""}`}>{secs}s</span>
    </div>
  );
}

/** Two-tap confirm for host actions that skip a turn (no browser dialogs). */
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

/* ------------------------------------------------------------------ */
/* The Sound Maker's secret card (press and hold)                      */
/* ------------------------------------------------------------------ */

function SecretCard({ sound, tip, onPeek }: { sound: string; tip: string; onPeek: () => void }) {
  const [held, setHeld] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const open = held || pinned;

  useEffect(() => {
    try {
      setShowHint(!localStorage.getItem(HINT_KEY));
    } catch {
      setShowHint(true);
    }
  }, []);
  useOnChange(open, (o) => {
    if (!o) return;
    onPeek();
    if (showHint) {
      setShowHint(false);
      try {
        localStorage.setItem(HINT_KEY, "1");
      } catch {}
    }
  });
  useEffect(() => {
    if (!pinned) return;
    const t = setTimeout(() => setPinned(false), 5000);
    return () => clearTimeout(t);
  }, [pinned]);

  return (
    <div>
      <button
        type="button"
        aria-label="Your secret sound. Press and hold to see it."
        className="no-callout relative block w-full rounded-cut text-left"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setHeld(true);
        }}
        onPointerUp={() => setHeld(false)}
        onPointerCancel={() => setHeld(false)}
        onLostPointerCapture={() => setHeld(false)}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) setHeld(true);
        }}
        onKeyUp={() => setHeld(false)}
        onBlur={() => setHeld(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="relative min-h-[12.5rem]" style={{ perspective: 900 }}>
          {/* Face down */}
          <motion.div
            className="cut absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-cut"
            style={{ background: CORAL, backfaceVisibility: "hidden" }}
            animate={{ rotateX: open ? -90 : 0, opacity: open ? 0 : 1 }}
            transition={{ duration: open ? 0.2 : 0.26, ease: open ? ease.in : ease.out }}
          >
            <div className="absolute inset-3 rounded-[3px] border-[1.5px] border-dashed border-ink/35" aria-hidden />
            <Megaphone size={140} onCoral />
            <span className="flex items-center gap-1.5 font-display text-p-lead font-extrabold text-ink">
              <Hand className="h-5 w-5" strokeWidth={2.4} /> Dabaake dekho
            </span>
          </motion.div>
          {/* Face up */}
          <motion.div
            className="cut absolute inset-0 flex flex-col items-center justify-center rounded-cut bg-paper px-4 py-5 text-center"
            initial={false}
            animate={{ rotateX: open ? 0 : 90, opacity: open ? 1 : 0 }}
            transition={{ duration: open ? 0.28 : 0.18, ease: open ? ease.out : ease.in }}
            aria-hidden={!open}
          >
            <div className="text-p-note font-semibold uppercase tracking-[0.16em] text-muted">Yeh awaaz nikalo</div>
            <div className="mt-1 font-display text-p-title font-extrabold leading-tight text-balance">{sound}</div>
            <div className="mt-3 flex items-start gap-2 rounded-cut bg-[#fff3a8] px-3 py-2 text-left text-p-body text-[#1e1a17]">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.4} />
              <span>{tip}</span>
            </div>
            <div className="mt-2 text-p-note font-bold text-vermilion">No words that give it away!</div>
          </motion.div>
        </div>
      </button>
      <div className="mt-2 flex min-h-11 items-center justify-between gap-3">
        {showHint ? (
          <div className="leading-tight">
            <div className="font-display text-p-body font-bold text-vermilion">Pehle screen chhupao!</div>
            <div className="text-p-note font-medium text-ink/80">Then press &amp; hold the card.</div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-p-body font-semibold">
            <Hand className="h-4 w-4" strokeWidth={2.4} /> Chhodo toh band
          </div>
        )}
        <button
          type="button"
          aria-pressed={pinned}
          aria-label={pinned ? "Close the card" : "Can't hold? Tap to open the card for 5 seconds"}
          onClick={() => setPinned((p) => !p)}
          className="-mr-2 flex min-h-11 items-center rounded-cut px-2 text-p-note font-semibold text-muted underline decoration-ink/30 underline-offset-4"
        >
          {pinned ? "Close it" : "Tap to open"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Guessing                                                             */
/* ------------------------------------------------------------------ */

function GuessStrip({ tries, lastWrong, got, points, onSubmit }: { tries: number; lastWrong: string | null; got: boolean; points: number; onSubmit: (t: string) => void }) {
  const [value, setValue] = useState("");
  const [last, setLast] = useState("");
  const inputId = useId();
  const msgId = useId();
  const wrong = tries > 0 && !got;

  if (got) {
    return (
      <motion.div className="cut paper-rule relative mt-7 flex min-h-16 items-center rounded-cut bg-paper pl-4 pr-3" initial={{ scale: 0.98 }} animate={{ scale: 1 }} transition={spring.select}>
        <span className="min-w-0 flex-1 truncate font-display text-p-title font-extrabold">{last || "Sahi!"}</span>
        <motion.span className="absolute -top-9 right-14 z-10" initial={{ opacity: 0, scale: 2, rotate: -2 }} animate={{ opacity: 1, scale: 1, rotate: -6 }} transition={{ ...spring.settle, delay: 0.08 }}>
          <span className="inline-block bg-bg px-1 py-0.5">
            <Stamp tone="leaf" className="!text-p-body">
              Sahi jawab!
            </Stamp>
          </span>
        </motion.span>
        <motion.span
          className="font-display ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink bg-leaf text-p-lead font-extrabold text-paper"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...spring.settle, delay: 0.3 }}
        >
          +{points}
        </motion.span>
      </motion.div>
    );
  }

  return (
    <div>
      <form
        key={tries}
        className={`flex items-stretch gap-2.5 ${wrong ? "shake" : ""}`}
        onSubmit={(e) => {
          e.preventDefault();
          const v = value.trim();
          if (!v) return;
          setLast(v);
          onSubmit(v);
          setValue("");
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Your guess. Which sound is it?
        </label>
        <div className={`cut paper-rule flex min-h-16 min-w-0 flex-1 items-center rounded-cut bg-paper ${wrong ? "!border-vermilion" : ""}`}>
          <input
            id={inputId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            maxLength={40}
            placeholder="Kaunsi awaaz hai?"
            aria-describedby={wrong ? msgId : undefined}
            className="font-display h-full w-full bg-transparent px-4 text-p-title font-extrabold outline-none placeholder:font-semibold placeholder:text-ink/35"
          />
        </div>
        <PaperButton type="submit" tone="me" aria-label="Send guess" className="!min-h-16 w-16 shrink-0 !px-0">
          <Send className="h-6 w-6" strokeWidth={2.4} />
        </PaperButton>
      </form>
      <p id={msgId} role="status" className={`mt-2 min-h-6 text-p-body font-semibold ${wrong ? "text-vermilion" : "text-muted"}`}>
        {wrong ? (
          <>
            Nahi yaar, try again{lastWrong ? <span className="font-normal text-muted"> — “{lastWrong}” nahi hai</span> : null}
          </>
        ) : (
          "Spelling thodi galat ho toh bhi chalega."
        )}
      </p>
    </div>
  );
}

/** Who has guessed it. Guesses themselves are never shown — only who got it. */
function Solvers({ view, players, me, reveal }: { view: Pub; players: Player[]; me: Player; reveal: boolean }) {
  const inGame = players.filter((p) => p.id in view.scores && p.id !== view.makerId && (p.connected || view.correct.includes(p.id)));
  const solved = view.correct.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => !!p);
  const thinking = inGame.filter((p) => !view.correct.includes(p.id));
  return (
    <section aria-label="Who has guessed it">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-p-note font-semibold uppercase tracking-[0.14em] text-muted">{reveal ? "Kisne pehchana" : "Kisne bujha"}</h3>
        <span className="text-p-note font-bold tabular-nums">
          {solved.length}/{inGame.length} bujh gaye
        </span>
      </div>
      <ul className="flex min-h-[4.5rem] flex-wrap gap-x-3 gap-y-2">
        {solved.map((p, i) => (
          <motion.li key={p.id} className="flex w-14 flex-col items-center" initial={{ opacity: 0, y: -16, scale: 0.5, rotate: -14 }} animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }} transition={spring.settle}>
            <span className="relative">
              <Sticker id={p.avatar} size={44} tilt={i % 2 ? 4 : -4} />
              <span className="absolute -right-2 -top-1.5 rounded-cut border-[1.5px] border-ink bg-leaf px-1 text-[0.6875rem] font-bold leading-4 text-paper">+{pointsFor(i)}</span>
            </span>
            <span className={`mt-1 w-full truncate text-center text-p-note font-bold ${p.id === me.id ? "text-me-ink" : ""}`}>{p.id === me.id ? "You" : p.name}</span>
          </motion.li>
        ))}
        {thinking.map((p) => (
          <li key={p.id} className="flex w-14 flex-col items-center opacity-45">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-dashed border-ink">
              <span className={reveal ? "" : "breathe"}>
                <Sticker id={p.avatar} size={30} className="grayscale" />
              </span>
            </span>
            <span className="mt-1 w-full truncate text-center text-p-note font-semibold">{p.id === me.id ? "You" : p.name}</span>
          </li>
        ))}
        {inGame.length === 0 && <li className="text-p-body text-muted">Koi guess karne wala nahi — invite more people!</li>}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Stages                                                               */
/* ------------------------------------------------------------------ */

function MakerStage({ view, priv, now, send, onPeek }: { view: Pub; priv: Priv | undefined; now: number; send: (t: string) => void; onPeek: () => void }) {
  const [starting, setStarting] = useState(false);
  const making = view.phase === "making";
  const card = priv?.role === "maker" ? priv : null;
  return (
    <div className="space-y-4">
      <div className="leading-tight">
        <div className="text-p-note font-bold uppercase tracking-[0.18em]" style={{ color: CORAL_DEEP }}>
          {making ? "Awaaz nikalo!" : "Aapki baari!"}
        </div>
        <h2 className="mt-0.5 font-display text-p-title font-extrabold">{making ? "Sab sun rahe hain…" : "You’re the Sound Maker"}</h2>
        {!making && <p className="mt-1 text-p-body text-muted">Peek at your sound, then tap start. The timer begins for everyone.</p>}
      </div>
      {card ? (
        <SecretCard sound={card.sound} tip={card.tip} onPeek={onPeek} />
      ) : (
        <div className="flex min-h-[12.5rem] items-center justify-center rounded-cut border-[1.5px] border-dashed border-ink/30 text-p-body font-semibold text-muted">Card aa raha hai…</div>
      )}
      {making ? (
        <PaperButton tone="paper" size="lg" className="w-full" onClick={() => send("reveal")}>
          <Eye className="h-5 w-5" strokeWidth={2.4} /> Jawab dikhao
        </PaperButton>
      ) : (
        <PaperButton
          size="lg"
          className="w-full"
          disabled={starting || !card}
          onClick={() => {
            setStarting(true);
            send("start");
          }}
        >
          <Play className="h-5 w-5" fill="currentColor" /> Shuru karo — timer chalu
        </PaperButton>
      )}
      {making ? (
        view.deadline && <p className="text-center text-p-note text-muted">{Math.max(0, Math.ceil((view.deadline - now) / 1000))}s left · each right guess gives you +1</p>
      ) : (
        <ul className="space-y-1.5 border-t-[1.5px] border-dashed border-ink/25 pt-3 text-p-body text-ink/80">
          <li>· Munh se, haath se, cheezein bajaake — sab chalega.</li>
          <li>· Har sahi guess = aapko +1 point.</li>
        </ul>
      )}
    </div>
  );
}

function ListenerStage({ view, maker, me, priv, send }: { view: Pub; maker: Player | null; me: Player; priv: Priv | undefined; send: (t: string, p?: unknown) => void }) {
  const making = view.phase === "making";
  const rank = view.correct.indexOf(me.id);
  const got = rank >= 0;
  const g = priv?.role === "guesser" ? priv : null;
  return (
    <div className="space-y-4">
      <div className="cut relative overflow-hidden rounded-soft bg-paper px-4 pb-4 pt-4 text-center">
        <div className="absolute inset-x-0 top-0 h-2" style={{ background: CORAL }} aria-hidden />
        <div className="mt-1 flex items-center justify-center gap-1">
          {maker && (
            <motion.span animate={making ? { rotate: [0, -4, 4, 0] } : { rotate: 0 }} transition={{ duration: 1.4, repeat: making ? Infinity : 0, ease: "easeInOut" }}>
              <Sticker id={maker.avatar} size={64} tilt={-4} />
            </motion.span>
          )}
          <Megaphone size={130} loud={making} />
        </div>
        <h2 className="mt-2 font-display text-p-title font-extrabold text-balance">
          {making ? `${maker?.name ?? "Sound Maker"} kya bol rahe hain?` : `${maker?.name ?? "Sound Maker"} taiyaar ho rahe hain…`}
        </h2>
        <p className="mt-1 text-p-lead text-ink/80 text-balance">
          <Ear className="-mt-1 mr-1 inline h-5 w-5" strokeWidth={2.4} aria-hidden />
          {making ? (got ? "Shh… baaki log abhi soch rahe hain." : "Suno aur type karo jo lagta hai!") : "Kaan khule rakho! Timer jaldi chalu hoga."}
        </p>
      </div>
      {making && <GuessStrip tries={g?.tries ?? 0} lastWrong={g?.lastWrong ?? null} got={got} points={pointsFor(rank)} onSubmit={(t) => send("guess", t)} />}
    </div>
  );
}

function RevealStage({ view, players, me, now }: { view: Pub; players: Player[]; me: Player; now: number }) {
  const maker = players.find((p) => p.id === view.makerId) ?? null;
  const rank = view.correct.indexOf(me.id);
  const isMaker = view.makerId === me.id;
  const nextIn = view.revealUntil ? Math.max(0, Math.ceil((view.revealUntil - now) / 1000)) : null;
  const last = view.turn + 1 >= view.totalTurns;
  const line = isMaker
    ? view.correct.length
      ? `Badhiya! ${view.correct.length} log ne pehchana · +${view.correct.length}`
      : "Kisi ne nahi pehchana — agli baar!"
    : rank >= 0
      ? `Shabash! +${pointsFor(rank)}`
      : "Is baar nahi. Agli awaaz aapki!";
  return (
    <div className="space-y-4">
      <motion.div className="cut rounded-soft px-4 py-5 text-center" style={{ background: CORAL }} initial={{ rotateX: -80, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ duration: 0.5, ease: ease.out }}>
        <div className="text-p-note font-bold uppercase tracking-[0.18em] text-ink/75">Awaaz thi</div>
        <div className="mt-1 font-display text-p-show font-extrabold leading-none text-balance">{view.answer}</div>
        {maker && <div className="mt-2 text-p-body font-semibold text-ink/80">by {maker.id === me.id ? "you" : maker.name}</div>}
      </motion.div>
      <p className={`text-center text-p-lead font-bold ${rank >= 0 || (isMaker && view.correct.length) ? "text-leaf" : "text-muted"}`}>{line}</p>
      {nextIn !== null && <p className="text-center text-p-body font-semibold text-muted tabular-nums">{last ? "Result" : "Agli awaaz"} · {nextIn}s</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Results                                                              */
/* ------------------------------------------------------------------ */

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

function Crown() {
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
    { r: top[1], place: 2, h: 92, delay: 0.75, bg: "var(--paper)" },
    { r: top[0], place: 1, h: 128, delay: 1.3, bg: CORAL },
    { r: top[2], place: 3, h: 64, delay: 0.2, bg: "var(--paper)" },
  ];
  return (
    <div className="flex items-end justify-center gap-2.5 border-b-[1.5px] border-ink px-1" style={{ height: 250 }}>
      {slots.map(({ r, place, h, delay, bg }) =>
        r ? (
          <div key={r.p.id} className="flex w-[30%] max-w-28 flex-col items-center overflow-hidden" style={{ height: "100%", justifyContent: "flex-end" }}>
            <motion.div className="flex w-full flex-col items-center" initial={{ y: h + 110, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ y: { ...spring.settle, delay }, opacity: { duration: 0.15, delay } }}>
              {place === 1 && <Crown />}
              <Sticker id={r.p.avatar} size={place === 1 ? 56 : 46} tilt={place === 1 ? -5 : place === 2 ? 4 : -3} />
              <div className={`mt-1 w-full truncate text-center text-p-body font-bold ${r.p.id === meId ? "text-me-ink" : ""}`}>{r.p.id === meId ? "You" : r.p.name}</div>
              <div className="paper-rule mt-1.5 flex w-full flex-col items-center rounded-t-cut border-[1.5px] border-b-0 border-ink pt-1.5" style={{ height: h, background: bg, boxShadow: "2px 0 0 0 var(--ink)" }}>
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

function Results({ view, players, me, isHost }: { view: Pub; players: Player[]; me: Player; isHost: boolean }) {
  const rows = useMemo(() => ranked(players, view.scores), [players, view.scores]);
  const winner = rows[0];
  const myPlace = rows.findIndex((r) => r.p.id === me.id) + 1;
  const iWon = myPlace === 1 && (winner?.s ?? 0) > 0;
  const [announced, setAnnounced] = useState(false);
  const winnerColor = winner ? playerColor(winner.p.avatar) : CORAL;
  useEffect(() => {
    const t = setTimeout(() => {
      setAnnounced(true);
      celebrate([winnerColor, "#fffdf8", "#1e1a17"]);
    }, 1750);
    return () => clearTimeout(t);
  }, [winnerColor]);
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-p-note font-bold uppercase tracking-[0.2em]" style={{ color: CORAL_DEEP }}>
          Saari awaazein khatam
        </div>
        <div className="relative mt-1 min-h-[5.75rem]">
          <AnimatePresence mode="wait" initial={false}>
            {announced ? (
              <motion.div key="winner" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.screen, ease: ease.out }}>
                <h2 className="text-p-show font-extrabold text-balance">{iWon ? "Aap Sound Guru ho!" : winner && winner.s > 0 ? `${winner.p.name} — Sound Guru!` : "Khel khatam!"}</h2>
                <p className="mt-1 text-p-lead text-muted">
                  {myPlace > 0 ? (iWon ? `Shabash! ${view.scores[me.id] ?? 0} points.` : `Aap #${myPlace} rahe — ${view.scores[me.id] ?? 0} points.`) : "Thanks for playing."}
                </p>
              </motion.div>
            ) : (
              <motion.h2 key="wait" className="text-p-show font-extrabold" exit={{ opacity: 0, y: -8, transition: { duration: dur.screenExit, ease: ease.in } }}>
                Sound Guru kaun…?
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
  const score = view.scores[me.id] ?? 0;
  const isMaker = view.makerId === me.id;
  const maker = players.find((p) => p.id === view.makerId) ?? null;
  const rank = view.correct.indexOf(me.id);
  const got = rank >= 0;
  const tries = priv?.role === "guesser" ? priv.tries : 0;
  const making = view.phase === "making";
  const secsLeft = making && view.deadline ? Math.ceil(Math.max(0, view.deadline - now) / 1000) : -1;
  const awayLeft = view.makerAwaySince && view.phase !== "reveal" ? Math.max(0, Math.ceil((view.makerAwaySince + AWAY_MS - now) / 1000)) : null;
  const skipNote = view.lastSkip && now - view.lastSkip.at < 6000 ? view.lastSkip : null;

  useOnChange(`${view.turn}-${view.makerId}`, () => {
    if (view.phase === "ready") {
      if (view.makerId === me.id) mine("turn", [60, 40, 60]);
      else shared("whoosh");
    }
  });
  useOnChange(secsLeft, (n) => {
    if (n > 0 && n <= 5) shared("tick");
  });
  useOnChange(got, (n) => {
    if (n) {
      mine("ding", [40]);
      smallConfetti(playerColor(me.avatar));
    }
  });
  useOnChange(tries, (n, p) => {
    if (n > p && !got) mine("buzz", [120]);
  });
  useOnChange(view.correct.length, (n, p) => {
    if (isMaker && n > p) mine("pop", 20);
  });
  useOnChange(view.phase, (n) => {
    if (n === "reveal") shared("reveal");
    if (n === "over") {
      const top = ranked(players, view.scores)[0];
      if (top?.p.id === me.id) mine("fanfare", [60, 40, 120]);
      else shared("fanfare");
    }
  });

  const announce =
    view.phase === "over"
      ? "Game over. Final scores are shown."
      : view.phase === "reveal"
        ? `The sound was ${view.answer}. ${got ? `You got it, plus ${pointsFor(rank)}.` : ""}`
        : got
          ? `Correct! Plus ${pointsFor(rank)} points.`
          : isMaker && view.phase === "ready"
            ? "You are the Sound Maker."
            : "";

  const stage =
    view.phase === "reveal" ? (
      <RevealStage view={view} players={players} me={me} now={now} />
    ) : isMaker ? (
      <MakerStage view={view} priv={priv} now={now} send={send} onPeek={() => mine("rustle", 12)} />
    ) : (
      <ListenerStage view={view} maker={maker} me={me} priv={priv} send={send} />
    );

  return (
    <MotionConfig reducedMotion="user">
      <InkDefs />
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {view.phase === "over" ? (
          <motion.div key="over" {...screenIn}>
            <Results view={view} players={players} me={me} isHost={isHost} />
          </motion.div>
        ) : (
          <motion.div key="play" {...screenIn} className="space-y-4 text-ink">
            <TopBar turn={view.turn} total={view.totalTurns} score={score} onScores={() => setShowScores(true)} />

            {/* Fixed-height slot so the stage doesn't jump when the timer starts. */}
            <div className="flex h-7 items-center">
              {making && view.deadline ? (
                <div className="w-full">
                  <TimeStrip deadline={view.deadline} seconds={view.seconds} now={now} />
                </div>
              ) : view.phase === "ready" ? (
                <p className="text-p-body font-semibold text-muted">{isMaker ? `Timer: ${view.seconds}s once you start` : `${view.seconds}s ka timer — jaise hi shuru ho`}</p>
              ) : null}
            </div>

            {skipNote && (
              <p role="status" className="rounded-cut border-[1.5px] border-ink/20 bg-paper px-3 py-2 text-p-body font-semibold text-ink/80">
                {skipNote.name} ka phone offline tha — agli awaaz!
              </p>
            )}

            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={`${view.turn}-${view.phase === "reveal" ? "r" : isMaker ? "m" : "l"}`} {...screenIn}>
                {stage}
              </motion.div>
            </AnimatePresence>

            {awayLeft !== null && maker && (
              <div role="status" className="flex items-center justify-center gap-2 rounded-cut border-[1.5px] border-vermilion/50 px-3 py-2 text-p-body font-semibold text-vermilion">
                <WifiOff className="h-4 w-4 shrink-0" /> {maker.name} ka phone offline hai — agli awaaz {awayLeft}s mein
              </div>
            )}

            {view.phase !== "ready" && <Solvers view={view} players={players} me={me} reveal={view.phase === "reveal"} />}

            {isHost && (
              <section aria-label="Host controls" className="border-t-[1.5px] border-dashed border-ink/40 pt-3">
                <h3 className="mb-2 text-p-note font-semibold uppercase tracking-[0.14em] text-muted">Host ke controls</h3>
                <div className="grid gap-3 min-[400px]:grid-cols-2">
                  {view.phase === "ready" && (
                    <PaperButton tone="paper" className="w-full" onClick={() => hostAct("skip")}>
                      <RefreshCw className="h-4 w-4" strokeWidth={2.4} /> Doosri awaaz
                    </PaperButton>
                  )}
                  {making && (
                    <PaperButton tone="paper" className="w-full" onClick={() => hostAct("reveal")}>
                      <Eye className="h-4 w-4" strokeWidth={2.4} /> Jawab dikhao
                    </PaperButton>
                  )}
                  {view.phase === "reveal" ? (
                    <PaperButton className="w-full min-[400px]:col-span-2" onClick={() => hostAct("next")}>
                      <SkipForward className="h-4 w-4" strokeWidth={2.4} /> {view.turn + 1 >= view.totalTurns ? "Result dikhao" : "Agli awaaz"}
                    </PaperButton>
                  ) : (
                    <ConfirmButton label="Skip player" confirmLabel="Pakka?" icon={<UserRoundX className="h-4 w-4" strokeWidth={2.4} />} now={now} onConfirm={() => hostAct("skipMaker")} />
                  )}
                </div>
              </section>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <PaperSheet open={showScores} onClose={() => setShowScores(false)} title="Ab tak ke points">
        <ScoreList rows={ranked(players, view.scores)} meId={me.id} />
      </PaperSheet>
    </MotionConfig>
  );
}
