import type { Sealed } from "./secure";
import type { Player } from "./types";

/** The room state every device sees. Sent by the host, signed. */
export interface RoomSnapshot {
  code: string;
  phase: "lobby" | "playing" | "closed";
  gameId: string | null;
  players: Player[];
  /** Player id of the host's own phone. */
  hostPlayerId: string | null;
  /** Everyone is in one room (true) or spread across places (false). */
  together: boolean;
  view: unknown;
  /** Host game clock (pauses while the host's phone is in the background). */
  hostNow: number;
  /** Start time of this host session; a newer session replaces an older one. */
  epoch: number;
  seq: number;
  /** Host's key-exchange public key, used to encrypt private messages. */
  hostEcdh: string;
  /** Players the host removed; their phones stop rejoining. */
  kicked: string[];
  /** Scorecard of the last game that ended (lobby). */
  lastResult?: import("./results").GameResult | null;
}

/** Bumped whenever the messages below change shape. Devices on different versions can't play together. */
export const PROTOCOL = 3;

/** "room" event: the snapshot as JSON text, its signature and the signing key. */
export interface SignedRoom {
  v?: number;
  d: string;
  s: string;
  k: string;
}

/** "private" event: one player's secret view, encrypted for them. Plaintext: PrivateBody. */
export interface PrivateEnvelope extends Sealed {
  to: string;
}
export interface PrivateBody {
  epoch: number;
  seq: number;
  data: unknown;
}

/** "join" event. `pk` is the phone's key-exchange public key; the rest is encrypted. Plaintext: JoinBody. */
export interface JoinEnvelope extends Sealed {
  v?: number;
  id: string;
  pk: string;
}
export interface JoinBody {
  name: string;
  avatar: string;
}

/** "action" event: encrypted so only the real player can act as themselves. Plaintext: ActionBody. */
export interface ActionEnvelope extends Sealed {
  from: string;
}
export interface ActionBody {
  n: number;
  type: string;
  payload?: unknown;
}

/** Reserved action: the player leaves the room on purpose. */
export const LEAVE_ACTION = "__leave";
