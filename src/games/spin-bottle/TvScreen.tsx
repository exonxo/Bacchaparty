"use client";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { dur, ease } from "@/components/paper/motion";
import { InkDefs, Stamp } from "@/components/paper/objects";
import { Sticker } from "@/components/paper/Paper";
import { TvCard, TvFrame, tv } from "@/components/paper/tv-c";
import { TONE_INFO } from "@/content/spin-bottle";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import type { ScreenProps } from "@/lib/types";
import type { Pub } from "./logic";
import { BottleCircle, KIND_PAPER, PromptCard, ReactionFloat, findP, nameOf } from "./parts";

/** The largest circle that fits the space left on the TV. */
function useFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(400);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize(Math.max(220, Math.floor(Math.min(e.contentRect.width, e.contentRect.height)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Big screen: the circle and bottle, then the card everyone reads together. */
export function Screen({ view, players, now }: ScreenProps<Pub>) {
  const sfx = useSfx();
  const [fitRef, fit] = useFit();
  useOnChange(view.phase, (p) => {
    if (p === "spinning") sfx.shared("shuffle");
    if (p === "choose") sfx.shared("reveal");
  });
  const target = findP(players, view.target);
  const tone = TONE_INFO[view.tone];

  let headline: string;
  let lead: string;
  if (view.phase === "ready") {
    headline = view.holder ? `${nameOf(players, view.holder)}, bottle ghumao!` : "Bottle ghumao!";
    lead = view.outcome
      ? `${nameOf(players, view.outcome.target)}: ${view.outcome.result === "done" ? "ho gaya ✅" : "pass 🙅"}`
      : "Kisi ka bhi phone — “Bottle ghumao!” dabao.";
  } else if (view.phase === "spinning") {
    headline = "Ghoom rahi hai…";
    lead = "Kiski baari? 👀";
  } else if (view.phase === "choose") {
    headline = `${target?.name ?? "Koi"} ki baari!`;
    lead = "Sach ya Himmat? Phone pe chuno.";
  } else {
    headline = `${target?.name ?? "Koi"}`;
    lead = view.card?.flipped ? "Card palat diya gaya 🔄" : "Ho gaya, palat do, ya pass — aapki marzi.";
  }

  const side = (
    <div className="flex h-full flex-col gap-4">
      <TvCard className="px-5 py-4" tilt={-1}>
        <div className={tv.label}>Mood</div>
        <div className="font-display text-[clamp(1.4rem,3.4vh,2.4rem)] font-extrabold">
          {tone.emoji} {tone.label}
        </div>
        <p className="text-[clamp(0.95rem,2vh,1.3rem)] text-muted">{tone.blurb}</p>
      </TvCard>
      <TvCard className="px-5 py-4" tilt={1}>
        <div className={tv.label}>Ab tak</div>
        <div className="font-display text-[clamp(1.2rem,3vh,2rem)] font-extrabold">
          ✅ {view.stats.done} · 🙅 {view.stats.pass}
        </div>
        <p className="text-[clamp(0.95rem,2vh,1.3rem)] text-muted">Pass karna bilkul theek hai. No points, sirf bawaal.</p>
      </TvCard>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <InkDefs />
      <TvFrame side={side}>
        <div className="relative flex min-h-0 flex-1 flex-col gap-[clamp(0.75rem,2vh,1.5rem)]">
          <div className="flex items-end justify-between gap-6">
            <div className="min-w-0">
              <div className={tv.label}>Turn {Math.max(1, view.n)}</div>
              <h2 className={`${tv.headline} flex items-center gap-3`}>
                {view.phase !== "ready" && view.phase !== "spinning" && target && <Sticker id={target.avatar} size={56} />}
                {headline}
              </h2>
              <p className={`${tv.lead} text-muted`}>{lead}</p>
            </div>
            {view.phase === "card" && view.kind && (
              <Stamp tone="ink">
                {KIND_PAPER[view.kind].label}
              </Stamp>
            )}
          </div>
          <div ref={fitRef} className="flex min-h-0 flex-1 items-center justify-center gap-[4%]">
            <AnimatePresence mode="popLayout" initial={false}>
              {view.phase === "card" ? (
                <motion.div
                  key="card"
                  className="w-full max-w-[min(70rem,90%)]"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: dur.screen, ease: ease.out } }}
                  exit={{ opacity: 0, transition: { duration: dur.screenExit } }}
                >
                  <PromptCard view={view} players={players} big />
                </motion.div>
              ) : (
                <motion.div key="circle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <BottleCircle view={view} players={players} size={fit} now={now} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <ReactionFloat reactions={view.reactions} players={players} big />
        </div>
      </TvFrame>
      <div className="sr-only" aria-live="polite">
        {view.phase === "choose" ? `The bottle stopped at ${target?.name ?? "someone"}.` : view.phase === "card" && view.card ? view.card.text : ""}
      </div>
    </MotionConfig>
  );
}
