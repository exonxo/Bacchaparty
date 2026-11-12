"use client";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { dur, ease, spring } from "@/components/paper/motion";
import { InkDefs } from "@/components/paper/objects";
import { Sticker } from "@/components/paper/Paper";
import { TvCard, tv, useTvScale } from "@/components/paper/tv-c";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import type { Player, ScreenProps } from "@/lib/types";
import { HOME } from "./board";
import { COLOR_NAME, INK_OF, ON_INK, TURN_MS, type Pub } from "./helpers";
import { PaperBoard, PaperDice, Podium } from "./PaperPhone";

const findP = (players: Player[], id: string | undefined) => players.find((p) => p.id === id);
const noop = () => {};

/** Big-screen view: the board fills the screen height; turn, dice and seats sit beside it. */
export function Screen({ view, players, now }: ScreenProps<Pub>) {
  const k = useTvScale();
  const sfx = useSfx();
  useOnChange(view.rollId, () => sfx.shared("pop"));
  useOnChange(view.note?.at ?? 0, () => {
    if (view.note?.kind === "finish") sfx.shared("fanfare");
  });

  const seat = view.seats[view.turn];
  const who = findP(players, seat?.playerId);
  const left = Math.max(0, (view.phaseStartedAt ?? view.turnStartedAt) + TURN_MS - now);
  const secs = Math.ceil(left / 1000);
  const urgent = secs <= 5;
  const note = view.note && now - view.note.at < 6000 ? view.note : null;
  const over = view.phase === "over";

  return (
    <MotionConfig reducedMotion="user">
      <InkDefs />
      <div className="sr-only" aria-live="polite">
        {note?.text ?? ""}
      </div>
      <div className="flex min-h-[26rem] gap-[clamp(1rem,2.5vw,2.5rem)] overflow-hidden" style={{ height: "calc(100dvh - 11rem)" }}>
        {/* The board, as big as the height allows */}
        <div className="cut aspect-square h-full shrink-0 overflow-hidden rounded-soft bg-paper p-[clamp(0.25rem,0.6vh,0.6rem)]">
          <PaperBoard view={view} players={players} meId="" pickable={[]} onPick={noop} now={now} />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[clamp(0.6rem,1.8vh,1.25rem)]">
          {over ? (
            <div className="min-h-0 flex-1 overflow-hidden">
              <Podium view={view} players={players} meId="" />
            </div>
          ) : (
            <>
              {/* Whose turn, with the timer */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={view.turn}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: dur.screen, ease: ease.out } }}
                  exit={{ opacity: 0, transition: { duration: dur.screenExit, ease: ease.in } }}
                >
                  <TvCard className="p-[clamp(0.75rem,2vh,1.5rem)]" style={{ background: seat ? INK_OF[seat.color] : undefined, color: seat ? ON_INK[seat.color] : undefined }} tilt={-0.6}>
                    <div className="flex items-center gap-[clamp(0.75rem,1.5vw,1.5rem)]">
                      <Sticker id={who?.avatar} size={Math.round(96 * k)} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[clamp(0.85rem,1.9vh,1.3rem)] font-bold uppercase tracking-[0.18em] opacity-80">{seat ? `${COLOR_NAME[seat.color]} · baari` : "Baari"}</div>
                        <div className="font-display truncate text-[clamp(2.25rem,6.5vh,4.75rem)] font-extrabold leading-none">{who?.name ?? "Koi"}</div>
                        <div className="mt-1 text-[clamp(1rem,2.6vh,1.75rem)] font-semibold opacity-90">
                          {who?.connected === false ? "Phone offline — thodi der mein skip" : view.phase === "roll" ? "Dice ghuma rahe hain…" : `${view.dice} aaya — goti chun rahe hain…`}
                        </div>
                      </div>
                      <span className="font-display shrink-0 text-[clamp(2.5rem,8vh,5.5rem)] font-extrabold tabular-nums leading-none" style={{ color: urgent ? "#fffdf8" : undefined, textShadow: urgent ? "0 0 0 transparent" : undefined }}>
                        {secs}
                      </span>
                    </div>
                    <div
                      role="timer"
                      aria-label={`${who?.name ?? "Koi"} ke paas ${secs} second`}
                      className="mt-[clamp(0.5rem,1.4vh,1rem)] h-[clamp(0.6rem,1.4vh,1rem)] overflow-hidden rounded-full border-[1.5px]"
                      style={{ borderColor: seat ? ON_INK[seat.color] : "var(--ink)" }}
                    >
                      <div className="h-full" style={{ width: `${(left / TURN_MS) * 100}%`, background: urgent ? "var(--vermilion)" : seat ? ON_INK[seat.color] : "var(--ink)", transition: "width 0.25s linear" }} />
                    </div>
                  </TvCard>
                </motion.div>
              </AnimatePresence>

              {/* Dice + what just happened */}
              <div className="flex items-center gap-[clamp(1rem,2vw,2rem)]">
                <PaperDice value={view.dice} rollId={view.rollId} size={Math.round(150 * k)} />
                <div className="min-w-0 flex-1">
                  <AnimatePresence mode="wait">
                    {note ? (
                      <motion.p
                        key={note.at}
                        className={`${tv.lead} font-semibold`}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0, transition: spring.select }}
                        exit={{ opacity: 0, transition: { duration: dur.screenExit, ease: ease.in } }}
                      >
                        {note.auto && <b className="text-vermilion">Time up! </b>}
                        {note.text}
                        {note.again && <b> · phir se dice!</b>}
                      </motion.p>
                    ) : (
                      <p className={`${tv.lead} text-muted`}>6 aaye to goti bahar. Kisi ki goti pe utro to wo ghar wapas!</p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </>
          )}

          {/* Seats: who is where, pieces home */}
          <ul className="mt-auto grid grid-cols-2 gap-[clamp(0.5rem,1vw,1rem)]" aria-label="Khiladi">
            {view.seats.map((s, i) => {
              const p = findP(players, s.playerId);
              const home = (view.tokens[s.color] ?? []).filter((t) => t >= HOME).length;
              const place = view.finished.indexOf(s.playerId);
              const turn = i === view.turn && !over;
              return (
                <li
                  key={s.color}
                  className={`flex items-center gap-[clamp(0.5rem,1vw,0.9rem)] rounded-cut border-[1.5px] bg-paper px-[clamp(0.5rem,1vw,0.9rem)] py-[clamp(0.35rem,1vh,0.7rem)] ${
                    turn ? "border-ink shadow-[2px_2px_0_0_var(--ink)]" : "border-ink/15"
                  } ${p?.connected === false ? "opacity-45" : ""}`}
                >
                  <span className="h-[clamp(0.9rem,2vh,1.3rem)] w-[clamp(0.9rem,2vh,1.3rem)] shrink-0 rounded-full border-[1.5px] border-ink" style={{ background: INK_OF[s.color] }} aria-label={COLOR_NAME[s.color]} />
                  <Sticker id={p?.avatar} size={Math.round(48 * k)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[clamp(1rem,2.5vh,1.7rem)] font-bold leading-tight">{p?.name ?? "Koi"}</span>
                    <span className="mt-1 flex items-center gap-1" aria-label={`${home} of 4 ghar`}>
                      {[0, 1, 2, 3].map((n) => (
                        <span key={n} className="h-[clamp(0.4rem,0.9vh,0.6rem)] w-[clamp(1rem,2vw,1.6rem)] rounded-full border border-ink/40" style={{ background: n < home ? INK_OF[s.color] : "transparent" }} />
                      ))}
                    </span>
                  </span>
                  {place >= 0 && <span className="font-display shrink-0 text-[clamp(1.2rem,3vh,2rem)] font-extrabold">#{place + 1}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </MotionConfig>
  );
}
