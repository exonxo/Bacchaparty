"use client";
import { Check } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { dur, ease, spring, staggerDelay } from "@/components/paper/motion";
import { InkDefs, VerdictSlip } from "@/components/paper/objects";
import { Sticker } from "@/components/paper/Paper";
import { TvCard, TvFrame, TvLeaderboard, TvPeople, TvPerson, TvTimer, tv, useTvScale } from "@/components/paper/tv-c";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import type { Player, ScreenProps } from "@/lib/types";
import { GUESS_SECONDS, revealLine, type Pub } from "./index";
import { SLEEVE } from "./PaperPhone";

const INK = "#1e1a17";
const findP = (players: Player[], id: string | null | undefined) => players.find((p) => p.id === id);

/** A closed sleeve: the object of the game, drawn big. Never shows a word. */
function ClosedSleeve() {
  return (
    <svg viewBox="0 0 320 190" className="h-full w-full overflow-visible" aria-hidden>
      <rect x="6" y="6" width="320" height="190" rx="8" fill={INK} />
      <rect x="0.75" y="0.75" width="318.5" height="188.5" rx="8" fill="#7cc4a6" stroke={INK} strokeWidth="1.5" />
      <rect x="28" y="14" width="264" height="160" rx="4" fill="#fffdf8" stroke={INK} strokeWidth="1.5" />
      <path
        d="M0.75 8A7 7 0 0 1 7.75 0.75H124a36 36 0 0 0 72 0H312.25A7 7 0 0 1 319.25 8V182a7 7 0 0 1-7 7H7.75a7 7 0 0 1-7-7Z"
        fill={SLEEVE}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M16 150H304" stroke={INK} strokeOpacity="0.18" strokeWidth="1.5" strokeDasharray="6 6" />
      <text x="160" y="112" textAnchor="middle" fontSize="20" fontWeight="800" fill={INK} letterSpacing="3" style={{ fontFamily: "var(--font-display)" }}>
        SHABD ANDAR HAI
      </text>
    </svg>
  );
}

/** Clue round: who speaks now, and the order around the room. */
function Clues({ view, players }: { view: Pub; players: Player[] }) {
  const k = useTvScale();
  const speakerId = view.order[view.speaker];
  const speaker = findP(players, speakerId);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[clamp(0.75rem,2.5vh,2rem)]">
      <div className="flex min-h-0 flex-1 items-center gap-[clamp(1.5rem,3vw,3rem)]">
        <div className="min-w-0 flex-1">
          <div className={tv.label}>
            Round {view.round} · clue round {view.clueRound}
          </div>
          <div className={`${tv.title} mt-1 text-muted`}>Ab bolo:</div>
          <AnimatePresence mode="wait">
            <motion.div
              key={speakerId}
              className="mt-[clamp(0.5rem,1.5vh,1rem)] flex min-w-0 items-center gap-[clamp(1rem,2vw,2rem)]"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0, transition: spring.select }}
              exit={{ opacity: 0, x: -16, transition: { duration: dur.screenExit, ease: ease.in } }}
            >
              <Sticker id={speaker?.avatar} size={Math.round(150 * k)} tilt={-4} />
              <span className="font-display min-w-0 truncate text-[clamp(3.5rem,13vh,8.5rem)] font-extrabold leading-none">{speaker?.name ?? "Koi"}</span>
            </motion.div>
          </AnimatePresence>
          <p className={`${tv.lead} mt-[clamp(0.75rem,2vh,1.25rem)] max-w-[40rem] text-muted`}>
            Apne shabd ke baare mein EK shabd. Baaki sab dhyaan se suno — kiska clue alag lag raha hai?
          </p>
        </div>
        <div className="hidden w-[clamp(12rem,22vw,22rem)] shrink-0 lg:block" style={{ aspectRatio: "320 / 190", transform: "rotate(3deg)" }}>
          <ClosedSleeve />
        </div>
      </div>
      <TvCard className="px-[clamp(1rem,2vw,2rem)] py-[clamp(0.6rem,1.6vh,1.2rem)]">
        <div className={tv.label}>Bolne ki baari</div>
        <ol className="mt-2 flex flex-wrap items-center gap-x-[clamp(0.75rem,1.6vw,1.6rem)] gap-y-2">
          {view.order.map((id, i) => {
            const p = findP(players, id);
            const done = i < view.speaker;
            const now = i === view.speaker;
            return (
              <li key={id} className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 ${now ? "bg-turmeric" : ""} ${p?.connected === false ? "opacity-40" : ""}`}>
                <span className="relative">
                  <Sticker id={p?.avatar} size={Math.round(48 * k)} />
                  <span className="absolute -bottom-1 -right-1 flex h-[1.6em] w-[1.6em] items-center justify-center rounded-full border-[1.5px] border-ink bg-paper text-[clamp(0.7rem,1.5vh,1rem)] font-bold">
                    {done ? <Check className="h-[1em] w-[1em]" strokeWidth={3} /> : i + 1}
                  </span>
                </span>
                <span className={`text-[clamp(1rem,2.4vh,1.6rem)] font-bold ${done ? "text-muted" : ""}`}>{p?.name ?? "Koi"}</span>
              </li>
            );
          })}
        </ol>
      </TvCard>
    </div>
  );
}

/** Voting: who has voted, never for whom. */
function Voting({ view, players, now }: { view: Pub; players: Player[]; now: number }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[clamp(1rem,3vh,2.5rem)]">
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <div className={tv.label}>Round {view.round} · voting</div>
          <h2 className={tv.headline}>Odd one kaun?</h2>
          <p className={`${tv.lead} text-muted`}>
            Phone pe vote karo. Votes reveal tak secret — {view.voted.length}/{view.participants.length} ne vote de diya.
          </p>
        </div>
        <div className="w-[clamp(14rem,26vw,24rem)] shrink-0">
          <TvTimer deadline={view.voteDeadline} total={view.voteSeconds * 1000} now={now} label="Vote ka time" />
        </div>
      </div>
      <TvPeople className="min-h-0 flex-1 content-center">
        {view.participants.map((id, i) => {
          const p = findP(players, id);
          const voted = view.voted.includes(id);
          return (
            <motion.div key={id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { ...spring.select, delay: staggerDelay(i) } }}>
              <TvPerson player={p} size={view.participants.length > 8 ? "sm" : view.participants.length > 5 ? "md" : "lg"} status={voted ? "vote de diya ✓" : "soch rahe hain…"} dim={!voted || p?.connected === false} ring={voted} />
            </motion.div>
          );
        })}
      </TvPeople>
    </div>
  );
}

/** The caught Imposter gets one guess at everyone else's word. */
function Guessing({ view, players, now }: { view: Pub; players: Player[]; now: number }) {
  const imp = findP(players, view.accused);
  return (
    <div className="flex min-h-0 flex-1 items-center gap-[clamp(2rem,5vw,5rem)]">
      <div className="flex shrink-0 flex-col items-center gap-4">
        <TvPerson player={imp} size="lg" />
        <motion.div initial={{ scale: 1.7, opacity: 0, rotate: -14 }} animate={{ scale: 1, opacity: 1, rotate: -5, transition: { ...spring.settle, delay: 0.3 } }}>
          <VerdictSlip tone="vermilion" seed={view.round * 3 + 1}>
            Pakde gaye!
          </VerdictSlip>
        </motion.div>
      </div>
      <div className="min-w-0 flex-1">
        <div className={tv.label}>Imposter ka aakhri mauka</div>
        <h2 className={tv.headline}>{imp?.name ?? "Imposter"} asli shabd soch rahe hain…</h2>
        <p className={`${tv.lead} mt-2 text-muted`}>Sahi guess kiya toh round unka. Galat toh baaki sabko +1.</p>
        <div className="mt-[clamp(1rem,3vh,2rem)] max-w-[34rem]">
          <TvTimer deadline={view.guessDeadline} total={GUESS_SECONDS * 1000} now={now} label="Guess ka time" />
        </div>
      </div>
    </div>
  );
}

/** Reveal: both words, the verdict, and who voted for whom. */
function Reveal({ view, players }: { view: Pub; players: Player[] }) {
  const k = useTvScale();
  const r = view.reveal!;
  const imp = findP(players, r.imposterId);
  const verdict = !r.caught ? "Bach nikle!" : r.guessCorrect ? "Chura liya!" : "Pakde gaye!";
  const votes = Object.entries(r.votes);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[clamp(0.75rem,2vh,1.5rem)]">
      <div>
        <div className={tv.label}>Round {view.round} · result</div>
        <h2 className={tv.title}>{revealLine(r, players)}</h2>
      </div>
      <div className="relative grid min-h-0 flex-1 grid-cols-2 items-center gap-[clamp(1rem,3vw,3rem)] px-2 py-3">
        <motion.div
          className="cut flex h-full max-h-[22rem] flex-col items-center justify-center rounded-cut bg-paper px-4 text-center"
          initial={{ opacity: 0, y: 20, rotate: -5 }}
          animate={{ opacity: 1, y: 0, rotate: -1.5, transition: { ...spring.settle, delay: 0.1 } }}
        >
          <div className={tv.label}>Sabka shabd</div>
          <div className="font-display mt-2 text-balance text-[clamp(3.25rem,11vh,7.5rem)] font-extrabold leading-none">{r.majorityWord}</div>
        </motion.div>
        <motion.div
          className="cut relative flex h-full max-h-[22rem] flex-col items-center justify-center rounded-cut px-4 text-center"
          style={{ background: SLEEVE }}
          initial={{ opacity: 0, y: 20, rotate: 5 }}
          animate={{ opacity: 1, y: 0, rotate: 1.5, transition: { ...spring.settle, delay: 0.25 } }}
        >
          <div className="font-bold uppercase tracking-[0.18em] text-[clamp(0.85rem,1.9vh,1.3rem)] text-ink/70">Imposter ka · {imp?.name ?? "Koi"}</div>
          <div className="font-display mt-2 text-balance text-[clamp(3.25rem,11vh,7.5rem)] font-extrabold leading-none">{r.imposterWord}</div>
          <span className="absolute -right-3 -top-5" style={{ transform: "rotate(10deg)" }}>
            <Sticker id={imp?.avatar} size={Math.round(84 * k)} />
          </span>
        </motion.div>
        <motion.div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center"
          initial={{ opacity: 0, scale: 1.6 }}
          animate={{ opacity: 1, scale: 1, transition: { ...spring.settle, delay: 0.6 } }}
        >
          <VerdictSlip tone={r.caught && !r.guessCorrect ? "vermilion" : "ink"} seed={view.round * 5 + 3} tilt={view.round % 2 ? -4 : 3}>
            {verdict}
          </VerdictSlip>
        </motion.div>
      </div>
      {votes.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-x-[clamp(0.5rem,1vw,1rem)] gap-y-2" aria-label="Kisne kisko vote diya">
          {votes.map(([voter, target]) => {
            const v = findP(players, voter);
            const right = target === r.imposterId;
            return (
              <li
                key={voter}
                className={`flex items-center gap-2 rounded-full border-[1.5px] py-0.5 pl-0.5 pr-3 text-[clamp(0.9rem,2.1vh,1.4rem)] font-semibold ${right ? "border-leaf bg-leaf/10" : "border-ink/20 bg-paper"}`}
              >
                <Sticker id={v?.avatar} size={Math.round(36 * k)} />
                {v?.name ?? "Koi"} <span aria-hidden>→</span> <b>{findP(players, target)?.name ?? "Koi"}</b>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Big-screen view: the speaker, secret voting, the Imposter's guess, then the words. */
export function Screen({ view, players, now }: ScreenProps<Pub>) {
  const sfx = useSfx();
  useOnChange(view.phase, (p) => {
    if (p === "reveal") sfx.shared("reveal");
  });
  const main =
    view.phase === "clues" ? (
      <Clues view={view} players={players} />
    ) : view.phase === "vote" ? (
      <Voting view={view} players={players} now={now} />
    ) : view.phase === "imposter-guess" ? (
      <Guessing view={view} players={players} now={now} />
    ) : view.reveal ? (
      <Reveal view={view} players={players} />
    ) : null;
  return (
    <MotionConfig reducedMotion="user">
      <InkDefs />
      <div className="sr-only" aria-live="polite">
        {view.phase === "reveal" && view.reveal ? revealLine(view.reveal, players) : view.phase === "clues" ? `Ab bolo: ${findP(players, view.order[view.speaker])?.name ?? ""}` : ""}
      </div>
      <TvFrame
        side={
          <TvLeaderboard
            players={players}
            scores={view.scores}
            ids={view.participants}
            gains={view.phase === "reveal" ? (view.reveal?.gains ?? undefined) : undefined}
            title="Kul points"
            highlight={view.phase === "clues" ? view.order[view.speaker] : null}
            maxRows={9}
          />
        }
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${view.round}-${view.phase}`}
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: dur.screen, ease: ease.out } }}
            exit={{ opacity: 0, y: -8, transition: { duration: dur.screenExit, ease: ease.in } }}
          >
            {main}
          </motion.div>
        </AnimatePresence>
      </TvFrame>
    </MotionConfig>
  );
}
