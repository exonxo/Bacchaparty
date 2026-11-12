"use client";
import { Check, Clock, Gavel, Hand, MessageCircleQuestion, SkipForward, Tag, Trophy } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { dur, ease, screenIn, spring, staggerDelay } from "@/components/paper/motion";
import { Envelope, InkDefs, Magnifier, MaskGlyph, VerdictSlip } from "@/components/paper/objects";
import { CountUp, PaperBackdrop, PaperButton, PaperSheet, Sticker, tornClip, usePaperTheme } from "@/components/paper/Paper";
import { celebrate } from "@/lib/celebrate";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import { vibrate } from "@/lib/sfx";
import type { PhoneProps, Player } from "@/lib/types";
import { chorWon, fmt, iWon, nameOf, resultText, roundGains } from "./helpers";
import { CHOR_TOPIC_ALL, type ChorTopicChoice } from "@/content/chor-kaun";
import type { Priv, Pub } from "./index";
import { TopicPicker } from "./TopicPicker";

const HINT_KEY = "bacchaparty-chor-peeked";

/* ------------------------------------------------------------------ */
/* Small pieces                                                         */
/* ------------------------------------------------------------------ */

/** Luggage-tag timer. Turns vermilion in the last 30 seconds. */
function TimerTag({ deadline, now }: { deadline: number; now: number }) {
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const urgent = left <= 30;
  return (
    <div
      role="timer"
      aria-label={`${Math.floor(left / 60)} minutes ${left % 60} seconds left`}
      className={`cut flex h-11 items-center gap-2 rounded-cut pl-2.5 pr-3 ${urgent ? "bg-vermilion text-paper" : "bg-paper text-ink"}`}
      style={{ transform: "rotate(1.2deg)" }}
    >
      <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-current bg-bg" />
      <Clock className="h-4 w-4" strokeWidth={2.4} />
      <span className="font-display text-p-lead font-bold tabular-nums">{fmt(left)}</span>
    </div>
  );
}

function RoundBar({ round, label, score, onScores, right }: { round: number; label?: string; score: number; onScores: () => void; right?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="leading-none">
          {label && <div className="text-p-note font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>}
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

function WordsGrid({ words, picked, onPick }: { words: string[]; picked?: string | null; onPick?: (word: string) => void }) {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {words.map((w) => {
        const on = picked === w;
        return (
          <li key={w}>
            {onPick ? (
              <button
                onClick={() => onPick(w)}
                aria-pressed={on}
                className={`flex min-h-12 w-full items-center gap-2 rounded-cut border-[1.5px] px-3 py-2 text-left text-p-body font-semibold leading-tight transition-colors duration-200 ${
                  on ? "border-ink bg-turmeric shadow-[2px_2px_0_0_var(--ink)]" : "border-ink/20 bg-paper"
                }`}
              >
                <span className="min-w-0 text-balance">{w}</span>
              </button>
            ) : (
              <div className="flex min-h-11 items-center rounded-cut border-[1.5px] border-ink/15 bg-paper px-3 py-2 text-p-body font-medium leading-tight">{w}</div>
            )}
          </li>
        );
      })}
    </ul>
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
/* Secret envelope (press and hold)                                     */
/* ------------------------------------------------------------------ */

function SecretEnvelope({ priv, round, onPeek, above }: { priv: Priv; round: number; onPeek: () => void; above?: ReactNode }) {
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
  // "Keep open" closes by itself so the secret isn't left on show.
  useEffect(() => {
    if (!pinned) return;
    const t = setTimeout(() => setPinned(false), 5000);
    return () => clearTimeout(t);
  }, [pinned]);

  return (
    <div>
      <div className="relative">
        <button
          type="button"
          aria-label="Your secret envelope. Press and hold to peek inside."
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
          <Envelope open={open} seed={round * 7 + 3} above={above}>
            {/* Same three lines for everyone, so the chit's shape gives nothing away. */}
            <div className="text-p-note font-semibold uppercase tracking-[0.14em] text-muted">{priv.chor ? "Shh… you are the" : "Your word"}</div>
            <div className="mt-0.5 flex items-center justify-center gap-2 font-display text-p-title font-extrabold text-balance">
              {priv.chor ? (
                <>
                  <MaskGlyph size={26} /> CHOR
                </>
              ) : (
                priv.word
              )}
            </div>
            <div className="mt-1 text-p-body leading-snug">{priv.chor ? "Blend in. Find the word everyone else got." : "Everyone else has this same word."}</div>
          </Envelope>
        </button>
      </div>
      <div className="mt-2 flex min-h-11 items-center justify-between gap-3">
        <AnimatePresence mode="wait" initial={false}>
          {showHint ? (
            <motion.div key="first" className="leading-tight" exit={{ opacity: 0, transition: { duration: dur.screenExit, ease: ease.in } }}>
              <div className="font-display text-p-body font-bold text-vermilion">Pehle screen chhupao!</div>
              <div className="text-p-note font-medium text-ink/80">Hide your screen, then press &amp; hold.</div>
            </motion.div>
          ) : (
            <motion.div
              key="later"
              className="flex items-center gap-1.5 text-p-body font-semibold"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: dur.select, ease: ease.out } }}
            >
              <Hand className="h-4 w-4" strokeWidth={2.4} /> Dabaake rakho — chupke se dekho
            </motion.div>
          )}
        </AnimatePresence>
        <button
          type="button"
          aria-pressed={pinned}
          onClick={() => setPinned((p) => !p)}
          className="-mr-2 flex min-h-11 items-center rounded-cut px-2 text-p-note font-semibold text-muted underline decoration-ink/30 underline-offset-4"
        >
          {pinned ? "Close it" : "Can’t hold? Tap to open"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reveal                                                               */
/* ------------------------------------------------------------------ */

function RevealScreen({
  view,
  players,
  me,
  isHost,
  hostAct,
  onScores,
  hostTopic,
  onHostTopic,
}: {
  view: Pub;
  players: Player[];
  me: Player;
  isHost: boolean;
  hostAct: (t: string, payload?: unknown) => void;
  onScores: () => void;
  hostTopic: ChorTopicChoice;
  onHostTopic: (t: ChorTopicChoice) => void;
}) {
  const reveal = view.reveal!;
  const parts = view.participants.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  const gains = useMemo(() => roundGains(reveal, view.participants), [reveal, view.participants]);
  const played = view.participants.includes(me.id);
  const won = iWon(reveal, me.id);
  const wasChor = reveal.chorId === me.id;
  const escaped = chorWon(reveal.result);
  const [open, setOpen] = useState(false);
  const [sorted, setSorted] = useState(false);

  useEffect(() => {
    const a = setTimeout(() => setOpen(true), 260);
    const b = setTimeout(() => setSorted(true), 260 + 700 + 500 + dur.count * 1000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  const prev = (id: string) => (view.scores[id] ?? 0) - (gains[id] ?? 0);
  const rows = [...parts].sort((a, b) => (sorted ? (view.scores[b.id] ?? 0) - (view.scores[a.id] ?? 0) : prev(b.id) - prev(a.id)));
  const verdict = reveal.result.reason === "guess" && reveal.result.chorGuessCorrect ? "Sahi jawab!" : escaped ? "Bhaag gaye!" : "Pakde gaye!";
  const base = 0.26 + dur.reveal;
  // Stagger by the first (pre-sort) order, fixed per player so a re-sort doesn't replay it.
  const enterDelay = useMemo(() => {
    const first = [...view.participants].sort((a, b) => (view.scores[b] ?? 0) - (gains[b] ?? 0) - ((view.scores[a] ?? 0) - (gains[a] ?? 0)));
    return Object.fromEntries(first.map((id, i) => [id, staggerDelay(i, 0.26 + dur.reveal + 0.25)]));
  }, [view.participants, view.scores, gains]);

  return (
    <div className="space-y-4">
      <RoundBar round={view.round} label="Result" score={view.scores[me.id] ?? 0} onScores={onScores} />

      <div className="relative">
        <Envelope open={open} sealed={false} seed={view.round * 11 + 5}>
          <div className="text-p-note font-semibold uppercase tracking-[0.14em] text-muted">
            Topic: {reveal.topicLabel} · The word was
          </div>
          <div className="mt-0.5 font-display text-p-title font-extrabold text-balance">{reveal.majorityWord}</div>
          <div className="mt-1 text-p-note text-muted">Chor had: {reveal.chorWord}</div>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-p-body">
            <MaskGlyph size={20} className="text-vermilion" /> Chor: <b>{nameOf(players, reveal.chorId)}</b>
          </div>
        </Envelope>
        <motion.div
          className="pointer-events-none relative z-10 -mt-9 flex justify-center"
          initial={{ opacity: 0, scale: 1.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...spring.settle, delay: base }}
        >
          <VerdictSlip tone={escaped ? "ink" : "vermilion"} seed={view.round * 5 + 2} tilt={view.round % 2 ? -4 : 3}>
            {verdict}
          </VerdictSlip>
        </motion.div>
      </div>

      <motion.div className="text-center" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.screen, ease: ease.out, delay: base + 0.15 }}>
        <p className="text-p-lead font-semibold text-balance">{resultText(reveal.result, players, reveal.chorId)}</p>
        {played && (
          <p className={`mt-1 text-p-body font-bold ${won ? "text-leaf" : "text-muted"}`}>
            {won ? `Shabash! You win this round · +${gains[me.id] ?? 0}` : wasChor ? "Pakde gaye! Agli baar." : "Chor bhaag gaye. Agli baar pakdenge!"}
          </p>
        )}
      </motion.div>

      <section aria-label="Who was who, and points">
        <h3 className="mb-1 text-p-note font-semibold uppercase tracking-[0.14em] text-muted">Who was who</h3>
        <ol className="border-y-[1.5px] border-ink">
          {rows.map((p) => {
            const isChor = p.id === reveal.chorId;
            const gain = gains[p.id] ?? 0;
            return (
              <motion.li key={p.id} layout="position" transition={{ layout: spring.sheet }} className={`border-b-[1.5px] border-ink/10 last:border-b-0 ${isChor ? "bg-vermilion/[0.08]" : ""}`}>
               {/* Entry fade lives on an inner element so it never fights the re-sort (layout) animation. */}
               <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: dur.screen, ease: ease.out, delay: enterDelay[p.id] ?? base }}
                className="flex items-center gap-3 px-1 py-2.5"
               >
                <Sticker id={p.avatar} size={40} />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-p-lead font-semibold">
                    {p.name}
                    {p.id === me.id && <span className="ml-1.5 text-p-note font-semibold text-muted">you</span>}
                  </div>
                  <div className={`flex items-center gap-1.5 text-p-note ${isChor ? "font-bold text-vermilion" : "text-muted"}`}>
                    {isChor && <MaskGlyph size={16} />}
                    {isChor ? "The Chor" : "In the know"}
                  </div>
                </div>
                {gain > 0 && (
                  <motion.span
                    className="rounded-cut bg-leaf px-1.5 py-0.5 text-p-note font-bold text-paper"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ ...spring.select, delay: base + 0.5 }}
                  >
                    +{gain}
                  </motion.span>
                )}
                <CountUp from={prev(p.id)} to={view.scores[p.id] ?? 0} delay={base + 0.5} className="w-9 text-right font-display text-p-title font-extrabold" />
               </motion.div>
              </motion.li>
            );
          })}
        </ol>
      </section>

      {isHost ? (
        <div className="space-y-4">
          <HostTopicPickerSection hostTopic={hostTopic} onHostTopic={onHostTopic} />
          <PaperButton size="lg" className="w-full" onClick={() => hostAct("next")}>
            <SkipForward className="h-5 w-5" strokeWidth={2.4} /> Next round
          </PaperButton>
        </div>
      ) : (
        <p className="flex items-center justify-center gap-2 text-p-body text-muted">
          <span className="flex gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-ink/50" animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }} />
            ))}
          </span>
          Host agle lifafe baant rahe hain…
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phone view                                                           */
/* ------------------------------------------------------------------ */

function HostTopicPickerSection({ hostTopic, onHostTopic }: { hostTopic: ChorTopicChoice; onHostTopic: (t: ChorTopicChoice) => void }) {
  return (
    <div className="border-t-[1.5px] border-dashed border-ink/25 pt-4">
      <h3 className="mb-2 text-p-note font-semibold uppercase tracking-[0.14em] text-muted">Topic for next round</h3>
      <TopicPicker value={hostTopic} onChange={onHostTopic} compact />
    </div>
  );
}

export function Phone({ view, priv, me, players, send, now, isHost, hostAct }: PhoneProps<Pub, Priv>) {
  usePaperTheme();
  const [sheet, setSheet] = useState<"guess" | "words" | "scores" | null>(null);
  const [hostTopic, setHostTopic] = useState<ChorTopicChoice>(CHOR_TOPIC_ALL);
  const [guessPick, setGuessPick] = useState<string | null>(null);
  const { shared, mine } = useSfx();

  const reveal = view.phase === "reveal" ? view.reveal : null;
  const secsLeft = view.phase === "playing" ? Math.max(0, Math.ceil((view.deadline - now) / 1000)) : -1;
  const myVote = priv?.myVote ?? null;
  const askerClip = useMemo(() => tornClip(view.round * 13 + 1, { bottom: true }, 4), [view.round]);

  useOnChange(secsLeft, (n) => {
    if (n > 0 && n <= 10) shared("tick");
  });
  useOnChange(myVote, (v) => {
    if (v) mine("ding", [40]);
  });
  useOnChange(reveal ? `${view.round}` : null, (r) => {
    if (!r || !reveal) return;
    shared("reveal");
    vibrate([30, 60, 30]);
    if (!view.participants.includes(me.id)) return;
    if (iWon(reveal, me.id)) {
      mine("fanfare", [60, 40, 60]);
      setTimeout(() => celebrate(["#f2b632", "#c23a22", "#2f7d4f", "#1e1a17"]), 900);
    } else if (reveal.chorId === me.id) mine("buzz", [200]);
  });
  useOnChange(`${view.round}-${view.phase}`, () => {
    setSheet(null);
    setGuessPick(null);
  });
  useOnChange(view.topicSetting, (t) => setHostTopic(t));

  const parts = view.participants.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  const myScore = view.scores[me.id] ?? 0;
  const inRound = view.participants.includes(me.id);
  const others = parts.filter((p) => p.id !== me.id);
  const iAsk = view.firstAsker === me.id;

  /** Who starts — a small note that the open chit slides over. */
  const askerNote = (
    <div className="cut-drop" style={{ transform: "rotate(-1.2deg)" }}>
      <div className="flex items-center gap-2 bg-paper px-3 pb-3 pt-2 text-left leading-tight" style={{ clipPath: askerClip }}>
        <MessageCircleQuestion className="h-5 w-5 shrink-0 text-turmeric-ink" strokeWidth={2.2} />
        <span>
          <span className="block text-p-body font-bold">{iAsk ? "Pehla sawaal aapka" : `Pehla sawaal: ${nameOf(players, view.firstAsker)}`}</span>
          <span className="block text-p-note text-muted">then take turns asking questions</span>
        </span>
      </div>
    </div>
  );

  const playing = (
    <div className="space-y-4">
      <RoundBar round={view.round} label={view.topicLabel} score={myScore} onScores={() => setSheet("scores")} right={<TimerTag deadline={view.deadline} now={now} />} />

      {!inRound ? (
        <div className="space-y-3">
          <div className="cut rounded-cut bg-paper p-4">
            <div className="font-display text-p-title font-extrabold">You’re in the next round</div>
            <p className="mt-1 text-p-body text-muted">Listen to the questions and try to spot the Chor. Words are from: {view.topicLabel}</p>
          </div>
          <WordsGrid words={view.wordChoices} />
        </div>
      ) : !priv ? (
        <div className="pointer-events-none">
          <Envelope open={false}>
            <span />
          </Envelope>
          <p className="mt-2 text-center text-p-body font-semibold text-muted">Lifafe bant rahe hain…</p>
        </div>
      ) : (
        <>
          <div className="-mt-3">
            <SecretEnvelope priv={priv} round={view.round} onPeek={() => mine("rustle", 12)} above={askerNote} />
          </div>

          <section aria-label="Vote">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-display text-p-title font-extrabold">Kaun hai chor?</h2>
              <div className="pb-1 text-p-note font-semibold text-muted">
                {view.voted.length} of {parts.length} voted
              </div>
            </div>
            <p className="text-p-body text-muted">{myVote ? "Tap again to take your vote back. Votes stay secret till the end." : "Tap who you suspect. Votes stay secret till the end."}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {others.map((p, i) => {
                const selected = myVote === p.id;
                const hasVoted = view.voted.includes(p.id);
                return (
                  <motion.button
                    key={p.id}
                    aria-pressed={selected}
                    aria-label={`Vote for ${p.name}`}
                    onClick={() => send("vote", selected ? null : p.id)}
                    whileTap={{ scale: 0.96, transition: { duration: dur.pressDown, ease: ease.out } }}
                    animate={{ rotate: selected ? (i % 2 ? 1.5 : -1.5) : 0, backgroundColor: selected ? "var(--me)" : "var(--paper)" }}
                    transition={spring.select}
                    className="cut relative flex min-h-[4.75rem] items-center gap-3 rounded-cut px-3 py-2.5 text-left"
                  >
                    <Sticker id={p.avatar} size={44} />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-p-lead font-bold">{p.name}</span>
                      <span className="mt-1 flex h-4 items-center gap-1.5 text-p-note font-semibold text-ink/70">
                        {hasVoted ? "vote de diya" : "soch rahe hain…"}
                      </span>
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

          {priv.chor ? (
            <div>
              <PaperButton tone="vermilion" size="lg" className="w-full" onClick={() => setSheet("guess")}>
                <Magnifier size={26} /> I know the real word!
              </PaperButton>
              <p className="mt-2 text-center text-p-note text-muted">One guess only. Wrong guess and you are caught.</p>
            </div>
          ) : (
            <button onClick={() => setSheet("words")} className="mx-auto flex min-h-11 items-center gap-1.5 rounded-cut px-3 text-p-body font-semibold underline decoration-ink/30 underline-offset-4">
              <Tag className="h-4 w-4" /> See all words
            </button>
          )}
        </>
      )}

      {isHost && (
        <div className="border-t-[1.5px] border-dashed border-ink/25 pt-4">
          <div className="mb-2 text-p-note font-semibold uppercase tracking-[0.14em] text-muted">Host</div>
          <ConfirmButton label="Bas! Count the votes" confirmLabel="Tap again to stop the round" icon={<Gavel className="h-4 w-4" strokeWidth={2.4} />} now={now} onConfirm={() => hostAct("end")} />
        </div>
      )}
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <PaperBackdrop />
      <InkDefs />
      <div className="relative z-10 text-ink">
        <div aria-live="polite" className="sr-only">
          {reveal ? resultText(reveal.result, players, reveal.chorId) : ""}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {reveal ? (
            <motion.div key={`reveal-${view.round}`} {...screenIn}>
              <RevealScreen
                view={view}
                players={players}
                me={me}
                isHost={isHost}
                hostAct={hostAct}
                onScores={() => setSheet("scores")}
                hostTopic={hostTopic}
                onHostTopic={(t) => {
                  setHostTopic(t);
                  hostAct("topic", t);
                }}
              />
            </motion.div>
          ) : (
            <motion.div key={`play-${view.round}`} {...screenIn}>
              {playing}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <PaperSheet
        open={sheet === "guess" && !!priv?.chor}
        onClose={() => setSheet(null)}
        title="Pick the real word"
        footer={
          <PaperButton
            tone="vermilion"
            size="lg"
            className="w-full"
            disabled={!guessPick}
            onClick={() => {
              if (!guessPick) return;
              send("guess", guessPick);
              setSheet(null);
            }}
          >
            {guessPick ? `Lock in: ${guessPick}` : "Pick a word first"}
          </PaperButton>
        }
      >
        <p className="mb-3 text-p-body text-muted">You get one guess. Right: you win 3 points. Wrong: you are caught.</p>
        <WordsGrid words={view.wordChoices} picked={guessPick} onPick={setGuessPick} />
      </PaperSheet>
      <PaperSheet open={sheet === "words"} onClose={() => setSheet(null)} title="All words">
        <p className="mb-3 text-p-body text-muted">Topic: {view.topicLabel}. The Chor sees this list too.</p>
        <WordsGrid words={view.wordChoices} />
      </PaperSheet>
      <PaperSheet open={sheet === "scores"} onClose={() => setSheet(null)} title="Ab tak ke points">
        <ScoreList players={players} scores={view.scores} />
      </PaperSheet>
    </MotionConfig>
  );
}
