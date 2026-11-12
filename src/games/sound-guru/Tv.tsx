"use client";
import { AnimatePresence, motion } from "motion/react";
import { dur, ease, spring } from "@/components/paper/motion";
import { Sticker } from "@/components/paper/Paper";
import { TvBoard, TvFrame, TvLabel, TvPodium, TvStickers, TvTimer } from "@/components/paper/tv-b";
import type { Player, ScreenProps } from "@/lib/types";
import { pointsFor, type Pub } from "./index";
import { CORAL, Megaphone } from "./PaperPhone";

/** Big screen: the Sound Maker on a coral card, who has guessed, the timer and points. Never shows the sound before the reveal. */
export function TvScreen({ view, players, now }: ScreenProps<Pub>) {
  const maker = players.find((p) => p.id === view.makerId) ?? null;
  const find = (id: string) => players.find((p) => p.id === id);
  const solvers = view.correct.map(find).filter(Boolean) as Player[];
  const guessers = players.filter((p) => p.connected && p.id !== view.makerId);

  if (view.phase === "over") {
    return (
      <TvFrame
        stage={
          <TvPodium
            rows={players.filter((p) => p.id in view.scores).map((p) => ({ p, score: view.scores[p.id] ?? 0 }))}
            headline={(w) => (w ? `${w.name} hain Sound Guru!` : "Sound Guru kaun?")}
            accent={CORAL}
          />
        }
      />
    );
  }

  const away = view.makerAwaySince !== null;
  const stage = (
    <div className="flex h-full min-h-0 flex-col gap-[2.4vh]">
      <div className="flex items-baseline justify-between">
        <TvLabel>
          Awaaz {Math.min(view.turn + 1, view.totalTurns)} / {view.totalTurns}
        </TvLabel>
      </div>
      <div className="grid min-h-0 flex-1 gap-[3vh]" style={{ gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)" }}>
        {/* The Sound Maker */}
        <motion.section
          key={view.makerId ?? "none"}
          initial={{ opacity: 0, y: 14, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: -1, transition: spring.settle }}
          className="cut flex min-h-0 flex-col items-center justify-center gap-[1.6vh] overflow-hidden rounded-soft px-[3vh] py-[2.4vh] text-center"
          style={{ background: CORAL }}
        >
          <Sticker id={maker?.avatar} size={120} tilt={-5} />
          <div className="font-display font-extrabold leading-none text-balance" style={{ fontSize: "clamp(2.2rem, 7vh, 5.5rem)" }}>
            {maker?.name ?? "…"}
          </div>
          <div className="font-semibold text-ink/80" style={{ fontSize: "clamp(1rem, 2.6vh, 1.8rem)" }}>
            {view.phase === "ready" ? "awaaz soch rahe hain… taiyaar ho jao" : view.phase === "making" ? "awaaz bana rahe hain — dhyaan se suno!" : "ki awaaz thi"}
          </div>
          <div className="[&>svg]:h-auto [&>svg]:w-full" style={{ width: "min(78%, 30vh)" }}>
            <Megaphone size={400} loud={view.phase === "making"} onCoral />
          </div>
          {away && (
            <p className="font-bold text-ink" style={{ fontSize: "clamp(0.95rem, 2.2vh, 1.4rem)" }}>
              Phone offline hai — agli awaaz jaldi aayegi.
            </p>
          )}
        </motion.section>

        {/* What the room sees: guess on phones, then the answer */}
        <section className="flex min-h-0 flex-col justify-center gap-[3vh]">
          <AnimatePresence mode="wait" initial={false}>
            {view.phase === "reveal" ? (
              <motion.div
                key="reveal"
                initial={{ opacity: 0, rotateX: -60, y: -10 }}
                animate={{ opacity: 1, rotateX: 0, y: 0, transition: { duration: dur.reveal, ease: ease.expo } }}
                exit={{ opacity: 0, transition: { duration: dur.screenExit, ease: ease.in } }}
                className="cut rounded-soft bg-card px-[3vh] py-[2.6vh] text-center"
                aria-live="polite"
              >
                <TvLabel>Awaaz thi</TvLabel>
                <div className="font-display mt-[1vh] font-extrabold leading-none text-balance" style={{ fontSize: "clamp(2.8rem, 9vh, 7rem)" }}>
                  {view.answer}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="ask"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { duration: dur.screen, ease: ease.out } }}
                exit={{ opacity: 0, transition: { duration: dur.screenExit, ease: ease.in } }}
                className="text-center"
              >
                <div className="font-display font-extrabold leading-tight text-balance" style={{ fontSize: "clamp(2.4rem, 7.5vh, 6rem)" }}>
                  {view.phase === "ready" ? "Kaan taiyaar!" : "Kya awaaz hai?"}
                </div>
                <p className="mt-[1vh] font-semibold text-muted" style={{ fontSize: "clamp(1rem, 2.6vh, 1.8rem)" }}>
                  Apne phone pe guess likho. Pehle sahi = zyada points.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="text-center">
            <div className="font-display font-extrabold tabular-nums" style={{ fontSize: "clamp(1.4rem, 4vh, 3rem)" }}>
              {solvers.length}/{guessers.length} bujh gaye
            </div>
            <div className="mt-[1.6vh] min-h-[12vh]">
              {solvers.length > 0 ? (
                <TvStickers
                  players={solvers}
                  size={70}
                  mark={(p) => (
                    <span className="rounded-cut bg-leaf px-[0.8vh] font-bold text-paper" style={{ fontSize: "clamp(0.85rem, 2vh, 1.25rem)" }}>
                      +{pointsFor(view.correct.indexOf(p.id))}
                    </span>
                  )}
                />
              ) : (
                <p className="font-semibold text-muted" style={{ fontSize: "clamp(1rem, 2.4vh, 1.6rem)" }}>
                  {view.phase === "reveal" ? "Is baar kisi ne nahi bujha!" : "Abhi tak koi nahi…"}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  const rail = (
    <>
      {view.phase === "making" && <TvTimer now={now} deadline={view.deadline} totalSeconds={view.seconds} label="Samay" color={CORAL} />}
      <TvBoard
        rows={players
          .filter((p) => p.id in view.scores || p.connected)
          .map((p) => ({ p, score: view.scores[p.id] ?? 0, active: p.id === view.makerId, note: p.id === view.makerId ? "Sound Maker" : undefined }))}
        accent={CORAL}
      />
    </>
  );
  return <TvFrame stage={stage} rail={rail} />;
}
