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
  /** Read-only display (the optional TV view): hide host controls. */
  spectator?: boolean;
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

/** Phone-first view: shared game view + this player's own controls, on one screen. */
export interface PhoneProps<Pub, Priv> extends ControllerProps<Pub, Priv> {
  /** This phone is the host's: show host controls (next, reveal, skip…). */
  isHost: boolean;
  /** Dispatch a host-only action (same as the big screen's act). */
  hostAct: (type: string, payload?: unknown) => void;
  /** Everyone is in one room (vs. spread across places). */
  together: boolean;
  /** A TV client is connected — phones can hide shared table info. */
  tvOn?: boolean;
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
  /** Big-screen view (legacy host screen / optional TV). */
  Screen: ComponentType<ScreenProps<Pub>>;
  /** Legacy phone controller, used with a big screen. */
  Controller: ComponentType<ControllerProps<Pub, Priv>>;
  /** Redesigned in the paper style. Other games render under the dark theme for now. */
  paper?: boolean;
  /** The big-screen (TV) view is redesigned in paper too. Others keep the night palette on the TV. */
  tvPaper?: boolean;
  /** Phone-first view. When present, phones (host included) show this instead. */
  Phone?: ComponentType<PhoneProps<Pub, Priv>>;
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
  /** One line for players who join a game already in progress. */
  quickTip: string;
  /** Three-line summary shown at the top of dense rules pages. */
  inShort?: string[];
  color: string;
}
