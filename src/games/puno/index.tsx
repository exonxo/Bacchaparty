"use client";
import { HOST_ID, type ControllerProps, type GameModule, type Player } from "@/lib/types";
import { Phone } from "./PaperPhone";
import { TvScreen } from "./TvScreen";
import {
  newGame,
  privForPlayer,
  reduceDraw,
  reduceEkBacha,
  reduceJump,
  reducePakdo,
  reducePass,
  reducePlay,
  reduceTimeout,
  type PunoState,
} from "./rules";
import type { Priv, Pub, PunoColor } from "./shared";
import { TURN_MS } from "./shared";

export type { Pub, Priv } from "./shared";

function nameOf(players: Player[], id: string) {
  return players.find((p) => p.id === id)?.name ?? "Khiladi";
}

function toPub(s: PunoState): Pub {
  const turnPlayerId = s.seats[s.turn]?.playerId ?? "";
  const counts: Record<string, number> = {};
  for (const seat of s.seats) counts[seat.playerId] = s.hands[seat.playerId]?.length ?? 0;
  return {
    phase: s.phase,
    seats: s.seats,
    turn: s.turn,
    direction: s.direction,
    top: s.top,
    wildColor: s.wildColor,
    counts,
    stackTotal: s.stackTotal,
    stackPending: s.stackTotal > 0,
    turnPlayerId,
    turnStartedAt: s.turnStartedAt,
    deadline: s.turnStartedAt + TURN_MS,
    winner: s.winner,
    ranking: s.ranking,
    note: s.note,
    lastPlay: s.lastPlay,
    ekBacha: s.ekBacha,
    ekBachaSaid: s.ekBachaSaid,
  };
}

const noop = () => {};

function Controller(props: ControllerProps<Pub, Priv>) {
  return <Phone {...props} isHost={false} hostAct={noop} tvOn={false} together />;
}

const puno: GameModule<PunoState, Pub, Priv, Record<string, never>> = {
  id: "puno",
  paper: true,
  tvPaper: true,
  defaultOptions: {},
  init({ players, now }) {
    return newGame(
      players.map((p) => p.id),
      now,
    );
  },
  onPlayerJoin(s, p) {
    if (s.phase !== "playing" || p.id in s.hands) return s;
    return { ...s, seats: [...s.seats, { playerId: p.id }], hands: { ...s.hands, [p.id]: [] } };
  },
  reduce(s, a, { now, players }) {
    const names = (id: string) => nameOf(players, id);
    if (a.playerId === HOST_ID) return s;
    if (a.type === "play") {
      const payload = a.payload as { cardId: string; wildColor?: PunoColor } | undefined;
      if (!payload?.cardId) return s;
      return reducePlay(s, a.playerId, payload.cardId, payload.wildColor ?? null, now, names);
    }
    if (a.type === "jump") {
      const payload = a.payload as { cardId: string; wildColor?: PunoColor } | undefined;
      if (!payload?.cardId) return s;
      return reduceJump(s, a.playerId, payload.cardId, payload.wildColor ?? null, now, names);
    }
    if (a.type === "draw") return reduceDraw(s, a.playerId, now, names);
    if (a.type === "pass") return reducePass(s, a.playerId, now);
    if (a.type === "ek-bacha") return reduceEkBacha(s, a.playerId, now, names);
    if (a.type === "pakdo") {
      const target = String((a.payload as { who?: string })?.who ?? "");
      if (!target) return s;
      return reducePakdo(s, a.playerId, target, now, names);
    }
    return s;
  },
  tick(s, { now, players }) {
    if (s.phase !== "playing") return s;
    const pid = s.seats[s.turn]?.playerId;
    if (!pid) return s;
    const p = players.find((x) => x.id === pid);
    if (p && !p.connected) return s;
    return reduceTimeout(s, now, (id) => nameOf(players, id));
  },
  publicView(s) {
    return toPub(s);
  },
  privateView(s, id) {
    if (s.phase !== "playing" || !(id in s.hands)) return undefined;
    return privForPlayer(s, id);
  },
  Screen: TvScreen,
  Controller,
  Phone,
};

export default puno;
