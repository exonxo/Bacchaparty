/** Types and constants shared by the game logic and its phone view. */
export type Phase = "question" | "reveal" | "over";

/** Points for the 1st and 2nd correct answers; everyone after gets 1. */
export const POINTS = [3, 2];

export interface Pub {
  idx: number;
  total: number;
  phase: Phase;
  emojis: string;
  category: string;
  hint: string;
  hintAt: number;
  seconds: number;
  deadline: number;
  revealUntil: number | null;
  correct: string[];
  tries: Record<string, number>;
  scores: Record<string, number>;
  answer: string | null;
}
