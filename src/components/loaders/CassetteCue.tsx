"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useDelayedVisible } from "@/lib/useDelayedVisible";
import { getGameInfo } from "@/games/catalog";

function CassetteArt() {
  return (
    <div className="relative mx-auto mb-7 h-[155px] w-full max-w-sm rounded-soft border-[1.5px] border-ink bg-turmeric shadow-[3px_3px_0_0_#1e1a17]" aria-hidden>
      <div className="absolute inset-x-4 top-3.5 border-b border-ink pb-1 text-center text-[10px] font-bold tracking-[0.2em]">
        <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">MEHFIL MIX</span>
        <span className="absolute right-0 top-0 text-[8px] tracking-wider">SIDE A</span>
      </div>
      <div className="absolute left-[23px] right-[23px] top-[50px] grid h-[57px] grid-cols-[36px_1fr_36px] items-center gap-2 rounded-[30px] border-[1.5px] border-ink bg-paper px-3">
        <span className="loader-reel relative block h-9 w-9 rounded-full border-[1.5px] border-ink bg-bg-2 [animation:loader-reel_2.4s_linear_infinite]">
          <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" />
        </span>
        <span className="flex items-end justify-center gap-0.5">
          {[10, 16, 22, 18, 26, 20, 14, 24].map((h, i) => (
            <i key={i} className="w-1 rounded-sm bg-vermilion" style={{ height: h }} />
          ))}
        </span>
        <span className="loader-reel relative block h-9 w-9 rounded-full border-[1.5px] border-ink bg-bg-2 [animation:loader-reel_2.4s_linear_infinite]">
          <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" />
        </span>
      </div>
    </div>
  );
}

const MUSIC = new Set(["antakshari", "sound-guru"]);

export function isMusicGameLoader(gameId: string | null) {
  return !!gameId && MUSIC.has(gameId);
}

/** Music-game prep card (spec §05). */
export function CassetteCue({
  open,
  gameId,
  title,
  subtitle = "Cueing the next round…",
  hint = "Warm up your voice, not the volume. The next letter is on its way.",
}: {
  open: boolean;
  gameId?: string | null;
  title?: string;
  subtitle?: string;
  hint?: string;
}) {
  const show = useDelayedVisible(open);
  const reduce = useReducedMotion();
  const gameName = title ?? (gameId ? getGameInfo(gameId)?.name : undefined) ?? "Music round";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[72] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: reduce ? 0 : 0.2 } }}
          exit={{ opacity: 0 }}
          aria-busy="true"
        >
          <div className="absolute inset-0 bg-bg/70" aria-hidden />
          <motion.div
            className="cut relative z-[1] w-full max-w-md rounded-soft bg-card px-5 py-8 text-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.2 } }}
            role="status"
            aria-live="polite"
          >
            {show ? (
              <>
                <p className="font-display text-p-lead font-extrabold">{gameName}</p>
                <CassetteArt />
                <p className="font-display text-p-title font-extrabold">{subtitle}</p>
                <p className="mt-1 text-p-body text-muted">Bas ek pal. Phir sur lagao.</p>
                <motion.div className="cut-soft mt-6 rounded-soft bg-bg-2 px-4 py-3 text-left text-p-note text-muted">
                  <b className="text-ink">While you wait:</b> {hint}
                </motion.div>
              </>
            ) : (
              <p className="font-display text-p-lead font-extrabold">{gameName}</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
