"use client";
import { HOST_ID, type ControllerProps, type GameModule, type Player } from "@/lib/types";
import { HOME, YARD, type Color } from "./board";
import { AWAY_SKIP_MS, TURN_MS, type Note, type Pub, type State } from "./helpers";
import { Phone } from "./PaperPhone";
import { Screen } from "./TvScreen";
import { applyMove, applyRoll, newGame, nextTurn } from "./rules";

export type { Pub, State } from "./helpers";

function nameOf(players: Player[], id: string) {
  return players.find((p) => p.id === id)?.name ?? "Player";
}

/* ------------------------------------------------------------------ */
/* Rules wrapper                                                        */
/* ------------------------------------------------------------------ */

const noop = () => {};

/** Phones without host controls (the classic controller path) still get the paper view. */
function Controller(props: ControllerProps<Pub, undefined>) {
  return <Phone {...props} isHost={false} hostAct={noop} together />;
}

/** Works out what just happened, for the animation and the note everyone sees. */
function describe(prev: State, next: State, now: number, players: Player[], auto = false): State {
  const seat = prev.seats[prev.turn];
  if (!seat || next === prev) return next;
  const name = nameOf(players, seat.playerId);
  const rolled = next.rollId !== prev.rollId;
  const before = prev.tokens[seat.color]!;
  const after = next.tokens[seat.color]!;
  const idx = after.findIndex((p, i) => p !== before[i]);
  const again = next.phase === "roll" && next.turn === prev.turn && !next.finished.includes(seat.playerId);
  let note: Note | null = null;
  let lastMove = next.lastMove;

  if (idx >= 0) {
    const captured: { color: Color; idx: number; from: number }[] = [];
    for (const other of prev.seats) {
      if (other.color === seat.color) continue;
      prev.tokens[other.color]!.forEach((p, i) => {
        if (p !== YARD && next.tokens[other.color]![i] === YARD) captured.push({ color: other.color, idx: i, from: p });
      });
    }
    const from = before[idx];
    const to = after[idx];
    lastMove = { id: (prev.lastMove?.id ?? 0) + 1, color: seat.color, idx, from, to, captured, at: now };
    const finished = next.finished.length > prev.finished.length && next.finished.includes(seat.playerId);
    if (finished) note = { kind: "finish", text: `${name} #${next.finished.indexOf(seat.playerId) + 1} pe finish!`, at: now, playerId: seat.playerId };
    else if (captured.length) {
      const victims = [...new Set(captured.map((c) => nameOf(players, prev.seats.find((x) => x.color === c.color)!.playerId)))].join(" aur ");
      note = { kind: "capture", text: `Kat gaya! ${name} ne ${victims} ki goti kaati`, at: now, playerId: seat.playerId };
    } else if (to >= HOME) note = { kind: "home", text: `${name} ki goti ghar pahunchi!`, at: now, playerId: seat.playerId };
    else if (from === YARD) note = { kind: "out", text: `${name} ki goti bahar aayi!`, at: now, playerId: seat.playerId };
    else note = { kind: "move", text: `${name} ne ${to - from} khane chale`, at: now, playerId: seat.playerId };
  } else if (rolled) {
    const three = prev.sixes >= 2 && next.dice === 6;
    note = three
      ? { kind: "three6", text: `Teen baar 6! ${name} ki baari gayi`, at: now, playerId: seat.playerId }
      : { kind: "nomove", text: `${name} ka ${next.dice} — koi chaal nahi`, at: now, playerId: seat.playerId };
  }

  const phaseChanged = next.turn !== prev.turn || next.phase !== prev.phase || next.rollId !== prev.rollId;
  return {
    ...next,
    lastMove,
    note: note ? { ...note, auto, again } : next.note,
    phaseStartedAt: phaseChanged ? now : next.phaseStartedAt,
  };
}

const rollDie = () => 1 + Math.floor(Math.random() * 6);

const game: GameModule<State, Pub, undefined, Record<string, never>> = {
  id: "ludo-yatra",
  paper: true,
  tvPaper: true,
  defaultOptions: {},
  init({ players, now }) {
    return { ...newGame(players.map((p) => p.id), now), phaseStartedAt: now, note: null, lastMove: null };
  },
  reduce(s, a, { now, players }) {
    const name = (id: string) => nameOf(players, id);
    const present = (id: string) => !!players.find((p) => p.id === id)?.connected;
    if (a.playerId === HOST_ID) {
      if (a.type === "skip" && s.phase !== "over") {
        const seat = s.seats[s.turn];
        const next = nextTurn(s, now, present) as State;
        return { ...next, phaseStartedAt: now, note: { kind: "skip", text: `${name(seat.playerId)} ki baari skip`, at: now, playerId: seat.playerId } };
      }
      return s;
    }
    const seat = s.seats[s.turn];
    if (!seat || seat.playerId !== a.playerId) return s;
    if (a.type === "roll") return describe(s, applyRoll(s, rollDie(), now, name) as State, now, players);
    if (a.type === "move") return describe(s, applyMove(s, Number(a.payload), now, name) as State, now, players);
    return s;
  },
  tick(s, { now, players }) {
    if (s.phase === "over") return s;
    const seat = s.seats[s.turn];
    if (!seat) return s;
    const p = players.find((x) => x.id === seat.playerId);
    const present = (id: string) => !!players.find((x) => x.id === id)?.connected;
    if (!p || !p.connected) {
      if (now - s.turnStartedAt <= AWAY_SKIP_MS) return s;
      // If nobody else is around either, just wait.
      if (!s.seats.some((x) => x.playerId !== seat.playerId && present(x.playerId) && !s.finished.includes(x.playerId))) return s;
      const next = nextTurn(s, now, present) as State;
      return { ...next, phaseStartedAt: now, note: { kind: "away", text: `${p?.name ?? "Koi"} offline hai — baari skip`, at: now, playerId: seat.playerId } };
    }
    // Time's up for a player who is here: the game plays their turn for them.
    if (now - (s.phaseStartedAt ?? s.turnStartedAt) >= TURN_MS) {
      const name = (id: string) => nameOf(players, id);
      let next = s.phase === "roll" ? (applyRoll(s, rollDie(), now, name) as State) : s;
      if (next.phase === "move" && next.turn === s.turn && next.movable.length) next = applyMove(next, next.movable[0], now, name) as State;
      return describe(s, next, now, players, true);
    }
    return s;
  },
  publicView(s) {
    return s;
  },
  Screen,
  Controller,
  Phone,
};

export default game;
