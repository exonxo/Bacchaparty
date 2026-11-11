"use client";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ease, spring } from "./motion";
import { tornClip } from "./Paper";

/** SVG filter that roughens edges, for rubber-stamp ink. Render once per screen. */
export function InkDefs() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <defs>
        <filter id="ink-rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035 0.06" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" />
        </filter>
        <pattern id="env-lining" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
          <rect width="10" height="10" fill="#fff6dd" />
          <rect width="3" height="10" fill="#c23a22" opacity="0.5" />
        </pattern>
      </defs>
    </svg>
  );
}

/** A small domino mask — the Chor's mark. */
export function MaskGlyph({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden width={size} height={size * 0.6} viewBox="0 0 40 24" className={className} fill="currentColor">
      <path d="M2 6c5-4 11-4 18-1 7-3 13-3 18 1 1 7-2 14-9 15-4 0-6-3-9-6-3 3-5 6-9 6C4 20 1 13 2 6Zm9 4c-2 0-4 1-4 3s2 3 4 3 4-1 4-3-2-3-4-3Zm18 0c-2 0-4 1-4 3s2 3 4 3 4-1 4-3-2-3-4-3Z" fillRule="evenodd" />
    </svg>
  );
}

/** Wax seal with a slightly uneven edge. */
export function WaxSeal({ size = 44 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 48 48">
      <path
        d="M24 3c4 0 6 2 9 3s7 1 8 5 0 6 2 9 3 6 1 10-5 4-7 7-3 6-8 7-6-2-10-2-6 2-10-1-3-6-5-9-4-6-3-10 4-5 5-9 1-7 5-9 6 0 9-1 2-1 4-0Z"
        fill="#c23a22"
        stroke="#1e1a17"
        strokeWidth="1.5"
      />
      <circle cx="24" cy="24.5" r="12.5" fill="none" stroke="#1e1a17" strokeOpacity="0.35" strokeWidth="1.2" />
      <g transform="translate(12 17.5)" fill="#fff6dd">
        <path d="M1.2 3.6c3-2.4 6.6-2.4 10.8-.6 4.2-1.8 7.8-1.8 10.8.6.6 4.2-1.2 8.4-5.4 9-2.4 0-3.6-1.8-5.4-3.6-1.8 1.8-3 3.6-5.4 3.6C2.4 12 .6 7.8 1.2 3.6Zm5.4 2.4c-1.2 0-2.4.6-2.4 1.8s1.2 1.8 2.4 1.8S9 9 9 7.8 7.8 6 6.6 6Zm10.8 0c-1.2 0-2.4.6-2.4 1.8s1.2 1.8 2.4 1.8 2.4-.6 2.4-1.8S18.600 6 17.4 6Z" fillRule="evenodd" />
      </g>
    </svg>
  );
}

/** Magnifying glass, drawn as an object (not a UI icon). */
export function Magnifier({ size = 28 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M20.500 20.500 28 28" stroke="#1e1a17" strokeWidth="5" strokeLinecap="round" />
      <path d="M21.500 21.500 27.500 27.500" stroke="#f2b632" strokeWidth="2" strokeLinecap="round" />
      <circle cx="13" cy="13" r="9.500" fill="#fffdf8" stroke="#1e1a17" strokeWidth="2.200" />
      <path d="M8 12.500a5.500 5.500 0 0 1 4-4.500" stroke="#1e1a17" strokeOpacity="0.45" strokeWidth="1.600" strokeLinecap="round" />
    </svg>
  );
}

/** Rubber-stamp text: rough ink, slightly rotated. Use for short verdicts only. */
export function Stamp({ children, tone = "vermilion", className = "" }: { children: ReactNode; tone?: "vermilion" | "leaf" | "ink"; className?: string }) {
  const color = tone === "vermilion" ? "var(--vermilion)" : tone === "leaf" ? "var(--leaf)" : "var(--ink)";
  return (
    <span
      className={`font-display inline-block whitespace-nowrap rounded-cut border-[3px] px-3 py-0.5 text-p-title font-extrabold uppercase ${className}`}
      style={{ color, borderColor: color, filter: "url(#ink-rough)", letterSpacing: "0.04em", outline: `1.5px solid ${color}`, outlineOffset: 3 }}
    >
      {children}
    </span>
  );
}

/** A torn slip of paper carrying a stamped verdict, tilted like it was slapped down. */
export function VerdictSlip({ children, tone, seed = 1, tilt = -4 }: { children: ReactNode; tone: "vermilion" | "leaf" | "ink"; seed?: number; tilt?: number }) {
  const clip = useMemo(() => tornClip(seed, { top: true, bottom: true }, 4), [seed]);
  return (
    <span className="cut-drop inline-block" style={{ transform: `rotate(${tilt}deg)` }}>
      <span className="inline-block bg-paper px-5 py-4" style={{ clipPath: clip }}>
        <Stamp tone={tone}>{children}</Stamp>
      </span>
    </span>
  );
}

const RISE = 136;

/**
 * The secret envelope. Closed by default; `open` lifts the flap and slides the
 * chit up. Geometry and timing never depend on what is written on the chit,
 * so watching the motion gives nothing away.
 */
export function Envelope({
  open,
  children,
  seed = 3,
  sealed = true,
  above,
}: {
  open: boolean;
  children: ReactNode;
  seed?: number;
  sealed?: boolean;
  /** Shown in the space the chit rises into; the open chit covers it. Keep it narrower than the chit. */
  above?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const clip = useMemo(() => tornClip(seed, { top: true }, 5), [seed]);
  // The flap sits in front of the chit while closed and behind it once lifted.
  const [flapFront, setFlapFront] = useState(!open);
  useEffect(() => {
    const t = setTimeout(() => setFlapFront(!open), reduce ? 0 : open ? 120 : 210);
    return () => clearTimeout(t);
  }, [open, reduce]);

  return (
    <div className="relative mx-auto w-full max-w-[21rem]" style={{ paddingTop: RISE - 16, perspective: 900 }}>
      {above && (
        <div className="absolute inset-x-[12%] top-0 flex items-end justify-center pb-5" style={{ height: RISE - 16 }}>
          {above}
        </div>
      )}
      <div className="relative aspect-[320/200] w-full" style={{ transform: "rotate(-1.5deg)" }}>
        {/* Hard shadow + back panel with lining */}
        <svg aria-hidden viewBox="0 0 320 200" className="absolute inset-0 h-full w-full overflow-visible">
          <rect x="4" y="4" width="320" height="200" rx="6" fill="#1e1a17" />
          <rect x="0.750" y="0.750" width="318.500" height="198.500" rx="6" fill="url(#env-lining)" stroke="#1e1a17" strokeWidth="1.500" />
        </svg>

        {/* Flap */}
        <motion.div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[58%] origin-top"
          style={{ zIndex: flapFront ? 4 : 1, transformStyle: "preserve-3d" }}
          initial={false}
          animate={{ rotateX: open ? -180 : 0 }}
          transition={open ? { duration: 0.28, ease: ease.out } : { duration: 0.22, ease: ease.out, delay: 0.16 }}
        >
          <svg viewBox="0 0 320 116" className="absolute inset-0 h-full w-full overflow-visible">
            <path d="M-1 0.750h322L170 115a14 14 0 0 1-20 0Z" fill={flapFront ? "#f2b632" : "#e2a425"} stroke="#1e1a17" strokeWidth="1.500" strokeLinejoin="round" />
          </svg>
          {sealed && (
            <motion.div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[38%]"
              initial={false}
              animate={{ opacity: open ? 0 : 1 }}
              transition={{ duration: 0.1, delay: open ? 0.06 : 0.3 }}
            >
              <WaxSeal />
            </motion.div>
          )}
        </motion.div>

        {/* Chit */}
        <motion.div
          className="cut-drop absolute inset-x-[7%] bottom-[5%]"
          style={{ zIndex: 2, height: "82%" }}
          initial={false}
          animate={{ y: open ? -RISE : 0 }}
          transition={open ? { ...spring.sheet, delay: 0.1 } : { duration: 0.2, ease: ease.in }}
        >
          <div className="paper-rule flex h-full flex-col items-center justify-start bg-paper px-3 pt-5 text-center" style={{ clipPath: clip }}>
            {children}
          </div>
        </motion.div>

        {/* Front pocket */}
        <svg aria-hidden viewBox="0 0 320 200" className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 3 }}>
          <path d="M0.750 6V193a6 6 0 0 0 6 6h306.500a6 6 0 0 0 6-6V6L168 112a12 12 0 0 1-16 0Z" fill="#f2b632" stroke="#1e1a17" strokeWidth="1.500" strokeLinejoin="round" />
          <path d="M3 197 138 104M317 197 182 104" stroke="#1e1a17" strokeOpacity="0.28" strokeWidth="1.500" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
