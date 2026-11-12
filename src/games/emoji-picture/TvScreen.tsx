"use client";
/** Emoji Picture on the big screen: the flash card, the clock, who has solved it, points. The answer shows only on the reveal. */
import { Eye, Film, Lightbulb, MapPin, Music, Quote, SkipForward, Sparkles, Trophy, Tv, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PaperButton, Sticker } from "@/components/paper/Paper";
import { dur, ease, spring } from "@/components/paper/motion";
import { TvBoard, TvLabel, TvPodium, TvStage, TvTimer, rankRows, tv } from "@/components/paper/tv-a";
import type { Player, ScreenProps } from "@/lib/types";
import { POINTS, type Pub } from "./shared";

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

function emojiSize(emojis: string) {
  const n = [...emojis.replace(/\s/g, "")].length;
  return n <= 3 ? "min(22vh, 11vw)" : n <= 4 ? "min(18vh, 9vw)" : n <= 6 ? "min(13vh, 6.5vw)" : "min(10vh, 5vw)";
}

function pointsFor(rank: number) {
  return POINTS[rank] ?? 1;
}

/** The flash card, flipping to the answer on the reveal (a crossfade with reduced motion). */
function BigCard({ view }: { view: Pub }) {
  const reduce = useReducedMotion();
  const flipped = view.phase === "reveal";
  const Icon = CATEGORY_ICON[view.category] ?? Sparkles;
  const under = Math.min(3, view.total - view.idx - 1);
  const face = "absolute inset-0 flex flex-col items-center justify-center rounded-soft border-[2px] border-ink px-[3vw] text-center";
  const front = (
    <>
      <span aria-hidden className="pointer-events-none absolute inset-[1.4vh] rounded-[12px] border-[2px]" style={{ borderColor: SKY }} />
      <span className={`font-display absolute left-[2vw] top-[2vh] font-extrabold tabular-nums ${tv.lead}`} style={{ color: SKY_DEEP }} aria-hidden>
        {view.idx + 1}
      </span>
      <div role="img" aria-label={`Emoji puzzle: ${view.emojis}`} className="leading-[1.1] tracking-[0.06em]" style={{ fontSize: emojiSize(view.emojis) }}>
        {view.emojis}
      </div>
    </>
  );
  const back = (
    <>
      <div className={`${tv.label}`} style={{ color: SKY_DEEP }}>
        Jawab
      </div>
      <div className={`font-display mt-[1vh] font-extrabold text-balance text-ink ${tv.hero}`}>{view.answer ?? ""}</div>
      <div className="mt-[2vh] leading-none tracking-[0.08em] opacity-90" style={{ fontSize: "5vh" }} aria-hidden>
        {view.emojis}
      </div>
    </>
  );
  return (
    <motion.div
      key={view.idx}
      className="relative flex h-full min-h-0 flex-col pt-[5vh]"
      initial={{ opacity: 0, y: -40, rotate: -4 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ ...spring.settle, opacity: { duration: 0.18 } }}
    >
      <div
        className={`absolute left-[2vw] top-0 z-0 flex h-[5.2vh] items-center gap-2 rounded-t-[12px] border-[2px] border-b-0 border-ink px-[1.2vw] font-bold uppercase tracking-[0.14em] text-ink ${tv.body}`}
        style={{ background: SKY }}
      >
        <Icon className="h-[1em] w-[1em]" strokeWidth={2.4} /> {view.category}
      </div>
      <div className="relative min-h-0 flex-1" style={{ perspective: 1600 }}>
        {Array.from({ length: under }, (_, i) => (
          <div
            key={i}
            aria-hidden
            className="absolute inset-0 rounded-soft border-[2px] border-ink bg-paper"
            style={{ transform: `translate(${(under - i) * 5}px, ${(under - i) * 6}px) rotate(${(i % 2 ? -1 : 1) * (under - i) * 0.5}deg)` }}
          />
        ))}
        {reduce ? (
          <div className="relative h-full">
            <div className={`${face} bg-paper transition-opacity duration-200`} style={{ opacity: flipped ? 0 : 1 }} aria-hidden={flipped}>
              {front}
            </div>
            <div className={`${face} transition-opacity duration-200`} style={{ background: SKY, opacity: flipped ? 1 : 0 }} aria-hidden={!flipped}>
              {back}
            </div>
          </div>
        ) : (
          <motion.div className="relative h-full" style={{ transformStyle: "preserve-3d" }} animate={{ rotateY: flipped ? 180 : 0 }} transition={{ duration: dur.reveal, ease: ease.out }}>
            <div className={`${face} bg-paper`} style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", boxShadow: "4px 4px 0 0 var(--ink)" }} aria-hidden={flipped}>
              {front}
            </div>
            <div
              className={face}
              style={{ background: SKY, transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", boxShadow: "4px 4px 0 0 var(--ink)" }}
              aria-hidden={!flipped}
            >
              {back}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function HintNote({ hint }: { hint: string }) {
  return (
    <motion.div
      className="cut absolute -right-[1vw] bottom-[4vh] z-10 flex w-[44%] items-start gap-[0.8vw] rounded-cut px-[1.2vw] py-[1.4vh] text-ink"
      style={{ background: NOTE }}
      initial={{ opacity: 0, y: -24, rotate: 9, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, rotate: 2, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: dur.screenExit, ease: ease.in } }}
      transition={spring.settle}
    >
      <Lightbulb className="mt-[0.3vh] h-[3vh] w-[3vh] shrink-0" strokeWidth={2.4} />
      <div className="leading-tight">
        <TvLabel className="!text-ink/70">Hint</TvLabel>
        <div className={`font-semibold ${tv.lead}`}>{hint}</div>
      </div>
    </motion.div>
  );
}

function Solvers({ view, players }: { view: Pub; players: Player[] }) {
  const reveal = view.phase === "reveal";
  const solved = view.correct.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  const waiting = players.filter((p) => p.id in view.scores && !view.correct.includes(p.id));
  return (
    <div className="min-h-0">
      <div className="flex items-baseline justify-between gap-3">
        <TvLabel>{reveal ? "Kisne bujha" : "Kaun bujh chuke"}</TvLabel>
        <span className={`font-display font-extrabold tabular-nums ${tv.lead}`}>
          {solved.length}/{solved.length + waiting.length}
        </span>
      </div>
      <ul className="mt-[1.2vh] flex flex-wrap gap-x-[1.2vw] gap-y-[1.4vh]">
        <AnimatePresence initial={false}>
          {solved.map((p, i) => (
            <motion.li
              key={p.id}
              layout
              className="relative flex flex-col items-center"
              initial={{ y: -30, scale: 0.6, rotate: -14, opacity: 0 }}
              animate={{ y: 0, scale: 1, rotate: i % 2 ? 4 : -4, opacity: 1 }}
              transition={spring.settle}
            >
              <Sticker id={p.avatar} size={64} />
              <span className={`mt-[0.4vh] max-w-[8vw] truncate font-bold ${tv.body}`}>{p.name}</span>
              <span
                className={`font-display absolute -right-2 -top-2 rounded-cut border-[1.5px] border-ink bg-leaf px-1.5 font-extrabold text-paper ${tv.body}`}
                style={{ fontSize: "0.8em" }}
              >
                +{pointsFor(i)}
              </span>
            </motion.li>
          ))}
          {!reveal &&
            waiting.map((p) => (
              <motion.li key={p.id} layout className="flex flex-col items-center opacity-55">
                <span className="breathe inline-block rounded-full border-[2px] border-dashed border-ink/40 p-1">
                  <Sticker id={p.avatar} size={54} />
                </span>
                <span className={`mt-[0.4vh] max-w-[8vw] truncate font-semibold ${tv.body}`}>{p.name}</span>
              </motion.li>
            ))}
        </AnimatePresence>
      </ul>
      {reveal && !solved.length && <p className={`mt-[1vh] text-ink/60 ${tv.lead}`}>Is baar koi nahi bujh paaya!</p>}
    </div>
  );
}

function Results({ view, players }: { view: Pub; players: Player[] }) {
  const rows = rankRows(players, view.scores);
  const top = rows[0];
  const tie = rows.length > 1 && rows[0].s === rows[1].s && rows[0].s > 0;
  return (
    <div className="grid min-h-0 grid-cols-[1.35fr_1fr] gap-[2.4vw]">
      <div className="grid min-h-0 grid-rows-[auto_1fr] gap-[2vh]">
        <div>
          <TvLabel>Saare cards khatam</TvLabel>
          <motion.h2
            className={`font-display font-extrabold ${tv.title}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.9, duration: dur.screen }}
          >
            {!top || top.s === 0 ? "Khel khatam!" : tie ? "Barabar ki takkar!" : `${top.p.name} jeet gaye!`}
          </motion.h2>
        </div>
        <TvPodium rows={rows} color={SKY} className="h-[88%] min-h-0 self-end" />
      </div>
      <TvBoard rows={rows} size={rows.length <= 6 ? "lg" : "md"} max={10} className="min-h-0" />
    </div>
  );
}

export function TvScreen({ view, players, act, now, spectator }: ScreenProps<Pub>) {
  const showHint = view.phase === "question" && now >= view.hintAt && !!view.hint;
  const nextIn = view.revealUntil ? Math.max(0, Math.ceil((view.revealUntil - now) / 1000)) : null;
  return (
    <TvStage className={spectator ? "grid-rows-[1fr]" : "grid-rows-[1fr_auto]"}>
      {view.phase === "over" ? (
        <Results view={view} players={players} />
      ) : (
        <div className="grid min-h-0 grid-cols-[1.35fr_1fr] gap-[2.6vw]">
          <div className="relative min-h-0 pb-[1vh]">
            <BigCard view={view} />
            <AnimatePresence>{showHint && <HintNote key={`h${view.idx}`} hint={view.hint} />}</AnimatePresence>
          </div>
          <div className="grid min-h-0 grid-rows-[auto_auto_1fr] gap-[2.6vh]">
            <div className="flex items-baseline justify-between">
              <TvLabel>
                Card {view.idx + 1} / {view.total}
              </TvLabel>
              {view.phase === "reveal" && nextIn !== null && <span className={`font-semibold text-ink/60 ${tv.body}`}>Agla card · {nextIn}s</span>}
            </div>
            {view.phase === "question" ? (
              <TvTimer deadline={view.deadline} total={view.seconds * 1000} now={now} label="Samay" color={SKY} />
            ) : (
              <div className={`font-display font-extrabold ${tv.title}`}>Jawab dekho!</div>
            )}
            <div className="grid min-h-0 grid-rows-[auto_1fr] gap-[2.4vh]">
              <Solvers view={view} players={players} />
              <TvBoard rows={rankRows(players, view.scores)} max={5} className="min-h-0" />
            </div>
          </div>
        </div>
      )}
      {!spectator && view.phase !== "over" && (
        <div className="flex justify-end gap-3">
          {view.phase === "question" ? (
            <PaperButton tone="paper" onClick={() => act("reveal")}>
              <Eye className="h-4 w-4" /> Jawab dikhao
            </PaperButton>
          ) : (
            <PaperButton onClick={() => act("next")}>
              <SkipForward className="h-4 w-4" /> Agla card
            </PaperButton>
          )}
        </div>
      )}
    </TvStage>
  );
}
