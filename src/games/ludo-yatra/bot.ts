/**
 * Test-mode bots for Ludo Yatra. Called about once a second by the host; uses
 * the same "roll" and "move" actions a real phone sends. Bots wait a moment
 * (random per tick) so their turns are watchable, and prefer captures and
 * getting pieces home over a random legal move.
 */
import { loopIndex, HOME, SAFE, YARD, type Color } from "./board";
import type { State } from "./helpers";

type BotMove = { playerId: string; type: string; payload?: unknown };

export function botMoves(raw: unknown, _view: unknown, bots: string[]): BotMove[] {
  const s = raw as State | null;
  if (!s || s.phase === "over" || !Array.isArray(s.seats)) return [];
  const seat = s.seats[s.turn];
  if (!seat || !bots.includes(seat.playerId)) return [];

  if (s.phase === "roll") return Math.random() < 0.55 ? [{ playerId: seat.playerId, type: "roll" }] : [];

  if (s.phase === "move" && s.movable.length && s.dice) {
    if (Math.random() < 0.4) return [];
    const mine = s.tokens[seat.color] ?? [];
    const roll = s.dice;
    const score = (i: number) => {
      const from = mine[i];
      const to = from === YARD ? 0 : from + roll;
      if (to === HOME) return 3;
      const idx = loopIndex(seat.color, to);
      if (idx !== null && !SAFE.has(idx)) {
        const hits = s.seats.some(
          (o) => o.color !== seat.color && (s.tokens[o.color as Color] ?? []).some((p) => loopIndex(o.color, p) === idx),
        );
        if (hits) return 4;
      }
      return from === YARD ? 2 : 1 + Math.random();
    };
    const best = [...s.movable].sort((a, b) => score(b) - score(a))[0];
    return [{ playerId: seat.playerId, type: "move", payload: best }];
  }
  return [];
}
