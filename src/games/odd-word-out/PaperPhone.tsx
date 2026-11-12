"use client";
import { Check, Clock, Gavel, Hand, Mic, Repeat2, Send, SkipForward, Trophy, Vote, WifiOff } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { dur, ease, screenIn, spring, staggerDelay } from "@/components/paper/motion";
import { InkDefs, VerdictSlip } from "@/components/paper/objects";
import { CountUp, PaperButton, PaperSheet, Sticker } from "@/components/paper/Paper";
import { celebrate } from "@/lib/celebrate";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import { vibrate } from "@/lib/sfx";
import type { PhoneProps, Player } from "@/lib/types";
import { nameOf, revealLine, type Priv, type Pub } from "./index";

const HINT_KEY = "bacchaparty-oddword-peeked";
const INK = "#1e1a17";
/** The game's paper: a mint card sleeve. */
export const SLEEVE = "#9adbc0";
const SLEEVE_BACK = "#7cc4a6";

function fmt(secs: number) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                         */
/* ------------------------------------------------------------------ */

/** Countdown tag. Turns vermilion in the last 5 seconds. */
function TimerTag({ deadline, now, label }: { deadline: number; now: number; label: string }) {
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const urgent = left <= 5;
  return (
    <div
      role="timer"
      aria-label={`${label}: ${left} seconds left`}
      className={`cut flex h-11 items-center gap-2 rounded-cut pl-2.5 pr-3 transition-colors duration-200 ${urgent ? "bg-vermilion text-paper" : "bg-paper text-ink"}`}
      style={{ transform: "rotate(1.2deg)" }}
    >
      <Clock className="h-4 w-4" strokeWidth={2.4} />
      <span className="font-display text-p-lead font-bold tabular-nums">{fmt(left)}</span>
    </div>
  );
}

function RoundBar({ round, label, score, onScores, right }: { round: number; label: string; score: number; onScores: () => void; right?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="leading-none">
          <div className="text-p-note font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
          <div className="font-display text-p-title font-extrabold">Round {round}</div>
        </div>
        <button
          onClick={onScores}
          aria-label={`Your score: ${score}. Show all scores`}
          className="ml-1 flex h-11 items-center gap-1.5 rounded-cut border-[1.5px] border-ink/25 px-2.5 text-p-body font-bold"
        >
          <Trophy className="h-4 w-4 text-turmeric-ink" strokeWidth={2.4} /> {score}
        </button>
      </div>
      {right}
    </div>
  );
}

/** Two-tap confirm for host actions (no browser dialogs on phones). */
function ConfirmButton({ label, confirmLabel, onConfirm, icon, now, tone = "paper" }: { label: string; confirmLabel: string; onConfirm: () => void; icon: ReactNode; now: number; tone?: "paper" | "turmeric" }) {
  const [armedAt, setArmedAt] = useState<number | null>(null);
  const armed = armedAt !== null && now - armedAt < 3000;
  return (
    <PaperButton
      tone={armed ? "vermilion" : tone}
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

function HostSection({ children }: { children: ReactNode }) {
  return (
    <div className="border-t-[1.5px] border-dashed border-ink/25 pt-4">
      <div className="mb-2 text-p-note font-semibold uppercase tracking-[0.14em] text-muted">Host ke controls</div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function WaitingDots({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center justify-center gap-2 text-p-body text-muted">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-ink/50" animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }} />
        ))}
      </span>
      {children}
    </p>
  );
}

function ScoreList({ players, scores }: { players: Player[]; scores: Record<string, number> }) {
  const rows = players.filter((p) => p.id in scores).sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
  return (
    <ol className="divide-y-[1.5px] divide-ink/10">
      {rows.map((p, i) => (
        <li key={p.id} className="flex items-center gap-3 py-2.5">
          <span className="w-5 text-p-body font-semibold text-muted">{i + 1}</span>
          <Sticker id={p.avatar} size={36} />
          <span className="min-w-0 flex-1 truncate text-p-lead font-semibold">{p.name}</span>
          <span className="font-display text-p-title font-extrabold tabular-nums">{scores[p.id] ?? 0}</span>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* The word card in its sleeve (press and hold)                         */
/* ------------------------------------------------------------------ */

const RISE = 140;
/** Compact sleeve: a little space only; the card rises over whatever is above it. */
const COMPACT_GAP = 20;

/**
 * Your secret word on a card inside a mint sleeve. Hidden by default; holding
 * slides the card up. The motion and layout never depend on the word, so the
 * Imposter's card moves exactly like everyone else's.
 */
function WordSleeve({ word, open, compact, above }: { word: ReactNode; open: boolean; compact?: boolean; above?: ReactNode }) {
  return (
    <div className={`relative mx-auto w-full ${compact ? "max-w-[17rem]" : "max-w-[21rem]"}`} style={{ paddingTop: compact ? COMPACT_GAP : RISE, zIndex: compact && open ? 20 : undefined }}>
      {above && !compact && (
        <motion.div
          className="absolute inset-x-[10%] top-0 flex items-end justify-center pb-4"
          style={{ height: RISE - 4 }}
          initial={false}
          animate={{ opacity: open ? 0 : 1 }}
          transition={{ duration: open ? 0.12 : 0.2, delay: open ? 0 : 0.15, ease: ease.out }}
        >
          {above}
        </motion.div>
      )}
      <div className="relative aspect-[320/190] w-full" style={{ transform: "rotate(-1deg)" }}>
        {/* Hard shadow + back of the sleeve */}
        <svg aria-hidden viewBox="0 0 320 190" className="absolute inset-0 h-full w-full overflow-visible">
          <rect x="4" y="4" width="320" height="190" rx="6" fill={INK} />
          <rect x="0.75" y="0.75" width="318.5" height="188.5" rx="6" fill={SLEEVE_BACK} stroke={INK} strokeWidth="1.5" />
        </svg>

        {/* The card. Its top strip is blank, so the thumb notch never shows the word. */}
        <motion.div
          className="absolute inset-x-[8%] top-[7%] h-[86%]"
          style={{ zIndex: 2 }}
          initial={false}
          animate={{ y: open ? -RISE : 0 }}
          transition={open ? { ...spring.sheet, delay: 0.04 } : { duration: 0.2, ease: ease.in }}
        >
          <div className="cut flex h-full flex-col items-center rounded-cut bg-paper px-3 text-center" style={{ paddingTop: "12%" }}>
            {word}
          </div>
        </motion.div>

        {/* Front of the sleeve with a thumb notch */}
        <svg aria-hidden viewBox="0 0 320 190" className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 3 }}>
          <path
            d="M0.75 6.5A5.75 5.75 0 0 1 6.5 0.75H124a36 36 0 0 0 72 0H313.5a5.75 5.75 0 0 1 5.75 5.75V183.5a5.75 5.75 0 0 1-5.75 5.75H6.5A5.75 5.75 0 0 1 0.75 183.5Z"
            fill={SLEEVE}
            stroke={INK}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M16 150H304" stroke={INK} strokeOpacity="0.18" strokeWidth="1.5" strokeDasharray="6 6" />
        </svg>
        <div className="pointer-events-none absolute inset-x-0 bottom-[22%] flex justify-center" style={{ zIndex: 4 }} aria-hidden>
          <span className="rounded-cut border-[1.5px] border-ink bg-paper px-2.5 py-0.5 font-display text-p-note font-extrabold uppercase tracking-[0.16em]" style={{ transform: "rotate(-2deg)" }}>
            Shabd andar hai
          </span>
        </div>
      </div>
    </div>
  );
}

/** The sleeve plus its hold / tap controls. */
function SecretWord({ priv, onPeek, compact, above }: { priv: Priv; onPeek: () => void; compact?: boolean; above?: ReactNode }) {
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
  // "Tap to open" closes by itself so the word isn't left on show.
  useEffect(() => {
    if (!pinned) return;
    const t = setTimeout(() => setPinned(false), 5000);
    return () => clearTimeout(t);
  }, [pinned]);

  return (
    <div>
      <button
        type="button"
        aria-label="Your secret word, inside its sleeve. Press and hold to slide it out."
        className="no-callout relative block w-full cursor-pointer rounded-soft"
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
        <WordSleeve
          open={open}
          compact={compact}
          above={above}
          word={
            <>
              <div className="text-p-note font-semibold uppercase tracking-[0.14em] text-muted">Aapka shabd</div>
              <div className="mt-0.5 font-display text-p-title font-extrabold text-balance">{priv.word}</div>
              <div className="mt-1 text-p-note leading-snug text-ink/75">Iske baare mein sirf EK shabd bolo</div>
            </>
          }
        />
      </button>
      <div className="mt-1 flex min-h-11 items-center justify-between gap-3">
        <AnimatePresence mode="wait" initial={false}>
          {showHint ? (
            <motion.div key="first" className="leading-tight" exit={{ opacity: 0, transition: { duration: dur.screenExit, ease: ease.in } }}>
              <div className="font-display text-p-body font-bold text-vermilion">Pehle screen chhupao!</div>
              <div className="text-p-note font-medium text-ink/80">Then press &amp; hold the sleeve.</div>
            </motion.div>
          ) : (
            <motion.div key="later" className="flex items-center gap-1.5 text-p-body font-semibold" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: dur.select, ease: ease.out } }}>
              <Hand className="h-4 w-4" strokeWidth={2.4} /> Dabaake dekho
            </motion.div>
          )}
        </AnimatePresence>
        <button
          type="button"
          aria-pressed={pinned}
          aria-label={pinned ? "Close the sleeve" : "Can't hold? Tap to open for 5 seconds"}
          onClick={() => setPinned((p) => !p)}
          className="-mr-2 flex min-h-11 shrink-0 items-center rounded-cut px-2 text-p-note font-semibold text-muted underline decoration-ink/30 underline-offset-4"
        >
          {pinned ? "Band karo" : "Tap to open"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Speaking order                                                       */
/* ------------------------------------------------------------------ */

function SpeakingOrder({ view, players, me }: { view: Pub; players: Player[]; me: Player }) {
  return (
    <ol className="flex flex-wrap justify-center gap-x-1.5 gap-y-3" aria-label="Speaking order">
      {view.order.map((id, i) => {
        const p = players.find((x) => x.id === id);
        const now = i === view.speaker;
        const done = i < view.speaker;
        const away = p ? !p.connected : true;
        return (
          <li key={id} className="flex w-[4.25rem] flex-col items-center text-center" aria-current={now ? "step" : undefined}>
            <motion.span
              className={`relative rounded-full ${now ? "ring-[3px] ring-ink ring-offset-2 ring-offset-bg" : ""} ${away ? "opacity-40" : ""}`}
              animate={{ scale: now ? 1.12 : 1, y: now ? -2 : 0 }}
              transition={spring.select}
            >
              <Sticker id={p?.avatar} size={40} />
              {done && (
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-ink bg-leaf text-paper">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
              {!done && !now && <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-ink bg-paper text-p-note font-bold leading-none">{i + 1}</span>}
            </motion.span>
            <span className={`mt-1.5 w-full truncate text-p-note ${now ? "font-bold" : "font-medium text-ink/75"}`}>{id === me.id ? "Aap" : (p?.name ?? "Left")}</span>
            {away && <span className="text-[0.75rem] font-semibold leading-none text-muted">offline</span>}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Reveal                                                               */
/* ------------------------------------------------------------------ */

function iWon(r: NonNullable<Pub["reveal"]>, id: string) {
  const imp = r.imposterId === id;
  if (!r.caught) return imp;
  return imp ? r.guessCorrect : !r.guessCorrect;
}

function RevealScreen({ view, players, me, isHost, hostAct, onScores }: { view: Pub; players: Player[]; me: Player; isHost: boolean; hostAct: (t: string, p?: unknown) => void; onScores: () => void }) {
  const reveal = view.reveal!;
  const gains = useMemo(() => reveal.gains ?? {}, [reveal]);
  const parts = view.participants.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  const imposter = players.find((p) => p.id === reveal.imposterId);
  const played = view.participants.includes(me.id);
  const won = played && iWon(reveal, me.id);
  const wasImposter = reveal.imposterId === me.id;
  const [sorted, setSorted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSorted(true), 900 + dur.count * 1000);
    return () => clearTimeout(t);
  }, []);

  const prev = (id: string) => (view.scores[id] ?? 0) - (gains[id] ?? 0);
  const rows = [...parts].sort((a, b) => (sorted ? (view.scores[b.id] ?? 0) - (view.scores[a.id] ?? 0) : prev(b.id) - prev(a.id)));
  const enterDelay = useMemo(() => {
    const first = [...view.participants].sort((a, b) => (view.scores[b] ?? 0) - (gains[b] ?? 0) - ((view.scores[a] ?? 0) - (gains[a] ?? 0)));
    return Object.fromEntries(first.map((id, i) => [id, staggerDelay(i, 0.6)]));
  }, [view.participants, view.scores, gains]);

  const verdict = !reveal.caught ? "Bach nikle!" : reveal.guessCorrect ? "Chura liya!" : "Pakde gaye!";
  const votes = Object.entries(reveal.votes);

  return (
    <div className="space-y-4">
      <RoundBar round={view.round} label="Result" score={view.scores[me.id] ?? 0} onScores={onScores} />

      {/* The two words, side by side */}
      <div className="relative grid grid-cols-2 gap-3 pb-1">
        <motion.div className="cut rounded-cut bg-paper px-3 pb-9 pt-3 text-center" initial={{ opacity: 0, y: 14, rotate: -4 }} animate={{ opacity: 1, y: 0, rotate: -1.5 }} transition={{ ...spring.settle, delay: 0.1 }}>
          <div className="text-p-note font-semibold uppercase tracking-[0.12em] text-muted">Sabka shabd</div>
          <div className="mt-1 font-display text-p-title font-extrabold text-balance">{reveal.majorityWord}</div>
        </motion.div>
        <motion.div className="cut relative rounded-cut px-3 pb-9 pt-3 text-center" style={{ background: SLEEVE }} initial={{ opacity: 0, y: 14, rotate: 4 }} animate={{ opacity: 1, y: 0, rotate: 1.5 }} transition={{ ...spring.settle, delay: 0.22 }}>
          <div className="text-p-note font-semibold uppercase tracking-[0.12em] text-ink/70">Imposter ka</div>
          <div className="mt-1 font-display text-p-title font-extrabold text-balance">{reveal.imposterWord}</div>
          {imposter && (
            <span className="absolute -right-2 -top-3" style={{ transform: "rotate(10deg)" }}>
              <Sticker id={imposter.avatar} size={34} />
            </span>
          )}
        </motion.div>
        <motion.div className="pointer-events-none absolute inset-x-0 -bottom-12 z-10 flex justify-center" initial={{ opacity: 0, scale: 1.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...spring.settle, delay: 0.5 }}>
          <VerdictSlip tone={reveal.caught && !reveal.guessCorrect ? "vermilion" : "ink"} seed={view.round * 5 + 3} tilt={view.round % 2 ? -4 : 3}>
            {verdict}
          </VerdictSlip>
        </motion.div>
      </div>

      <motion.div className="pt-12 text-center" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.screen, ease: ease.out, delay: 0.65 }}>
        <p className="text-p-lead font-semibold text-balance">{revealLine(reveal, players)}</p>
        {played && (
          <p className={`mt-1 text-p-body font-bold ${won ? "text-leaf" : "text-muted"}`}>
            {won ? `Shabash! Round aapka · +${gains[me.id] ?? 0}` : wasImposter ? "Pakde gaye! Agli baar." : "Is baar Imposter jeet gaye."}
          </p>
        )}
      </motion.div>

      {votes.length > 0 && (
        <section aria-label="Who voted for whom">
          <h3 className="mb-1.5 text-p-note font-semibold uppercase tracking-[0.14em] text-muted">Kisne kisko vote diya</h3>
          <ul className="flex flex-wrap gap-2">
            {votes.map(([voter, target]) => {
              const v = players.find((p) => p.id === voter);
              const right = target === reveal.imposterId;
              return (
                <li key={voter} className={`flex items-center gap-1.5 rounded-full border-[1.5px] py-0.5 pl-0.5 pr-2.5 text-p-note font-semibold ${right ? "border-leaf bg-leaf/10" : "border-ink/20 bg-paper"}`}>
                  <Sticker id={v?.avatar} size={24} />
                  <span className="max-w-[6rem] truncate">{v?.name ?? "Left"}</span>
                  <span aria-hidden>→</span>
                  <span className="max-w-[6rem] truncate font-bold">{nameOf(players, target)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-label="Points">
        <h3 className="mb-1 text-p-note font-semibold uppercase tracking-[0.14em] text-muted">Points</h3>
        <ol className="border-y-[1.5px] border-ink">
          {rows.map((p) => {
            const isImp = p.id === reveal.imposterId;
            const gain = gains[p.id] ?? 0;
            return (
              <motion.li key={p.id} layout="position" transition={{ layout: spring.sheet }} className={`border-b-[1.5px] border-ink/10 last:border-b-0 ${isImp ? "bg-[#9adbc0]/30" : ""}`}>
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: dur.screen, ease: ease.out, delay: enterDelay[p.id] ?? 0.6 }} className="flex items-center gap-3 px-1 py-2.5">
                  <Sticker id={p.avatar} size={40} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-p-lead font-semibold">
                      {p.name}
                      {p.id === me.id && <span className="ml-1.5 text-p-note font-semibold text-muted">you</span>}
                    </div>
                    <div className={`text-p-note ${isImp ? "font-bold text-ink" : "text-muted"}`}>{isImp ? "Imposter" : "Sabke saath"}</div>
                  </div>
                  {gain > 0 && (
                    <motion.span className="rounded-cut bg-leaf px-1.5 py-0.5 text-p-note font-bold text-paper" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...spring.select, delay: 0.9 }}>
                      +{gain}
                    </motion.span>
                  )}
                  <CountUp from={prev(p.id)} to={view.scores[p.id] ?? 0} delay={0.9} className="w-9 text-right font-display text-p-title font-extrabold" />
                </motion.div>
              </motion.li>
            );
          })}
        </ol>
      </section>

      {isHost ? (
        <PaperButton size="lg" className="w-full" onClick={() => hostAct("next")}>
          <SkipForward className="h-5 w-5" strokeWidth={2.4} /> Agla round
        </PaperButton>
      ) : (
        <WaitingDots>Host agla round shuru karega…</WaitingDots>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phone view                                                           */
/* ------------------------------------------------------------------ */

export function Phone({ view, priv, me, players, send, now, isHost, hostAct }: PhoneProps<Pub, Priv>) {
  const [sheet, setSheet] = useState<"scores" | null>(null);
  const [guess, setGuess] = useState("");
  const { shared, mine } = useSfx();

  const reveal = view.phase === "reveal" ? view.reveal : null;
  const myVote = priv?.myVote ?? null;
  const inRound = view.participants.includes(me.id);
  const parts = view.participants.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  const others = parts.filter((p) => p.id !== me.id);
  const speakerId = view.order[view.speaker];
  const speaker = players.find((p) => p.id === speakerId);
  const mySpeak = speakerId === me.id && view.phase === "clues";
  const deadline = view.phase === "vote" ? view.voteDeadline : view.phase === "imposter-guess" ? view.guessDeadline : null;
  const secsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : -1;
  const accused = players.find((p) => p.id === view.accused);
  const myScore = view.scores[me.id] ?? 0;

  useOnChange(secsLeft, (n) => {
    if (n > 0 && n <= 5) shared("tick");
  });
  useOnChange(mySpeak, (m) => {
    if (m) mine("turn", [60]);
  });
  useOnChange(myVote, (v) => {
    if (v) mine("ding", [40]);
  });
  useOnChange(priv?.mustGuess ?? false, (g) => {
    if (g) mine("buzz", [200]);
  });
  useOnChange(reveal ? `${view.round}` : null, (r) => {
    if (!r || !reveal) return;
    shared("reveal");
    vibrate([30, 60, 30]);
    if (!inRound) return;
    if (iWon(reveal, me.id)) {
      mine("fanfare", [60, 40, 60]);
      setTimeout(() => celebrate(["#9adbc0", "#f2b632", "#c23a22", INK]), 700);
    }
  });
  useOnChange(`${view.round}-${view.phase}`, () => {
    setSheet(null);
    setGuess("");
  });

  const onPeek = () => mine("rustle", 12);

  /** Who speaks now. Sits in the space above the sleeve; the open card slides over it. */
  const speakerNote = (
    <motion.div
      key={`${view.clueRound}-${view.speaker}`}
      className={`cut w-full rounded-cut px-3.5 py-3 text-left ${mySpeak ? "bg-turmeric" : "bg-paper"}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, rotate: mySpeak ? -1.2 : 0.6 }}
      transition={spring.settle}
    >
      <div className="flex items-center gap-3">
        {mySpeak ? <Mic className="h-7 w-7 shrink-0" strokeWidth={2.2} /> : <Sticker id={speaker?.avatar} size={40} />}
        <div className="min-w-0 leading-tight">
          <div className="font-display text-p-title font-extrabold">{mySpeak ? "Aapki baari!" : `Ab bolo: ${speaker?.name ?? "…"}`}</div>
          <div className="mt-0.5 text-p-note text-ink/80">{mySpeak ? "Apne shabd ke baare mein EK shabd bolo. Apna shabd nahi!" : "Dhyaan se suno. Kiska clue alag lag raha hai?"}</div>
        </div>
      </div>
      {speaker && !speaker.connected && !mySpeak && (
        <p className="mt-1.5 flex items-center gap-1.5 text-p-note font-semibold text-vermilion">
          <WifiOff className="h-4 w-4" /> {speaker.name} offline hai. Host aage badha sakta hai.
        </p>
      )}
    </motion.div>
  );

  const clues = (
    <div className="space-y-4">
      <RoundBar round={view.round} label={`Clue round ${view.clueRound}`} score={myScore} onScores={() => setSheet("scores")} />
      {inRound && priv ? (
        <SecretWord priv={priv} onPeek={onPeek} above={speakerNote} />
      ) : (
        <div className="cut rounded-cut bg-paper px-4 py-3.5">{speakerNote}</div>
      )}

      <section aria-label="Speaking order" className="pt-1">
        <h3 className="mb-2 text-center text-p-note font-semibold uppercase tracking-[0.14em] text-muted">Bolne ki baari</h3>
        <SpeakingOrder view={view} players={players} me={me} />
      </section>

      {!inRound && <p className="text-center text-p-body text-muted">Aap agle round mein khelenge. Tab tak suno aur andaaza lagao!</p>}

      {isHost && (
        <HostSection>
          {view.speaker < view.order.length - 1 ? (
            <PaperButton tone="turmeric" className="w-full" onClick={() => hostAct("nextSpeaker")}>
              <SkipForward className="h-4 w-4" strokeWidth={2.4} /> Agla bolne wala
            </PaperButton>
          ) : (
            <PaperButton tone="paper" className="w-full" onClick={() => hostAct("anotherRound")}>
              <Repeat2 className="h-4 w-4" strokeWidth={2.4} /> Ek aur clue round
            </PaperButton>
          )}
          <PaperButton tone={view.speaker < view.order.length - 1 ? "paper" : "turmeric"} className="w-full" onClick={() => hostAct("startVote")}>
            <Vote className="h-4 w-4" strokeWidth={2.4} /> Voting shuru karo
          </PaperButton>
        </HostSection>
      )}
    </div>
  );

  const voting = (
    <div className="space-y-4">
      <RoundBar round={view.round} label="Voting" score={myScore} onScores={() => setSheet("scores")} right={view.voteDeadline ? <TimerTag deadline={view.voteDeadline} now={now} label="Voting" /> : undefined} />
      {inRound && priv && <SecretWord priv={priv} onPeek={onPeek} compact />}

      <section aria-label="Vote">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-p-title font-extrabold">Odd one kaun?</h2>
          <div className="pb-1 text-p-note font-semibold text-muted">
            {view.voted.length} of {parts.length} voted
          </div>
        </div>
        <p className="text-p-body text-muted">
          {!inRound ? "Is round mein aap sirf dekh rahe ho." : myVote ? "Tap again to take your vote back. Votes stay secret till the end." : "Kiska shabd alag hai? Votes stay secret till the end."}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(inRound ? others : parts).map((p, i) => {
            const selected = myVote === p.id;
            const hasVoted = view.voted.includes(p.id);
            return (
              <motion.button
                key={p.id}
                disabled={!inRound}
                aria-pressed={selected}
                aria-label={`Vote for ${p.name}`}
                onClick={() => send("vote", selected ? null : p.id)}
                whileTap={inRound ? { scale: 0.96, transition: { duration: dur.pressDown, ease: ease.out } } : undefined}
                animate={{ rotate: selected ? (i % 2 ? 1.5 : -1.5) : 0, backgroundColor: selected ? "var(--me)" : "var(--paper)" }}
                transition={spring.select}
                className={`cut relative flex min-h-[4.75rem] items-center gap-3 rounded-cut px-3 py-2.5 text-left ${p.connected ? "" : "opacity-60"}`}
              >
                <Sticker id={p.avatar} size={44} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-p-lead font-bold">{p.name}</span>
                  <span className="mt-1 block truncate text-p-note font-semibold text-ink/70">{!p.connected ? "offline" : hasVoted ? "vote de diya" : "soch rahe…"}</span>
                </span>
                <AnimatePresence>
                  {selected && (
                    <motion.span
                      className="absolute -right-2 -top-2.5 flex items-center gap-1 rounded-cut border-[1.5px] border-ink bg-ink px-1.5 py-0.5 text-p-note font-bold text-bg"
                      initial={{ opacity: 0, scale: 0.5, rotate: 8 }}
                      animate={{ opacity: 1, scale: 1, rotate: 8, transition: spring.select }}
                      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.12, ease: ease.in } }}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} /> My vote
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </section>

      {isHost && (
        <HostSection>
          <ConfirmButton label="Bas! Count the votes" confirmLabel="Tap again to count now" icon={<Gavel className="h-4 w-4" strokeWidth={2.4} />} now={now} onConfirm={() => hostAct("closeVote")} />
        </HostSection>
      )}
    </div>
  );

  const guessing = (
    <div className="space-y-4">
      <RoundBar round={view.round} label="Aakhri mauka" score={myScore} onScores={() => setSheet("scores")} right={view.guessDeadline ? <TimerTag deadline={view.guessDeadline} now={now} label="Imposter's guess" /> : undefined} />
      {priv?.mustGuess ? (
        <div className="space-y-4">
          <div className="flex justify-center pt-2">
            <VerdictSlip tone="vermilion" seed={view.round * 3 + 1} tilt={-3}>
              Pakde gaye!
            </VerdictSlip>
          </div>
          <div className="cut rounded-cut bg-paper p-4 text-center">
            <p className="text-p-body text-muted">Aap Imposter the. Aapka shabd alag tha:</p>
            <p className="mt-1 font-display text-p-title font-extrabold">{priv.word}</p>
            <p className="mt-2 text-p-body">Sahi shabd bataya, toh round aapka (+3).</p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const t = guess.trim();
              if (!t) return;
              send("guess", t);
            }}
          >
            <label htmlFor="odd-guess" className="sr-only">
              Asli shabd kya tha?
            </label>
            <input
              id="odd-guess"
              value={guess}
              onChange={(e) => setGuess(e.target.value.slice(0, 40))}
              placeholder="Asli shabd kya tha?"
              autoComplete="off"
              autoCapitalize="off"
              className="cut paper-rule min-h-14 min-w-0 flex-1 rounded-cut bg-paper px-3 font-display text-p-lead font-bold outline-none placeholder:font-semibold placeholder:text-ink/35"
            />
            <PaperButton type="submit" tone="vermilion" size="lg" aria-label="Send guess" disabled={!guess.trim()}>
              <Send className="h-5 w-5" strokeWidth={2.4} />
            </PaperButton>
          </form>
          <p className="text-center text-p-note text-muted">Spelling thodi galat ho toh bhi chalega.</p>
          <section className="rounded-cut border-[1.5px] border-dashed border-ink/25 px-3 pb-4 pt-3">
            <h3 className="mb-2 text-center text-p-note font-semibold uppercase tracking-[0.14em] text-muted">Yaad karo, inhone kya bola tha</h3>
            <SpeakingOrder view={{ ...view, speaker: view.order.length }} players={players} me={me} />
          </section>
        </div>
      ) : (
        <div className="flex min-h-[46vh] flex-col items-center justify-center text-center">
          <motion.span initial={{ scale: 0.6, rotate: -14 }} animate={{ scale: 1, rotate: -6 }} transition={spring.settle}>
            <span className="breathe inline-block">
              <Sticker id={accused?.avatar} size={96} />
            </span>
          </motion.span>
          <div className="mt-4">
            <VerdictSlip tone="vermilion" seed={view.round * 3 + 2} tilt={3}>
              Pakde gaye!
            </VerdictSlip>
          </div>
          <h2 className="mt-4 font-display text-p-title font-extrabold text-balance">{accused?.id === me.id ? "Aap" : (accused?.name ?? "Imposter")} hi Imposter hai!</h2>
          <div className="mt-3">
            <WaitingDots>Imposter soch rahe hain…</WaitingDots>
          </div>
          <p className="mt-2 max-w-xs text-p-body text-muted">Agar unhone sabka shabd sahi bataya, toh round unka.</p>
        </div>
      )}
      {isHost && (
        <HostSection>
          <ConfirmButton label="Guess skip karo" confirmLabel="Tap again to skip" icon={<SkipForward className="h-4 w-4" strokeWidth={2.4} />} now={now} onConfirm={() => hostAct("skipGuess")} />
        </HostSection>
      )}
    </div>
  );

  const dealing = (
    <div className="space-y-4">
      <RoundBar round={view.round} label="Shuru" score={myScore} onScores={() => setSheet("scores")} />
      <div className="pointer-events-none">
        <WordSleeve open={false} word={<span />} />
      </div>
      <WaitingDots>Shabd aa raha hai…</WaitingDots>
    </div>
  );

  const body = reveal ? null : inRound && !priv ? dealing : view.phase === "clues" ? clues : view.phase === "vote" ? voting : guessing;

  return (
    <MotionConfig reducedMotion="user">
      <InkDefs />
      <div className="relative z-10 text-ink">
        <div aria-live="polite" className="sr-only">
          {reveal ? revealLine(reveal, players) : view.phase === "imposter-guess" ? `${accused?.name ?? "The Imposter"} was caught and gets one guess.` : ""}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {reveal ? (
            <motion.div key={`reveal-${view.round}`} {...screenIn}>
              <RevealScreen view={view} players={players} me={me} isHost={isHost} hostAct={hostAct} onScores={() => setSheet("scores")} />
            </motion.div>
          ) : (
            <motion.div key={`${view.phase}-${view.round}`} {...screenIn}>
              {body}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <PaperSheet open={sheet === "scores"} onClose={() => setSheet(null)} title="Ab tak ke points">
        <ScoreList players={players} scores={view.scores} />
      </PaperSheet>
    </MotionConfig>
  );
}
