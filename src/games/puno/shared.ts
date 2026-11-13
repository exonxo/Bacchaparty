/** Shared types for Puno — a shedding card game (no third-party card-game branding). */

export type PunoColor = "haldi" | "sindoor" | "mehndi" | "neel";

export type ActionKind = "ruk-ja" | "ulta" | "do-le";

export type WildKind = "rang-badal" | "chaar-le" | "rishtedaar";

export type PunoValue = number | ActionKind | WildKind;

export interface PunoCard {
  id: string;
  color: PunoColor | "wild";
  kind: "number" | "action" | "wild";
  value: PunoValue;
}

export const COLOR_LABEL: Record<PunoColor, string> = {
  haldi: "Haldi",
  sindoor: "Sindoor",
  mehndi: "Mehndi",
  neel: "Neel",
};

export const COLOR_INK: Record<PunoColor, string> = {
  haldi: "#f2b632",
  sindoor: "#c23a22",
  mehndi: "#2f7d4f",
  neel: "#1d4ed8",
};

export const ACTION_LABEL: Record<ActionKind | WildKind, string> = {
  "ruk-ja": "Ruk Ja",
  ulta: "Ulta",
  "do-le": "Do Le",
  "rang-badal": "Rang Badal",
  "chaar-le": "Chaar Le",
  rishtedaar: "Rishtedaar",
};

/** Each turn gets this long before the game draws for you. */
export const TURN_MS = 20_000;

export type Phase = "playing" | "over";

export interface Seat {
  playerId: string;
}

export interface EkBachaState {
  /** Player who may be caught for forgetting the call. */
  playerId: string;
  /** Set when they reached one card without calling. */
  since: number;
}

export interface PlayMoment {
  id: number;
  playerId: string;
  card: PunoCard;
  /** Colour chosen when a wild was played. */
  wildColor: PunoColor | null;
  at: number;
  jump?: boolean;
  /** Rishtedaar: the player whose hand was swapped with the player who played it. */
  swapWith?: string;
}

export interface PunoNote {
  kind: "play" | "draw" | "stack" | "ek-bacha" | "pakdo" | "win" | "jump" | "timeout" | "swap";
  text: string;
  at: number;
  playerId: string;
}

export interface Pub {
  phase: Phase;
  seats: Seat[];
  turn: number;
  direction: 1 | -1;
  top: PunoCard;
  /** Up to five cards under the top card in the discard pile (for the messy spread). */
  discardUnder: PunoCard[];
  /** Active colour when the top card is wild. */
  wildColor: PunoColor | null;
  counts: Record<string, number>;
  stackTotal: number;
  /** Current player may respond to a stack only with penalty cards. */
  stackPending: boolean;
  turnPlayerId: string;
  turnStartedAt: number;
  deadline: number;
  winner: string | null;
  ranking: string[];
  note: PunoNote | null;
  lastPlay: PlayMoment | null;
  ekBacha: EkBachaState | null;
  /** Players who called Ek Bacha this round (public, for TV flair). */
  ekBachaSaid: string[];
}

export interface Priv {
  hand: PunoCard[];
  /** Card ids you may play on your turn (or jump-in). */
  playable: string[];
  /** You may jump in with these ids right now. */
  jumpable: string[];
  /** Drew this turn and may end without playing. */
  canPass: boolean;
}
