import { COLORS, HOME, SAFE, YARD, loopIndex, type Color } from "./board";

export interface Seat {
  playerId: string;
  color: Color;
}

export interface LudoState {
  seats: Seat[];
  tokens: Partial<Record<Color, number[]>>;
  turn: number;
  phase: "roll" | "move" | "over";
  dice: number | null;
  rollId: number;
  sixes: number;
  movable: number[];
  finished: string[];
  event: { text: string; at: number } | null;
  turnStartedAt: number;
}

export function seatColors(n: number): Color[] {
  if (n <= 2) return ["red", "yellow"].slice(0, n) as Color[];
  if (n === 3) return ["red", "green", "yellow"];
  return COLORS.slice();
}

export function newGame(playerIds: string[], now: number): LudoState {
  const ids = playerIds.slice(0, 4);
  const colors = seatColors(ids.length);
  const seats = ids.map((playerId, i) => ({ playerId, color: colors[i] }));
  const tokens: LudoState["tokens"] = {};
  seats.forEach((s) => (tokens[s.color] = [YARD, YARD, YARD, YARD]));
  return { seats, tokens, turn: 0, phase: "roll", dice: null, rollId: 0, sixes: 0, movable: [], finished: [], event: null, turnStartedAt: now };
}

export function legalMoves(tokens: number[], roll: number): number[] {
  const out: number[] = [];
  tokens.forEach((p, i) => {
    if (p === YARD) {
      if (roll === 6) out.push(i);
    } else if (p < HOME && p + roll <= HOME) out.push(i);
  });
  return out;
}

const event = (text: string, now: number) => ({ text, at: now });

export function nextTurn(s: LudoState, now: number, isPresent: (id: string) => boolean = () => true): LudoState {
  if (s.phase === "over") return s;
  const n = s.seats.length;
  let t = s.turn;
  for (let k = 0; k < n; k++) {
    t = (t + 1) % n;
    const seat = s.seats[t];
    if (!s.finished.includes(seat.playerId) && isPresent(seat.playerId)) break;
  }
  return { ...s, turn: t, phase: "roll", sixes: 0, movable: [], turnStartedAt: now };
}

function finishIfDone(s: LudoState): LudoState {
  const left = s.seats.filter((x) => !s.finished.includes(x.playerId));
  if (left.length <= 1 && s.seats.length > 1) {
    return { ...s, phase: "over", finished: [...s.finished, ...left.map((x) => x.playerId)], movable: [] };
  }
  return s;
}

export function applyMove(s: LudoState, tokenIdx: number, now: number, nameOf: (id: string) => string = (id) => id): LudoState {
  const seat = s.seats[s.turn];
  const roll = s.dice;
  if (!seat || roll === null || s.phase !== "move" || !s.movable.includes(tokenIdx)) return s;
  const mine = s.tokens[seat.color]!.slice();
  const from = mine[tokenIdx];
  const to = from === YARD ? 0 : from + roll;
  mine[tokenIdx] = to;
  const tokens: LudoState["tokens"] = { ...s.tokens, [seat.color]: mine };

  let captured = 0;
  const idx = loopIndex(seat.color, to);
  if (idx !== null && !SAFE.has(idx)) {
    for (const other of s.seats) {
      if (other.color === seat.color) continue;
      const theirs = tokens[other.color]!;
      if (theirs.some((p) => loopIndex(other.color, p) === idx)) {
        tokens[other.color] = theirs.map((p) => {
          if (loopIndex(other.color, p) === idx) {
            captured++;
            return YARD;
          }
          return p;
        });
      }
    }
  }

  const name = nameOf(seat.playerId);
  let next: LudoState = { ...s, tokens, movable: [] };
  let text = from === YARD ? `${name} brings a piece out!` : `${name} moves ${roll}`;
  if (captured) text = `💥 ${name} captured ${captured > 1 ? `${captured} pieces` : "a piece"}!`;
  if (to === HOME) text = `🏠 ${name} got a piece home!`;

  if (mine.every((p) => p === HOME)) {
    next = { ...next, finished: [...next.finished, seat.playerId] };
    text = `🎉 ${name} finished #${next.finished.length}!`;
    next = finishIfDone({ ...next, event: event(text, now) });
    return next.phase === "over" ? next : nextTurn(next, now);
  }
  const extra = roll === 6 || captured > 0 || to === HOME;
  next = { ...next, event: event(extra ? `${text} — roll again!` : text, now) };
  if (extra) return { ...next, phase: "roll", sixes: roll === 6 ? next.sixes : 0, turnStartedAt: now };
  return nextTurn(next, now);
}

export function applyRoll(s: LudoState, roll: number, now: number, nameOf: (id: string) => string = (id) => id): LudoState {
  if (s.phase !== "roll") return s;
  const seat = s.seats[s.turn];
  const name = nameOf(seat.playerId);
  const sixes = roll === 6 ? s.sixes + 1 : 0;
  const rolled: LudoState = { ...s, dice: roll, rollId: s.rollId + 1, sixes };
  if (sixes >= 3) return nextTurn({ ...rolled, event: event(`😬 ${name} rolled three 6s — turn lost!`, now) }, now);
  const movable = legalMoves(s.tokens[seat.color]!, roll);
  if (movable.length === 0) return nextTurn({ ...rolled, event: event(`${name} rolled ${roll} — no moves`, now) }, now);
  const withMoves: LudoState = { ...rolled, phase: "move", movable };
  const distinct = new Set(movable.map((i) => s.tokens[seat.color]![i]));
  if (distinct.size === 1) return applyMove(withMoves, movable[0], now, nameOf);
  return withMoves;
}
