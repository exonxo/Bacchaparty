"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useDelayedVisible } from "@/lib/useDelayedVisible";

function PlayingCards() {
  return (
    <div className="relative mx-auto h-[151px] w-[240px] max-w-full" aria-hidden>
      <motion.div
        className="loader-card-left absolute left-[34px] top-2.5 flex h-[114px] w-[84px] items-center justify-center rounded-[5px] border-[1.5px] border-ink bg-bg-2 shadow-[2px_2px_0_0_#1e1a17] [animation:loader-shuffle-left_2.4s_ease-in-out_infinite]"
        aria-hidden
      >
        <span className="font-display text-[34px] font-extrabold">✦</span>
      </motion.div>
      <motion.div
        className="loader-card-mid absolute left-[78px] top-2.5 flex h-[114px] w-[84px] items-center justify-center rounded-[5px] border-[1.5px] border-ink bg-turmeric shadow-[2px_2px_0_0_#1e1a17] [animation:loader-shuffle-mid_2.4s_ease-in-out_infinite]"
        aria-hidden
      >
        <span className="font-display text-[34px] font-extrabold">✦</span>
      </motion.div>
      <motion.div
        className="loader-card-right absolute right-[34px] top-2.5 flex h-[114px] w-[84px] items-center justify-center rounded-[5px] border-[1.5px] border-ink bg-vermilion text-paper shadow-[2px_2px_0_0_#1e1a17] [animation:loader-shuffle-right_2.4s_ease-in-out_infinite]"
        aria-hidden
      >
        <span className="font-display text-[34px] font-extrabold">?</span>
      </motion.div>
    </div>
  );
}

/** Bottom sheet while a game or round starts (spec §04). */
export function ShuffleDeal({
  open,
  title = "Secret words, coming right up.",
  subtitle = "Shuffling the chits for everyone…",
  footnote = "Keep your word to yourself. SHHH!",
}: {
  open: boolean;
  title?: string;
  subtitle?: string;
  footnote?: string;
}) {
  const show = useDelayedVisible(open);
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[70] bg-bg/55" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[71] mx-auto max-w-6xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            initial={{ y: "100%" }}
            animate={{ y: 0, transition: reduce ? { duration: 0 } : { type: "spring", visualDuration: 0.42, bounce: 0.1 } }}
            exit={{ y: "100%", transition: { duration: 0.2 } }}
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="cut mx-auto max-w-lg rounded-t-soft border-x-[1.5px] border-t-[1.5px] border-ink bg-paper px-6 pb-8 pt-4 text-center sm:max-w-xl">
              <div className="mx-auto mb-6 h-1 w-9 rounded-full bg-[#b8ad9d]" aria-hidden />
              {show ? (
                <>
                  <PlayingCards />
                  <h2 className="font-display text-p-title font-extrabold">{title}</h2>
                  <p className="mt-2 text-p-body text-muted">{subtitle}</p>
                  <p className="mt-6 inline-block rounded-full border-[1.5px] border-line bg-bg-2 px-4 py-2 text-p-note font-semibold text-muted">{footnote}</p>
                </>
              ) : (
                <p className="font-display text-p-lead font-extrabold">{title}</p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
