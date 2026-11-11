/** Motion tokens for the paper theme. Durations are in seconds (motion's unit). */
export const ease = {
  /** Default: quick start, soft landing. */
  out: [0.2, 0, 0, 1] as const,
  /** Exits: accelerate away. */
  in: [0.4, 0, 1, 1] as const,
  /** Count-ups and long reveals. */
  expo: [0.16, 1, 0.3, 1] as const,
};

export const dur = {
  pressDown: 0.09,
  pressUp: 0.16,
  select: 0.22,
  sheetOpen: 0.42,
  sheetClose: 0.26,
  screen: 0.32,
  screenExit: 0.18,
  reveal: 0.7,
  count: 1,
  stagger: 0.04,
  staggerMax: 0.3,
};

export const spring = {
  select: { type: "spring", visualDuration: dur.select, bounce: 0.15 } as const,
  sheet: { type: "spring", visualDuration: dur.sheetOpen, bounce: 0.1 } as const,
  settle: { type: "spring", visualDuration: 0.5, bounce: 0.25 } as const,
};

/** Delay for item i in a staggered list, capped so long lists don't drag. */
export function staggerDelay(i: number, base = 0): number {
  return base + Math.min(i * dur.stagger, dur.staggerMax);
}

/** Screen-level enter/exit: fade plus a small shift; exits are faster. */
export const screenIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: dur.screen, ease: ease.out } },
  exit: { opacity: 0, y: -8, transition: { duration: dur.screenExit, ease: ease.in } },
};
