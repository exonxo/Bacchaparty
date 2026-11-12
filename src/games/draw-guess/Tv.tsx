"use client";
import { Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { dur, ease, spring } from "@/components/paper/motion";
import { Sticker } from "@/components/paper/Paper";
import { TvBoard, TvFrame, TvLabel, TvPodium, TvSlip, TvTimer } from "@/components/paper/tv-b";
import type { Player, ScreenProps } from "@/lib/types";
import { PadDrawing } from "./pad";
import { CHOOSE_FOR } from "./index";
import type { Pub } from "./shared";
import { usePadStrokes } from "./usePad";

const NOTE = "#fff3a8";
const NOTE_OK = "#cfe9d6";
const NOTE_TILT = [-3, 2, -1.5, 3, -2.5, 1.5, -2, 2.5];

/** Spiral binding along the top of the pad. */
function Spiral() {
  return (
    <svg aria-hidden viewBox="0 0 300 26" preserveAspectRatio="none" className="absolute inset-x-[3%] -top-[2.2vh] h-[4.4vh] w-[94%]">
      {Array.from({ length: 15 }, (_, i) => {
        const x = 10 + i * 20;
        return (
          <g key={i}>
            <circle cx={x} cy="19" r="3" fill="#1e1a17" opacity="0.18" />
            <path d={`M${x - 3} 19 C ${x - 4} 2, ${x + 4} 2, ${x + 3} 19`} fill="none" stroke="#1e1a17" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
}

/** The live drawing, large. Each turn is a new page; the old one tears off. */
function Pad({ view, drawer }: { view: Pub; drawer: Player | null }) {
  const reduce = useReducedMotion();
  const { strokes, stale } = usePadStrokes(view.pad);
  return (
    <div className="cut relative h-full rounded-soft bg-paper p-[1.6vh] pt-[3vh]" style={{ aspectRatio: "1 / 1", maxWidth: "100%" }}>
      <Spiral />
      <div className="relative h-full w-full">
        <AnimatePresence initial={false}>
          <motion.div
            key={view.pad.turn}
            className="absolute inset-0 overflow-hidden rounded-cut border-[1.5px] border-ink/25 bg-white"
            style={{ transformOrigin: "20% 0%" }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, rotate: 0, transition: { duration: dur.screen, ease: ease.out } }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.15 } } : { y: -80, rotate: -7, opacity: 0, transition: { duration: 0.4, ease: ease.in } }}
          >
            <PadDrawing strokes={strokes} className="h-full w-full" label={`${drawer?.name ?? "The drawer"}'s drawing`} />
            {view.phase === "choosing" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-[1.6vh] text-center">
                <Sticker id={drawer?.avatar} size={110} tilt={-4} />
                <p className="font-display px-[3vh] font-extrabold text-balance" style={{ fontSize: "clamp(1.4rem, 4vh, 3rem)" }}>
                  {drawer?.name ?? "Koi"} chit chun rahe hain…
                </p>
              </div>
            )}
            {stale && (
              <span className="absolute bottom-[1vh] right-[1vh] rounded-cut bg-paper/90 px-[1vh] font-semibold text-muted" style={{ fontSize: "clamp(0.85rem, 1.8vh, 1.2rem)" }}>
                Drawing aa rahi hai…
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Blanks for the hidden word, with the first letter after half time. Public information only. */
function Blanks({ view, now }: { view: Pub; now: number }) {
  if (view.phase !== "drawing" || !view.mask) return null;
  const first = now >= view.hintAt ? view.firstLetter : "";
  const letters = [...view.mask].filter((c) => c === "_").length;
  return (
    <div aria-label={`The word has ${letters} letters${first ? `, starting with ${first}` : ""}`}>
      <TvLabel>Shabd · {letters} akshar</TvLabel>
      <div className="mt-[1vh] flex flex-wrap items-end gap-x-[2.4vh] gap-y-[1vh]">
        {view.mask.split(" ").map((word, wi) => (
          <div key={wi} className="flex gap-[0.8vh]">
            {[...word].map((c, i) => {
              const shown = wi === 0 && i === 0 && first ? first : c === "_" ? "" : c;
              return (
                <motion.span
                  key={i}
                  aria-hidden
                  initial={false}
                  animate={{ scale: shown ? [1.3, 1] : 1 }}
                  className={`font-display flex items-end justify-center border-b-[3px] font-extrabold uppercase leading-none ${shown ? "border-ink" : "border-ink/40"}`}
                  style={{ width: "clamp(1.6rem, 4.6vh, 3.4rem)", height: "clamp(2.2rem, 6vh, 4.4rem)", fontSize: "clamp(1.6rem, 5vh, 3.6rem)" }}
                >
                  {shown}
                </motion.span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Recent guesses as sticky notes. Right guesses never show the word. */
function Notes({ view, players }: { view: Pub; players: Player[] }) {
  const items = view.feed.slice(-8);
  const base = view.feed.length - items.length;
  if (!items.length) {
    return (
      <p className="font-semibold text-muted" style={{ fontSize: "clamp(1rem, 2.4vh, 1.6rem)" }}>
        {view.phase === "drawing" ? "Phone pe guess likho — pehla guess kaun karega?" : ""}
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap content-start gap-[1.2vh]" aria-label="Recent guesses">
      <AnimatePresence initial={false}>
        {items.map((f, i) => {
          const p = players.find((x) => x.id === f.playerId);
          const ok = f.text === null;
          return (
            <motion.li
              key={base + i}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotate: NOTE_TILT[(base + i) % NOTE_TILT.length] }}
              transition={spring.select}
              className="cut-drop flex max-w-[16vw] items-center gap-[0.8vh] px-[1.2vh] py-[0.8vh] font-semibold"
              style={{ background: ok ? NOTE_OK : NOTE, fontSize: "clamp(0.95rem, 2.3vh, 1.5rem)" }}
            >
              <Sticker id={p?.avatar} size={30} />
              <span className="min-w-0 truncate">
                <b>{p?.name ?? "?"}</b> {ok ? "· Bujh liya!" : `· ${f.text}`}
              </span>
              {ok && <Check className="h-5 w-5 shrink-0 text-leaf" strokeWidth={3} />}
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

/** Big screen: read-only. The drawing, the blanks, everyone's guesses and points — never the word before the reveal. */
export function TvScreen({ view, players, now }: ScreenProps<Pub>) {
  const drawer = players.find((p) => p.id === view.drawerId) ?? null;

  if (view.phase === "over") {
    return (
      <TvFrame
        stage={
          <TvPodium
            rows={players.filter((p) => p.id in view.scores).map((p) => ({ p, score: view.scores[p.id] ?? 0 }))}
            headline={(w) => (w ? `${w.name} — Chitrakaar No. 1!` : "Sab ne kamaal kiya!")}
          />
        }
      />
    );
  }

  const guessers = players.filter((p) => p.connected && p.id !== view.drawerId);
  const stage = (
    <div className="flex h-full min-h-0 gap-[3.4vh]">
      <div className="h-full min-h-0 shrink-0" style={{ width: "min(52vw, calc(100dvh - 13.5rem))" }}>
        <Pad view={view} drawer={drawer} />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[2.4vh] py-[0.6vh]">
        <div className="flex items-center gap-[1.6vh]">
          <Sticker id={drawer?.avatar} size={64} tilt={-4} />
          <div className="min-w-0">
            <TvLabel>
              Baari {Math.min(view.turn + 1, view.totalTurns)} / {view.totalTurns}
            </TvLabel>
            <div className="font-display truncate font-extrabold leading-none" style={{ fontSize: "clamp(1.8rem, 5.4vh, 4rem)" }}>
              {drawer?.name ?? "…"}
            </div>
            <div className="font-semibold text-muted" style={{ fontSize: "clamp(0.95rem, 2.3vh, 1.5rem)" }}>
              {view.phase === "drawing" ? "drawing bana rahe hain" : view.phase === "choosing" ? "chit chun rahe hain" : "ne banaya"}
            </div>
          </div>
        </div>
        {view.drawerAwaySince !== null && view.phase !== "reveal" && (
          <p className="font-semibold text-vermilion" style={{ fontSize: "clamp(1rem, 2.4vh, 1.6rem)" }}>
            {drawer?.name ?? "Drawer"} ka phone offline hai — baari jaldi aage badhegi.
          </p>
        )}
        <AnimatePresence mode="wait" initial={false}>
          {view.phase === "reveal" ? (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { duration: dur.screen, ease: ease.out } }}
              exit={{ opacity: 0, transition: { duration: dur.screenExit, ease: ease.in } }}
              aria-live="polite"
            >
              <TvLabel>Yeh tha</TvLabel>
              <div className="font-display mt-[0.6vh] font-extrabold leading-none text-balance" style={{ fontSize: "clamp(2.8rem, 9vh, 7rem)" }}>
                {view.answer}
              </div>
              <div className="mt-[1.6vh]">
                <TvSlip tone={view.correct.length ? "leaf" : "ink"}>
                  {view.correct.length ? `${view.correct.length} ne bujh liya!` : "Kisi ne nahi bujha"}
                </TvSlip>
              </div>
            </motion.div>
          ) : (
            <motion.div key="blanks" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: dur.screen } }} exit={{ opacity: 0, transition: { duration: dur.screenExit } }}>
              <Blanks view={view} now={now} />
              {view.phase === "drawing" && (
                <div className="mt-[1.6vh] font-display font-extrabold tabular-nums" style={{ fontSize: "clamp(1.2rem, 3.2vh, 2.4rem)" }}>
                  {view.correct.length}/{guessers.length} bujh gaye
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="min-h-0 flex-1 overflow-hidden">
          <Notes view={view} players={players} />
        </div>
      </div>
    </div>
  );

  const rail = (
    <>
      {view.phase !== "reveal" && (
        <TvTimer now={now} deadline={view.deadline} totalSeconds={view.phase === "choosing" ? CHOOSE_FOR / 1000 : view.seconds} label={view.phase === "choosing" ? "Chunne ka samay" : "Samay"} color="#1d4ed8" />
      )}
      <TvBoard
        rows={players
          .filter((p) => p.id in view.scores || p.connected)
          .map((p) => ({
            p,
            score: view.scores[p.id] ?? 0,
            active: p.id === view.drawerId,
            note: view.phase === "reveal" && view.gains[p.id] ? `+${view.gains[p.id]} is baari` : p.id === view.drawerId ? "Chitrakaar" : undefined,
          }))}
      />
    </>
  );
  return <TvFrame stage={stage} rail={rail} />;
}
