"use client";
import confetti from "canvas-confetti";
import { Eye, Film, Lightbulb, MapPin, Music, Quote, Send, SkipForward, Sparkles, Trophy, Tv, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CountUp, PaperButton, PaperSheet, Sticker } from "@/components/paper/Paper";
import { dur, ease, screenIn, spring } from "@/components/paper/motion";
import { InkDefs, Stamp } from "@/components/paper/objects";
import { celebrate } from "@/lib/celebrate";
import { playerColor } from "@/lib/colors";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import type { PhoneProps, Player } from "@/lib/types";
import { POINTS, type Pub } from "./shared";

/** Emoji Picture's paper colour: sky blue. */
const SKY = "#8cc8f0";
const SKY_DEEP = "#1f5f8b";
const NOTE = "#fff3a8";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  Movie: Film,
  Food: UtensilsCrossed,
  Place: MapPin,
  Festival: Sparkles,
  Phrase: Quote,
  Cartoon: Tv,
  Sport: Trophy,
  Song: Music,
};

/** What to ask for, per category. */
const ASK: Record<string, string> = {
  Movie: "Kaunsi film?",
  Food: "Kya khana hai?",
  Place: "Kaunsi jagah?",
  Festival: "Kaunsa tyohaar?",
  Phrase: "Kaunsi kahawat?",
  Cartoon: "Kaunsa cartoon?",
  Sport: "Kaunsa khel?",
  Song: "Kaunsa gaana?",
};

function ranked(players: Player[], scores: Record<string, number>) {
  return players
    .filter((p) => p.id in scores)
    .map((p) => ({ p, s: scores[p.id] ?? 0 }))
    .sort((a, b) => b.s - a.s);
}

function pointsFor(rank: number) {
  return POINTS[rank] ?? 1;
}

/** A small burst from the answer strip — quieter than the end-of-game confetti. */
function smallConfetti(color: string) {
  try {
    confetti({ particleCount: 28, spread: 55, startVelocity: 26, gravity: 1.1, scalar: 0.8, ticks: 90, origin: { x: 0.5, y: 0.62 }, colors: [color, SKY, "#f2b632"], disableForReducedMotion: true });
  } catch {}
}

/* ------------------------------------------------------------------ */
/* Top bar: progress pips + my score                                    */
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

function TopBar({ idx, total, score, onScores }: { idx: number; total: number; score: number; onScores: () => void }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <div>
        <div className="font-display text-p-title font-extrabold leading-none">
          Card {idx + 1}
          <span className="text-p-lead font-bold text-muted"> / {total}</span>
        </div>
        <div className="mt-1.5 flex gap-1" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full border border-ink transition-colors duration-300"
              style={{ width: total > 10 ? 10 : 14, background: i < idx ? "var(--ink)" : i === idx ? SKY : "transparent" }}
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

/* ------------------------------------------------------------------ */
/* Timer                                                                */
/* ------------------------------------------------------------------ */

/** A paper measuring strip that shortens; calm until the last five seconds. */
function TimeStrip({ deadline, seconds, now }: { deadline: number; seconds: number; now: number }) {
  const left = Math.max(0, deadline - now);
  const secs = Math.ceil(left / 1000);
  const pct = Math.max(0, Math.min(100, (left / (seconds * 1000)) * 100));
  const low = secs <= 5;
  return (
    <div role="timer" aria-label={`${secs} seconds left`} className="flex items-center gap-3">
      <div className="h-3 flex-1 overflow-hidden rounded-full border-[1.5px] border-ink bg-paper">
        <div className="h-full" style={{ width: `${pct}%`, background: low ? "var(--vermilion)" : SKY, transition: "width 0.3s linear, background-color 0.3s" }} />
      </div>
      <span className={`font-display w-10 text-right text-p-title font-extrabold tabular-nums ${low ? "text-vermilion" : ""}`}>{secs}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The flash card                                                       */
/* ------------------------------------------------------------------ */

function emojiSize(emojis: string) {
  const n = [...emojis.replace(/\s/g, "")].length;
  return n <= 3 ? "5rem" : n <= 4 ? "4.25rem" : n <= 6 ? "3.4rem" : "2.8rem";
}

/**
 * The puzzle on a flash card with a category tab. `flipped` turns it over to
 * show the answer; the swap happens at the halfway point of the turn. The
 * cards left in the round sit underneath as a thinning stack.
 */
function FlashCard({ view }: { view: Pub }) {
  const reduce = useReducedMotion();
  const flipped = view.phase === "reveal";
  const Icon = CATEGORY_ICON[view.category] ?? Sparkles;
  const under = Math.min(3, view.total - view.idx - 1);
  const face = "absolute inset-0 flex flex-col items-center justify-center rounded-soft border-[1.5px] border-ink px-4 text-center";
  return (
    <motion.div
      className="relative pt-7"
      initial={{ opacity: 0, y: -28, rotate: -5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ ...spring.settle, opacity: { duration: 0.18 } }}
    >
      {/* Category tab, like a divider in a card box */}
      <div
        className="absolute left-4 top-0 z-0 flex h-9 items-center gap-1.5 rounded-t-[10px] border-[1.5px] border-b-0 border-ink px-3 text-p-note font-bold uppercase tracking-[0.14em] text-ink"
        style={{ background: SKY }}
      >
        <Icon className="h-4 w-4" strokeWidth={2.4} /> {view.category}
      </div>

      <div className="relative h-64" style={{ perspective: 1100 }}>
        {/* The rest of the deck */}
        {Array.from({ length: under }, (_, i) => (
          <div
            key={i}
            aria-hidden
            className="absolute inset-0 rounded-soft border-[1.5px] border-ink bg-paper"
            style={{ transform: `translate(${(under - i) * 3}px, ${(under - i) * 4}px) rotate(${(i % 2 ? -1 : 1) * (under - i) * 0.5}deg)` }}
          />
        ))}

        {reduce ? (
          <div className="relative h-full">
            <div className={`${face} bg-paper transition-opacity duration-200`} style={{ opacity: flipped ? 0 : 1 }} aria-hidden={flipped}>
              <Front view={view} />
            </div>
            <div className={`${face} transition-opacity duration-200`} style={{ background: SKY, opacity: flipped ? 1 : 0 }} aria-hidden={!flipped}>
              <Back view={view} />
            </div>
          </div>
        ) : (
          <motion.div
            className="relative h-full"
            style={{ transformStyle: "preserve-3d" }}
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: dur.reveal, ease: ease.out }}
          >
            <div className={`${face} bg-paper`} style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", boxShadow: "2px 2px 0 0 var(--ink)" }} aria-hidden={flipped}>
              <Front view={view} />
            </div>
            <div
              className={face}
              style={{ background: SKY, transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", boxShadow: "2px 2px 0 0 var(--ink)" }}
              aria-hidden={!flipped}
            >
              <Back view={view} />
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function Front({ view }: { view: Pub }) {
  return (
    <>
      {/* Printed frame, like a card from a boxed set */}
      <span aria-hidden className="pointer-events-none absolute inset-2 rounded-[9px] border-[1.5px]" style={{ borderColor: SKY }} />
      <span className="absolute left-5 top-3.5 font-display text-p-body font-extrabold tabular-nums" style={{ color: SKY_DEEP }} aria-hidden>
        {view.idx + 1}
      </span>
      <span className="absolute bottom-3.5 right-5 rotate-180 font-display text-p-body font-extrabold tabular-nums" style={{ color: SKY_DEEP }} aria-hidden>
        {view.idx + 1}
      </span>
      {/* The puzzle itself: the only emojis in the app. */}
      <div role="img" aria-label={`Emoji puzzle: ${view.emojis}`} className="leading-[1.15] tracking-[0.08em]" style={{ fontSize: emojiSize(view.emojis) }}>
        {view.emojis}
      </div>
    </>
  );
}

function Back({ view }: { view: Pub }) {
  return (
    <>
      <div className="text-p-note font-bold uppercase tracking-[0.18em]" style={{ color: SKY_DEEP }}>
        Jawab
      </div>
      <div className="font-display mt-1 text-p-show font-extrabold text-balance text-ink">{view.answer ?? ""}</div>
      <div className="mt-3 text-[1.6rem] leading-none tracking-[0.08em] opacity-90" aria-hidden>
        {view.emojis}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Hint: a sticky note                                                  */
/* ------------------------------------------------------------------ */

function HintNote({ hint }: { hint: string }) {
  return (
    <motion.div
      className="cut relative z-10 -mt-4 ml-auto mr-2 flex w-[78%] items-start gap-2 rounded-cut px-3 py-2.5 text-ink"
      style={{ background: NOTE }}
      initial={{ opacity: 0, y: -18, rotate: 8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, rotate: 1.5, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: dur.screenExit, ease: ease.in } }}
      transition={spring.settle}
    >
      <Lightbulb className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2.4} />
      <div className="leading-tight">
        <div className="text-p-note font-bold uppercase tracking-[0.14em]">Hint</div>
        <div className="text-p-lead font-semibold">{hint}</div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Answering: a strip of ruled paper                                    */
/* ------------------------------------------------------------------ */

function AnswerStrip({
  category,
  tries,
  got,
  points,
  onSubmit,
}: {
  category: string;
  tries: number;
  got: boolean;
  points: number;
  onSubmit: (t: string) => void;
}) {
  const [value, setValue] = useState("");
  const [last, setLast] = useState("");
  const inputId = useId();
  const msgId = useId();
  const wrong = tries > 0 && !got;

  if (got) {
    return (
      <motion.div className="cut paper-rule relative mt-2 flex min-h-16 items-center rounded-cut bg-paper pl-4 pr-3" initial={{ scale: 0.98 }} animate={{ scale: 1 }} transition={spring.select}>
        <span className="min-w-0 flex-1 truncate font-display text-p-title font-extrabold">{last || "Sahi!"}</span>
        <motion.span className="absolute -top-5 right-12 z-10" initial={{ opacity: 0, scale: 2, rotate: -2 }} animate={{ opacity: 1, scale: 1, rotate: -6 }} transition={{ ...spring.settle, delay: 0.08 }}>
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
          Your answer. {ASK[category] ?? "What is it?"}
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
            maxLength={60}
            placeholder={ASK[category] ?? "Kya hai yeh?"}
            aria-describedby={wrong ? msgId : undefined}
            className="font-display h-full w-full bg-transparent px-4 text-p-title font-extrabold outline-none placeholder:font-semibold placeholder:text-ink/35"
          />
        </div>
        <PaperButton type="submit" tone="me" aria-label="Send answer" className="!min-h-16 w-16 shrink-0 !px-0">
          <Send className="h-6 w-6" strokeWidth={2.4} />
        </PaperButton>
      </form>
      <p id={msgId} role="status" className={`mt-2 min-h-6 text-p-body font-semibold ${wrong ? "text-vermilion" : "text-muted"}`}>
        {wrong ? (
          <>
            Nahi yaar, try again{last ? <span className="font-normal text-muted"> — “{last}” nahi hai</span> : null}
          </>
        ) : (
          "Spelling thodi galat ho toh bhi chalega."
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Who has solved it                                                    */
/* ------------------------------------------------------------------ */

function Solvers({ view, players, me, reveal }: { view: Pub; players: Player[]; me: Player; reveal: boolean }) {
  const inGame = players.filter((p) => p.id in view.scores && (p.connected || view.correct.includes(p.id)));
  const solved = view.correct.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => !!p);
  const thinking = inGame.filter((p) => !view.correct.includes(p.id));
  return (
    <section aria-label="Who has solved it">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-p-note font-semibold uppercase tracking-[0.14em] text-muted">{reveal ? "Kisne bujha" : "Kaun bujh chuke"}</h3>
        <span className="text-p-note font-bold tabular-nums">
          {solved.length}/{inGame.length} solved
        </span>
      </div>
      <ul className="flex min-h-[4.5rem] flex-wrap gap-x-3 gap-y-2">
        {solved.map((p, i) => (
          <motion.li
            key={p.id}
            className="flex w-14 flex-col items-center"
            initial={{ opacity: 0, y: -16, scale: 0.5, rotate: -14 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            transition={spring.settle}
          >
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
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Scores                                                               */
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

/** Paper crown for first place. */
function Crown() {
  return (
    <svg aria-hidden width="38" height="24" viewBox="0 0 38 24">
      <path d="M3 21 L1 6 L11 13 L19 2 L27 13 L37 6 L35 21 Z" fill="#f2b632" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="19" cy="15" r="2" fill="var(--vermilion)" stroke="var(--ink)" strokeWidth="1" />
    </svg>
  );
}

/** Final podium: third, then second, then first rise in turn. */
function Podium({ rows, meId }: { rows: { p: Player; s: number }[]; meId: string }) {
  const top = rows.slice(0, 3);
  // Display order: 2nd, 1st, 3rd. Rise order: 3rd, 2nd, 1st.
  const slots = [
    { r: top[1], place: 2, h: 92, delay: 0.75, bg: "var(--paper)" },
    { r: top[0], place: 1, h: 128, delay: 1.3, bg: SKY },
    { r: top[2], place: 3, h: 64, delay: 0.2, bg: "var(--paper)" },
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
  // The headline only names the winner once first place has risen.
  const [announced, setAnnounced] = useState(false);
  const winnerColor = winner ? playerColor(winner.p.avatar) : SKY;
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
        <div className="text-p-note font-bold uppercase tracking-[0.2em]" style={{ color: SKY_DEEP }}>
          Saare cards khatam
        </div>
        <div className="relative mt-1 min-h-[5.75rem]">
          <AnimatePresence mode="wait" initial={false}>
            {announced ? (
              <motion.div key="winner" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.screen, ease: ease.out }}>
                <h2 className="text-p-show font-extrabold text-balance">{iWon ? "Aap jeet gaye!" : winner ? `${winner.p.name} jeet gaye!` : "Khel khatam!"}</h2>
                <p className="mt-1 text-p-lead text-muted">
                  {myPlace > 0 ? (iWon ? `Shabash! ${view.scores[me.id] ?? 0} points.` : `Aap #${myPlace} rahe — ${view.scores[me.id] ?? 0} points.`) : "Thanks for watching."}
                </p>
              </motion.div>
            ) : (
              <motion.h2 key="wait" className="text-p-show font-extrabold" exit={{ opacity: 0, y: -8, transition: { duration: dur.screenExit, ease: ease.in } }}>
                Aur jeeta kaun…?
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

export function Phone({ view, me, players, send, now, isHost, hostAct }: PhoneProps<Pub, undefined>) {
  const { shared, mine } = useSfx();
  const [showScores, setShowScores] = useState(false);
  const score = view.scores[me.id] ?? 0;
  const myRank = view.correct.indexOf(me.id);
  const got = myRank >= 0;
  const tries = view.tries[me.id] ?? 0;
  const question = view.phase === "question";
  const secsLeft = question ? Math.ceil(Math.max(0, view.deadline - now) / 1000) : -1;
  const showHint = question && now >= view.hintAt;
  const nextIn = view.phase === "reveal" && view.revealUntil ? Math.max(0, Math.ceil((view.revealUntil - now) / 1000)) : null;
  const last = view.idx + 1 >= view.total;

  useOnChange(view.idx, () => {
    if (view.phase === "question") shared("whoosh");
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
  useOnChange(showHint, (n) => {
    if (n) shared("pop");
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
        ? `The answer was ${view.answer}. ${got ? `You got it, plus ${pointsFor(myRank)}.` : "You did not get this one."}`
        : got
          ? `Correct! Plus ${pointsFor(myRank)} points.`
          : "";

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
          <motion.div key="play" {...screenIn} className="space-y-4">
            <TopBar idx={view.idx} total={view.total} score={score} onScores={() => setShowScores(true)} />

            {/* Fixed-height slot so the card doesn't jump between question and answer. */}
            <div className="h-7">
              {question ? (
                <TimeStrip deadline={view.deadline} seconds={view.seconds} now={now} />
              ) : (
                <p className="flex h-full items-center justify-between text-p-body font-semibold text-muted">
                  <span className={got ? "font-bold text-leaf" : ""}>{got ? `Shabash! +${pointsFor(myRank)}` : view.correct.length ? "Is baar nahi. Agla aapka!" : "Kisi ne nahi bujha!"}</span>
                  {nextIn !== null && <span className="tabular-nums">{last ? "Result" : "Agla card"} · {nextIn}s</span>}
                </p>
              )}
            </div>

            <div className="pb-2">
              <FlashCard key={view.idx} view={view} />
              <AnimatePresence>{showHint && !got && <HintNote key="hint" hint={view.hint} />}</AnimatePresence>
            </div>

            {question && <AnswerStrip key={view.idx} category={view.category} tries={tries} got={got} points={pointsFor(myRank)} onSubmit={(t) => send("answer", t)} />}
            {question && got && <p className="-mt-1 text-p-body font-semibold text-muted">Shh… baaki log abhi soch rahe hain.</p>}

            <Solvers view={view} players={players} me={me} reveal={!question} />

            {isHost && (
              <section aria-label="Host controls" className="mt-2 border-t-[1.5px] border-dashed border-ink/40 pt-3">
                <h3 className="mb-2 text-p-note font-semibold uppercase tracking-[0.14em] text-muted">Host ke controls</h3>
                {question ? (
                  <PaperButton tone="paper" className="w-full" onClick={() => hostAct("reveal")}>
                    <Eye className="h-4 w-4" strokeWidth={2.4} /> Jawab dikhao
                  </PaperButton>
                ) : (
                  <PaperButton className="w-full" onClick={() => hostAct("next")}>
                    <SkipForward className="h-4 w-4" strokeWidth={2.4} /> {last ? "Result dikhao" : "Agla card"}
                  </PaperButton>
                )}
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
