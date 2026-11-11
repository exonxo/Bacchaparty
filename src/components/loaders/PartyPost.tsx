"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { useDelayedVisible } from "@/lib/useDelayedVisible";
import { LoadingDots } from "./LoadingDots";

function PartyPostEnvelope() {
  const gid = useId().replace(/:/g, "");
  return (
    <div className="party-post-scene" aria-hidden>
      <div className="party-post-ground" />
      <div className="party-post-back">
        <svg viewBox="0 0 210 128" aria-hidden>
          <rect x="0.75" y="0.75" width="208.5" height="126.5" rx="5" fill="#daa02e" stroke="#1e1a17" strokeWidth="1.5" />
        </svg>
      </div>
      <div className="party-post-flap">
        <svg className="party-post-flap-face" viewBox="0 0 210 78" aria-hidden>
          <path d="M.75.75H209.25L105 77Z" fill="#f4bf46" stroke="#1e1a17" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <svg className="party-post-flap-face reverse" viewBox="0 0 210 78" aria-hidden>
          <path d="M.75.75H209.25L105 77Z" fill="#f8d582" stroke="#1e1a17" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="party-post-letter-clip">
        <div className="party-post-card">
          <strong className="font-display block text-[20px] font-extrabold leading-6 tracking-[-0.04em] text-ink">You&apos;re invited!</strong>
          <span className="mt-1.5 block text-p-note font-medium text-muted">Ek host. Poori mehfil.</span>
          <span className="mt-1 block text-sm leading-[14px] text-vermilion" aria-hidden>
            ✦ &nbsp; ✦ &nbsp; ✦
          </span>
          <span className="mx-auto mt-3 block w-[108px] border-t border-[#d8cfc2]" aria-hidden />
        </div>
      </div>
      <div className="party-post-pocket">
        <svg viewBox="0 0 210 128" aria-hidden>
          <defs>
            <linearGradient id={`${gid}-pocket`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1e1a17" stopOpacity="0.15" />
              <stop offset="1" stopColor="#1e1a17" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x="0.75" y="0.75" width="208.5" height="126.5" rx="5" fill="#f2b632" stroke="#1e1a17" strokeWidth="1.5" />
          <path d="M1 1 105 62 1 126Z" fill="#f5c454" />
          <path d="M209 1 105 62 209 126Z" fill="#edac26" />
          <path d="M1 127 105 62 209 127" fill="#f2b632" stroke="#1e1a17" strokeWidth="1.2" strokeLinejoin="round" />
          <path
            d="M.75.75 105 62 209.25.75M.75.75V122Q.75 127.25 6 127.25H204Q209.25 127.25 209.25 122V.75"
            fill="none"
            stroke="#1e1a17"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="party-post-wax">
        <svg viewBox="0 0 44 44" aria-hidden>
          <path
            d="m22 2 5 2 5 1 3 4 4 3 1 5 2 5-2 5-1 5-4 3-3 4-5 1-5 2-5-2-5-1-3-4-4-3-1-5-2-5 2-5 1-5 4-3 3-4 5-1Z"
            fill="#c23a22"
            stroke="#1e1a17"
            strokeWidth="1.5"
          />
          <circle cx="22" cy="22" r="14" fill="none" stroke="#fffdf8" strokeOpacity="0.25" />
          <path d="m22 10 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" fill="#fffdf8" />
        </svg>
      </div>
    </div>
  );
}

/** Full-screen dim + card while creating or joining a room (spec §02). */
export function PartyPost({
  open,
  title = "Getting your party ready.",
  subtitle = "Bas, sabko bulana baaki hai.",
}: {
  open: boolean;
  title?: string;
  subtitle?: string;
}) {
  const showArt = useDelayedVisible(open);
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: reduce ? 0 : 0.2 } }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          aria-busy="true"
        >
          <div className="absolute inset-0 bg-bg/80" aria-hidden />
          <motion.div
            className="cut relative z-[1] w-full max-w-md rounded-soft bg-card px-5 py-8 text-center sm:max-w-lg"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.2 } }}
            role="status"
            aria-live="polite"
          >
            {showArt ? (
              <>
                <PartyPostEnvelope />
                <h2 className="font-display text-p-title font-extrabold text-balance">{title}</h2>
                <p className="mt-2 text-p-body text-muted">{subtitle}</p>
                <LoadingDots className="party-post-dots mt-5" />
              </>
            ) : (
              <p className="font-display text-p-lead font-extrabold">{title}</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
