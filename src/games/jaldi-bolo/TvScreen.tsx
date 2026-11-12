"use client";
import { Check } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { dur, ease, spring, staggerDelay } from "@/components/paper/motion";
import { InkDefs } from "@/components/paper/objects";
import { CountUp, Sticker } from "@/components/paper/Paper";
import { TvFrame, TvLeaderboard, TvTimer, tv, useTvScale } from "@/components/paper/tv-c";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import type { Player, ScreenProps } from "@/lib/types";
import { BLUE_INK, COVER, Crown, LetterStamp, NotebookPage, PAGE, RED_PEN, RULE, ranked } from "./PaperPhone";
import { CATEGORIES, startsWithLetter, type Pub } from "./shared";

/** Writing: the stamped letter, the five lines (labels only), and who has finished. */
function Writing({ view, players, now }: { view: Pub; players: Player[]; now: number }) {
  const k = useTvScale();
  const shuffling = now < view.revealAt;
  const people = view.participants.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => !!p);
  const online = people.filter((p) => p.connected);
  const doneCount = online.filter((p) => view.done.includes(p.id)).length;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[clamp(0.6rem,1.8vh,1.25rem)]">
      <div className="flex min-h-0 flex-1 items-stretch gap-[clamp(1rem,2.5vw,2.5rem)]">
        <div className="flex w-[clamp(11rem,22vw,22rem)] shrink-0 flex-col items-center justify-center gap-[clamp(0.5rem,1.5vh,1rem)]">
          <div className={tv.label}>
            Akshar {view.round} / {view.rounds}
          </div>
          <LetterStamp letter={view.letter} shuffling={shuffling} now={now} size={Math.round(300 * k)} />
          <div className={`${tv.lead} text-center font-semibold`}>{shuffling ? "Agla akshar aa raha hai…" : `Sab “${view.letter}” se shuru!`}</div>
        </div>
        <NotebookPage className="flex min-h-0 flex-1 flex-col justify-center py-[clamp(0.5rem,1.5vh,1rem)] pl-[3.4rem] pr-[clamp(1rem,2vw,2rem)]">
          {CATEGORIES.map((c, i) => (
            <div key={c.id} className="flex min-h-0 flex-1 items-end gap-4 pb-[clamp(0.25rem,0.8vh,0.6rem)]" style={{ borderBottom: `1.5px solid ${RULE}` }}>
              <span className="font-display w-[1.4ch] shrink-0 text-[clamp(1.1rem,2.8vh,2rem)] font-extrabold text-ink/35">{i + 1}</span>
              <span className="font-display text-[clamp(1.5rem,4.4vh,3.25rem)] font-extrabold leading-none">{c.desi}</span>
              <span className="text-[clamp(1rem,2.4vh,1.6rem)] text-muted">{c.label}</span>
              <span className="ml-auto font-display text-[clamp(1.5rem,4.4vh,3.25rem)] font-extrabold leading-none" style={{ color: BLUE_INK, opacity: shuffling ? 0.15 : 0.55 }}>
                {shuffling ? "…" : `${view.letter}…`}
              </span>
            </div>
          ))}
        </NotebookPage>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-[clamp(1rem,2vw,2rem)]">
        <TvTimer deadline={shuffling ? view.revealAt + view.seconds * 1000 : view.deadline} total={view.seconds * 1000} now={Math.max(now, view.revealAt)} label="Likhne ka time" compact />
        <div className="flex items-center gap-3">
          <span className="font-display text-[clamp(1.4rem,3.6vh,2.5rem)] font-extrabold">
            {doneCount}/{online.length}
          </span>
          <span className={`${tv.lead} text-muted`}>ne likh liya</span>
        </div>
      </div>
      <ul className="flex flex-wrap items-center gap-x-[clamp(0.6rem,1.2vw,1.2rem)] gap-y-2">
        {people.map((p, i) => {
          const done = view.done.includes(p.id);
          return (
            <motion.li
              key={p.id}
              className={`flex items-center gap-2 rounded-full border-[1.5px] py-0.5 pl-0.5 pr-3 ${done ? "border-ink bg-paper" : "border-dashed border-ink/30"} ${p.connected ? "" : "opacity-40"}`}
              initial={false}
              animate={{ scale: done ? 1 : 0.97 }}
              transition={{ ...spring.select, delay: staggerDelay(i, 0) }}
            >
              <Sticker id={p.avatar} size={Math.round(40 * k)} />
              <span className="text-[clamp(0.95rem,2.2vh,1.45rem)] font-bold">{p.name}</span>
              {done ? <Check className="h-[1.2em] w-[1.2em] text-leaf" strokeWidth={3} /> : <span className="text-muted">likh rahe hain…</span>}
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

/** Review: everyone's page side by side, marked in red; strikes show live. */
function Review({ view, players }: { view: Pub; players: Player[] }) {
  const k = useTvScale();
  const people = view.participants.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => !!p);
  const roundTotal = (id: string) => (view.points[id] ?? []).reduce((a, b) => a + b, 0);
  const rows = people.map((p) => ({ p, round: roundTotal(p.id), total: (view.scores[p.id] ?? 0) + roundTotal(p.id) })).sort((a, b) => b.total - a.total);
  const many = rows.length > 6;
  const shown = rows.slice(0, 10);
  const few = rows.length <= 4;
  const cell = many ? "text-[clamp(0.85rem,2vh,1.35rem)]" : few ? "text-[clamp(1.15rem,3.1vh,2.2rem)]" : "text-[clamp(1rem,2.6vh,1.85rem)]";
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[clamp(0.5rem,1.5vh,1rem)]">
      <div className="flex items-end justify-between gap-6">
        <div className="flex items-center gap-[clamp(0.75rem,1.5vw,1.5rem)] pl-2 pt-2">
          <LetterStamp letter={view.letter} shuffling={false} now={0} size={Math.round(110 * k)} />
          <div>
            <div className={tv.label}>
              Akshar {view.round} / {view.rounds} · copy check
            </div>
            <h2 className={tv.title}>Kisne kya likha?</h2>
          </div>
        </div>
        <p className="max-w-[26rem] text-right text-[clamp(0.9rem,2vh,1.3rem)] text-muted">
          <b style={{ color: RED_PEN }}>10</b> anokha · <b style={{ color: RED_PEN }}>5</b> kisi aur ne bhi · <b>0</b> galat ya kaata gaya
        </p>
      </div>
      <NotebookPage className="min-h-0 flex-1 overflow-hidden">
        <table className="h-full w-full table-fixed border-collapse">
          <thead>
            <tr className="text-left">
              <th className={`${tv.label} w-[18%] py-[clamp(0.3rem,1vh,0.6rem)] pl-[3.4rem]`}>Kaun</th>
              {CATEGORIES.map((c) => (
                <th key={c.id} className={`${tv.label} px-2`}>
                  {c.desi}
                </th>
              ))}
              <th className={`${tv.label} w-[11%] pr-4 text-right`}>Kul</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ p, round, total }, r) => (
              <motion.tr key={p.id} layout transition={spring.select} style={{ borderTop: `1.5px solid ${RULE}` }} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: staggerDelay(r) } }}>
                <td className="py-[clamp(0.15rem,0.7vh,0.5rem)] pl-[3.4rem] pr-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <Sticker id={p.avatar} size={Math.round((many ? 32 : 44) * k)} />
                    <span className={`min-w-0 truncate font-bold ${cell}`}>{p.name}</span>
                  </span>
                </td>
                {CATEGORIES.map((c, i) => {
                  const answer = view.answers[p.id]?.[i] ?? "";
                  const pts = view.points[p.id]?.[i] ?? 0;
                  const blank = !answer.trim();
                  const struck = view.struck.includes(`${p.id}:${i}`);
                  const wrong = !blank && !startsWithLetter(answer, view.letter);
                  return (
                    <td key={c.id} className="px-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="relative min-w-0">
                          <span className={`font-display block truncate font-bold ${cell}`} style={{ color: blank ? "rgba(30,26,23,0.25)" : BLUE_INK }}>
                            {blank ? "—" : answer}
                          </span>
                          <motion.span
                            aria-hidden
                            className="absolute left-[-2px] right-[-2px] top-1/2 h-[3px] origin-left rounded-full"
                            style={{ background: RED_PEN, rotate: "-3deg" }}
                            initial={false}
                            animate={{ scaleX: struck || wrong ? 1 : 0 }}
                            transition={{ duration: struck ? 0.28 : 0.16, ease: struck ? ease.out : ease.in }}
                          />
                        </span>
                        {!blank && (
                          <span
                            className="font-display ml-auto flex shrink-0 items-center justify-center rounded-full font-extrabold tabular-nums"
                            style={{
                              width: "1.9em",
                              height: "1.9em",
                              fontSize: many ? "clamp(0.7rem,1.6vh,1rem)" : "clamp(0.8rem,2vh,1.25rem)",
                              color: pts ? RED_PEN : "rgba(30,26,23,0.35)",
                              border: `2px solid ${pts ? RED_PEN : "rgba(30,26,23,0.2)"}`,
                              transform: "rotate(-8deg)",
                            }}
                          >
                            {pts}
                          </span>
                        )}
                      </span>
                    </td>
                  );
                })}
                <td className="pr-4 text-right">
                  <span className={`font-display font-extrabold tabular-nums ${many ? "text-[clamp(1.1rem,2.6vh,1.8rem)]" : "text-[clamp(1.4rem,3.6vh,2.6rem)]"}`}>
                    <CountUp from={total - round} to={total} delay={0.5} />
                  </span>
                  {round > 0 && <span className="ml-1 text-[clamp(0.75rem,1.6vh,1.05rem)] font-bold text-leaf">+{round}</span>}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </NotebookPage>
      {rows.length > shown.length && <div className="text-[clamp(0.9rem,2vh,1.2rem)] text-muted">+{rows.length - shown.length} aur — sabke points phone pe</div>}
    </div>
  );
}

/** Final: a tall paper podium, then everyone else. */
function Final({ view, players }: { view: Pub; players: Player[] }) {
  const k = useTvScale();
  const rows = ranked(players, view.scores);
  const top = rows.slice(0, 3);
  const tie = rows.length > 1 && rows[0].s === rows[1].s;
  const slots = [
    { r: top[1], place: 2, h: 0.55, delay: 0.75, bg: PAGE },
    { r: top[0], place: 1, h: 0.8, delay: 1.3, bg: COVER },
    { r: top[2], place: 3, h: 0.38, delay: 0.2, bg: PAGE },
  ];
  return (
    <div className="flex min-h-0 flex-1 gap-[clamp(1rem,3vw,3rem)]">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="text-center">
          <div className={tv.label}>Saare akshar khatam</div>
          <motion.h2 className={tv.headline} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 1.6, duration: dur.screen } }}>
            {tie ? "Barabar ki takkar!" : `${top[0]?.p.name ?? "Koi"} topper!`}
          </motion.h2>
        </div>
        <div className="flex min-h-0 flex-1 items-end justify-center gap-[clamp(0.75rem,2vw,2rem)] border-b-[2px] border-ink px-4">
          {slots.map(({ r, place, h, delay, bg }) =>
            r ? (
              <motion.div
                key={r.p.id}
                className="flex h-full w-[min(30%,15rem)] flex-col items-center justify-end"
                initial={{ y: 400, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ y: { ...spring.settle, delay }, opacity: { duration: 0.15, delay } }}
              >
                {place === 1 && <Crown />}
                <Sticker id={r.p.avatar} size={Math.round((place === 1 ? 110 : 84) * k)} tilt={place === 1 ? -5 : place === 2 ? 4 : -3} />
                <div className="mt-1 w-full truncate text-center text-[clamp(1.1rem,2.8vh,2rem)] font-bold">{r.p.name}</div>
                <div
                  className="mt-2 flex w-full flex-col items-center rounded-t-cut border-[2px] border-b-0 border-ink pt-2"
                  style={{ height: `${h * 72}%`, background: `repeating-linear-gradient(to bottom, ${bg} 0 22px, ${RULE} 22px 23px), ${bg}`, boxShadow: "3px 0 0 0 var(--ink)" }}
                >
                  <CountUp from={0} to={r.s} delay={delay + 0.2} className="font-display text-[clamp(2rem,6vh,4.5rem)] font-extrabold leading-none" />
                  <span className={tv.label}>{place === 1 ? "1st" : place === 2 ? "2nd" : "3rd"}</span>
                </div>
              </motion.div>
            ) : (
              <div key={place} className="w-[min(30%,15rem)]" />
            ),
          )}
        </div>
      </div>
      {rows.length > 3 && (
        <div className="flex w-[clamp(16rem,24vw,26rem)] min-h-0 flex-col">
          <TvLeaderboard players={players} scores={view.scores} ids={rows.slice(3).map((r) => r.p.id)} title="Baaki sab" maxRows={9} />
        </div>
      )}
    </div>
  );
}

/** Big-screen view. Answers appear only once writing is over. */
export function Screen({ view, players, now }: ScreenProps<Pub>) {
  const sfx = useSfx();
  useOnChange(view.phase, (p) => {
    if (p === "review") sfx.shared("reveal");
    if (p === "final") sfx.shared("fanfare");
  });
  const main =
    view.phase === "answering" ? (
      <TvFrame side={<TvLeaderboard players={players} scores={view.scores} ids={view.participants} title="Ab tak ke points" maxRows={9} />}>
        <Writing view={view} players={players} now={now} />
      </TvFrame>
    ) : view.phase === "review" ? (
      <TvFrame>
        <Review view={view} players={players} />
      </TvFrame>
    ) : (
      <TvFrame>
        <Final view={view} players={players} />
      </TvFrame>
    );
  return (
    <MotionConfig reducedMotion="user">
      <InkDefs />
      <div className="sr-only" aria-live="polite">
        {view.phase === "answering" ? `Akshar ${view.letter}` : view.phase === "review" ? "Copy check" : "Final result"}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${view.round}-${view.phase}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { duration: dur.screen, ease: ease.out } }}
          exit={{ opacity: 0, y: -8, transition: { duration: dur.screenExit, ease: ease.in } }}
        >
          {main}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}

