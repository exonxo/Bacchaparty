import { HOME, LAST_LOOP, YARD, type Color } from "./board";
import type { LudoState } from "./rules";

/** Muted paper inks for the four seats (readable with ink outlines on cream). */
export const INK_OF: Record<Color, string> = { red: "#c8553d", green: "#3e8e5a", yellow: "#e2b33c", blue: "#3d6fb6" };
/** Text colour that reads on each seat colour. */
export const ON_INK: Record<Color, string> = { red: "#fffdf8", green: "#fffdf8", yellow: "#1e1a17", blue: "#fffdf8" };
export const COLOR_NAME: Record<Color, string> = { red: "Laal", green: "Hara", yellow: "Peela", blue: "Neela" };

/** Each phase of a turn (roll, then pick a piece) gets this long before the game plays for you. */
export const TURN_MS = 20_000;
/** A disconnected player's turn is skipped after this long. */
export const AWAY_SKIP_MS = 10_000;

export type NoteKind = "out" | "move" | "capture" | "home" | "finish" | "three6" | "nomove" | "skip" | "away";

export interface Note {
  kind: NoteKind;
  text: string;
  at: number;
  playerId: string;
  /** The game played this turn because time ran out. */
  auto?: boolean;
  /** The same player rolls again. */
  again?: boolean;
}

export interface LastMove {
  id: number;
  color: Color;
  idx: number;
  from: number;
  to: number;
  captured: { color: Color; idx: number; from: number }[];
  at: number;
}

/** Ludo state plus what the phones need to animate and explain each turn. */
export interface State extends LudoState {
  /** When the current phase (roll or pick) started, on the game clock. */
  phaseStartedAt: number;
  note: Note | null;
  lastMove: LastMove | null;
}

export type Pub = State;

/** Where a piece is, in words. */
export function placeLabel(p: number): string {
  if (p === YARD) return "yard mein";
  if (p >= HOME) return "ghar";
  if (p > LAST_LOOP) return `ghar ki gali ${p - LAST_LOOP}/5`;
  return `khana ${p + 1}`;
}

/** Where a piece lands after `roll`. */
export function landing(p: number, roll: number): number {
  return p === YARD ? 0 : p + roll;
}
