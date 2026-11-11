import type { Player } from "./types";

export interface RoomSnapshot {
  code: string;
  phase: "lobby" | "playing";
  gameId: string | null;
  players: Player[];
  /** Player id of the host's own phone. */
  hostPlayerId: string | null;
  /** Everyone is in one room (true) or spread across places (false). */
  together: boolean;
  view: unknown;
  hostNow: number;
  seq: number;
}

export interface PrivateMessage {
  to: string;
  seq: number;
  data: unknown;
}

export interface JoinMessage {
  id: string;
  name: string;
  avatar: string;
}
