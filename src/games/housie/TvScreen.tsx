"use client";
/** Housie on the big screen: the call, the 90-number board, prizes and points. Never shows anyone's ticket. */
import { Pause, Play, SkipForward } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { PaperButton, Sticker } from "@/components/paper/Paper";
import { dur, ease, spring } from "@/components/paper/motion";
import { Stamp, VerdictSlip } from "@/components/paper/objects";
import { TvBoard, TvCard, TvLabel, TvPodium, TvStage, TvTimer, rankRows, tv } from "@/components/paper/tv-a";
import type { Player, ScreenProps } from "@/lib/types";
import { PRIZES, speak } from "./helpers";
import type { Pub } from "./index";

const JAMUN = "#5b2a6e";
const JAMUN_DEEP = "#43204f";
const CREAM = "#fffdf8";

/** The token pulled from the bag, sized in viewport units for the TV. */
function BigToken({ n, size }: { n: number | null; size: string }) {
  return (
    <span
      className="font-display inline-flex shrink-0 items-center justify-center rounded-full border-[2px] border-ink bg-paper font-extrabold tabular-nums text-ink"
      style={{ width: size, height: size, fontSize: `calc(${size} * 0.46)`, boxShadow: `inset 0 0 0 calc(${size} * 0.05) ${CREAM}, inset 0 0 0 calc(${size} * 0.075) ${JAMUN}, 4px 4px 0 0 var(--ink)` }}
    >
      {n ?? "?"}
    </span>
  );
}

function CallColumn({ view, now }: { view: Pub; now: number }) {
  const earlier = view.called.slice(-6, -1).reverse();
  const auto = view.autoCall > 0;
  return (
    <TvCard className="flex flex-col !p-0" style={{ background: JAMUN, color: CREAM }}>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[2.2vh] px-[2vw] py-[2.4vh] text-center">
        <div className={`${tv.label} opacity-80`}>{view.called.length ? `Number ${view.called.length} of 90` : "Taiyaar ho jao"}</div>
        <div className="relative flex h-[30vh] w-[30vh] items-center justify-center">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={view.current ?? "none"}
              className="absolute"
              initial={{ y: "-60%", rotate: -24, opacity: 0 }}
              animate={{ y: 0, rotate: 0, opacity: 1, transition: spring.settle }}
              exit={{ opacity: 0, scale: 0.7, transition: { duration: dur.screenExit, ease: ease.in } }}
            >
              <BigToken n={view.current} size="28vh" />
            </motion.span>
          </AnimatePresence>
        </div>
        <motion.div
          key={view.call ?? "wait"}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur.screen, ease: ease.out }}
          className={`font-display font-extrabold text-balance ${tv.lead}`}
        >
          {view.call ?? (auto ? "Pehla number aa raha hai…" : "Host pehla number bulayenge")}
        </motion.div>
        {earlier.length > 0 && (
          <div className="flex items-center gap-[0.7vw]">
            <span className={`${tv.label} opacity-75`}>Pehle</span>
            {earlier.map((n, i) => (
              <motion.span key={n} layout transition={spring.select} style={{ opacity: 1 - i * 0.13 }}>
                <BigToken n={n} size="5.2vh" />
              </motion.span>
            ))}
          </div>
        )}
      </div>
      {auto && !view.done && (
        <div className="px-[2vw] py-[2vh]" style={{ background: JAMUN_DEEP }}>
          <TvTimer
            deadline={view.nextCallAt}
            total={view.autoCall * 1000}
            now={now}
            label={view.called.length ? "Agla number" : "Pehla number"}
            urgentAt={3}
            paused={view.paused}
            color="#f2b632"
            onDark
          />
        </div>
      )}
    </TvCard>
  );
}

/** All 90 numbers; called ones are inked in, the current one glows turmeric. */
function NumberBoard({ view }: { view: Pub }) {
  const called = new Set(view.called);
  return (
    <TvCard className="flex min-h-0 flex-col !p-[1.6vh]" style={{ background: "var(--paper)" }}>
      <div className="mb-[1vh] flex items-baseline justify-between">
        <TvLabel>Sab numbers</TvLabel>
        <span className={`font-display font-extrabold tabular-nums ${tv.lead}`}>{view.called.length}/90</span>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="grid aspect-[10/9] h-full max-w-full grid-cols-10 gap-[0.5vh]">
          {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => {
            const isCur = n === view.current;
            const isCalled = called.has(n);
            return (
              <motion.div
                key={n}
                initial={false}
                animate={isCur ? { scale: [1.35, 1] } : { scale: 1 }}
                transition={spring.settle}
                className={`font-display flex items-center justify-center rounded-[6px] border-[1.5px] font-extrabold tabular-nums ${
                  isCur ? "border-ink bg-turmeric text-ink" : isCalled ? "border-ink text-[#fffdf8]" : "border-ink/15 text-ink/30"
                }`}
                style={{ background: isCalled && !isCur ? JAMUN : undefined, fontSize: "clamp(0.8rem, 2.6vh, 2.1rem)", boxShadow: isCur ? "2px 2px 0 0 var(--ink)" : undefined }}
              >
                {n}
              </motion.div>
            );
          })}
        </div>
      </div>
    </TvCard>
  );
}

function Prizes({ view, players }: { view: Pub; players: Player[] }) {
  return (
    <div className="flex min-h-0 flex-col">
      <TvLabel className="mb-[1vh]">Inaam</TvLabel>
      <ul className="grid gap-[1vh]">
        {PRIZES.map((p) => {
          const w = view.winners[p.id];
          const wp = players.find((x) => x.id === w?.playerId);
          return (
            <motion.li
              key={p.id}
              layout
              className={`relative flex items-center gap-[0.8vw] overflow-hidden rounded-cut border-[1.5px] border-ink py-[0.8vh] pl-[0.8vw] pr-[0.6vw] ${w ? "" : "border-dashed"}`}
              style={{ background: w ? "color-mix(in srgb, #5b2a6e 12%, var(--paper))" : "var(--paper)" }}
            >
              <span className={`font-display w-[2.4em] shrink-0 border-r-[1.5px] border-dashed border-ink/30 text-center font-extrabold tabular-nums ${tv.body}`}>{p.points}</span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-bold ${tv.body}`}>{p.label}</span>
                {w ? (
                  <span className={`flex items-center gap-1.5 truncate font-bold text-ink/80 ${tv.body}`}>
                    <Sticker id={wp?.avatar} size={28} /> {w.name}
                  </span>
                ) : (
                  <span className="block text-[clamp(0.75rem,1.6vh,1.1rem)] font-semibold text-ink/50">khula hai · {p.hint}</span>
                )}
              </span>
              {w && (
                <motion.span initial={{ scale: 1.8, opacity: 0, rotate: -20 }} animate={{ scale: 0.7, opacity: 1, rotate: -8 }} transition={spring.settle} className="-mr-[0.6vw]">
                  <Stamp tone="leaf">Jeet</Stamp>
                </motion.span>
              )}
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

/** Big announcement when a prize is won; a soft line for a bogey. */
function EventBanner({ view, now }: { view: Pub; now: number }) {
  const ev = view.lastEvent;
  const visible = !!ev && now - ev.at < 6000;
  return (
    <AnimatePresence>
      {visible && ev && (
        <motion.div
          key={ev.at}
          className="pointer-events-none absolute inset-x-0 top-[38%] z-20 flex justify-center"
          initial={{ opacity: 0, scale: 1.4 }}
          animate={{ opacity: 1, scale: 1, transition: spring.settle }}
          exit={{ opacity: 0, transition: { duration: dur.screenExit, ease: ease.in } }}
        >
          {ev.kind === "win" ? (
            <VerdictSlip tone="leaf" seed={ev.at % 97} tilt={-3}>
              <span className="text-[clamp(1.6rem,5vh,3.8rem)] normal-case">{ev.text.replace(/^(.*) wins (.*)!$/, "$1 ne $2 jeet liya!")}</span>
            </VerdictSlip>
          ) : (
            <span className={`cut rounded-cut bg-paper px-[2vw] py-[1.4vh] font-bold ${tv.lead}`}>{ev.text}</span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function GameOver({ view, players }: { view: Pub; players: Player[] }) {
  const rows = rankRows(players, view.scores);
  const top = rows[0];
  return (
    <div className="grid min-h-0 grid-cols-[1.35fr_1fr] gap-[2.4vw]">
      <div className="grid min-h-0 grid-rows-[auto_1fr] gap-[2vh]">
        <div>
          <TvLabel>Khel khatam</TvLabel>
          <h2 className={`font-display font-extrabold ${tv.title}`}>{top && top.s > 0 ? `${top.p.name} jeet gaye!` : "Sab numbers ho gaye!"}</h2>
        </div>
        <TvPodium rows={rows} color="color-mix(in srgb, #5b2a6e 30%, var(--paper))" className="h-[88%] min-h-0 self-end" />
      </div>
      <div className="grid min-h-0 grid-rows-[auto_1fr] gap-[2vh]">
        <Prizes view={view} players={players} />
        <TvBoard rows={rows} max={6} className="min-h-0" />
      </div>
    </div>
  );
}

export function TvScreen({ view, players, act, now, spectator }: ScreenProps<Pub>) {
  // The big screen reads calls aloud, as it always has.
  const spoken = useRef<number | null>(view.current);
  const { current, call } = view;
  useEffect(() => {
    if (current && spoken.current !== current) {
      spoken.current = current;
      speak(call ?? String(current));
    }
  }, [current, call]);

  return (
    <TvStage className={spectator ? "grid-rows-[1fr]" : "grid-rows-[1fr_auto]"}>
      {view.done ? (
        <GameOver view={view} players={players} />
      ) : (
        <div className="relative grid min-h-0 grid-cols-[0.95fr_1.15fr_0.8fr] gap-[2vw]">
          <CallColumn view={view} now={now} />
          <NumberBoard view={view} />
          <div className="grid min-h-0 grid-rows-[auto_1fr] gap-[2.2vh]">
            <Prizes view={view} players={players} />
            <TvBoard rows={rankRows(players, view.scores)} max={5} className="min-h-0" />
          </div>
          <EventBanner view={view} now={now} />
        </div>
      )}
      {!spectator && !view.done && (
        <div className="flex justify-end gap-3">
          <PaperButton onClick={() => act("next")}>
            <SkipForward className="h-4 w-4" /> {view.autoCall > 0 ? "Abhi bulao" : "Call a number"}
          </PaperButton>
          {view.autoCall > 0 && (
            <PaperButton tone="paper" onClick={() => act("pause")}>
              {view.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {view.paused ? "Chalu" : "Roko"}
            </PaperButton>
          )}
        </div>
      )}
    </TvStage>
  );
}
