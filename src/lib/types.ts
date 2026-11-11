import type { ComponentType } from "react";

export type Level = "kids" | "family" | "adults";

export interface Player {
  id: string;
  name: string;
  avatar: string;
  connected: boolean;
}

/** An action sent from a phone (or from the host screen, with playerId === HOST_ID). */
export interface GameAction {
  playerId: string;
  type: string;
  payload?: unknown;
}

export const HOST_ID = "__host";

export interface InitCtx<Opt> {
  players: Player[];
  options: Opt;
  now: number;
}

export interface ReduceCtx {
  players: Player[];
  now: number;
}

export interface ScreenProps<Pub> {
  view: Pub;
  players: Player[];
  /** Dispatch an action as the host (from the big screen). */
  act: (type: string, payload?: unknown) => void;
  /** Current time on the host clock (ms). */
  now: number;
}

export interface ControllerProps<Pub, Priv> {
  view: Pub;
  priv: Priv | undefined;
  me: Player;
  players: Player[];
  send: (type: string, payload?: unknown) => void;
  /** Current time translated to the host clock (ms). */
  now: number;
}

export interface OptionsFormProps<Opt> {
  value: Opt;
  onChange: (next: Opt) => void;
}

/**
 * A game runs entirely on the host device ("host-authoritative").
 * Phones send actions, the host reduces them and broadcasts views.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the registry stores heterogeneous games
export interface GameModule<S = any, Pub = any, Priv = any, Opt = any> {
  id: string;
  defaultOptions: Opt;
  OptionsForm?: ComponentType<OptionsFormProps<Opt>>;
  init(ctx: InitCtx<Opt>): S;
  reduce(state: S, action: GameAction, ctx: ReduceCtx): S;
  /** Called ~2x per second on the host. Return the same object if nothing changed. */
  tick?(state: S, ctx: ReduceCtx): S;
  /** Optional: a player joined the room mid-game. */
  onPlayerJoin?(state: S, player: Player): S;
  publicView(state: S): Pub;
  privateView?(state: S, playerId: string): Priv | undefined;
  Screen: ComponentType<ScreenProps<Pub>>;
  Controller: ComponentType<ControllerProps<Pub, Priv>>;
}

export interface GameInfo {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  category: "Acting & Guessing" | "Bluffing" | "Quiz" | "Board & Luck" | "Music";
  ages: string;
  players: string;
  minPlayers: number;
  maxPlayers: number;
  duration: string;
  description: string;
  howToPlay: string[];
  scoring: string;
  familyTip: string;
  color: string;
}
