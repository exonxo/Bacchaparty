import { normalize } from "@/lib/util";

/** The five notebook columns. `desi` is what the page shows; `label` is the plain English. */
export const CATEGORIES = [
  { id: "name", desi: "Naam", label: "Name", emoji: "🙋" },
  { id: "place", desi: "Shehar / Jagah", label: "City / Place", emoji: "🏙️" },
  { id: "animal", desi: "Janwar", label: "Animal", emoji: "🐘" },
  { id: "food", desi: "Khana", label: "Food", emoji: "🍛" },
  { id: "film", desi: "Film", label: "Film", emoji: "🎬" },
] as const;
export const N = CATEGORIES.length;

/** Rare starting letters (Q, X, Y, Z) are skipped. */
export const LETTERS = "ABCDEFGHIJKLMNOPRSTUVW".split("");

/** The short "Agla akshar…" shuffle before each letter lands. */
export const SHUFFLE_MS = 1800;

export interface Options {
  seconds: number;
  rounds: number;
}

export type Phase = "answering" | "review" | "final";

export interface Pub {
  phase: Phase;
  round: number;
  rounds: number;
  letter: string;
  /** Seconds per letter (for the timer strip). */
  seconds: number;
  /** When the shuffled letter lands; writing starts then. */
  revealAt: number;
  deadline: number | null;
  participants: string[];
  done: string[];
  /** Only filled during review/final. */
  answers: Record<string, string[]>;
  points: Record<string, number[]>;
  struck: string[];
  /** Totals before this letter while reviewing; final totals at the end. */
  scores: Record<string, number>;
}

export interface Priv {
  answers: string[];
  done: boolean;
}

export function startsWithLetter(answer: string, letter: string) {
  const n = normalize(answer);
  return n.length > 0 && n[0] === letter.toLowerCase();
}
