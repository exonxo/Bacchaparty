/**
 * Test-mode bots for Draw & Guess. Uses the same actions a real phone sends
 * ("choose", "stroke", "guess"), so the game logic is what gets exercised.
 * Called about once a second by the host while test mode is on.
 */
import { COLORS } from "./shared";

interface Raw {
  phase?: string;
  drawers?: string[];
  turn?: number;
  word?: string | null;
  strokes?: { p: number[] }[];
  correct?: string[];
  startedAt?: number;
  deadline?: number;
}

export interface BotMove {
  playerId: string;
  type: string;
  payload?: unknown;
}

const WRONG = ["Ghar", "Chai", "Kutta", "Phool", "Gaadi", "Pankha", "Samosa", "Billi"];

function squiggle(): number[] {
  const p: number[] = [];
  let x = 250 + Math.random() * 500;
  let y = 250 + Math.random() * 500;
  for (let i = 0; i < 10; i++) {
    x = Math.max(40, Math.min(960, x + (Math.random() - 0.5) * 140));
    y = Math.max(40, Math.min(960, y + (Math.random() - 0.5) * 140));
    p.push(Math.round(x), Math.round(y));
  }
  return p;
}

export function botMoves(raw: unknown, _view: unknown, bots: string[]): BotMove[] {
  const s = (raw ?? {}) as Raw;
  const out: BotMove[] = [];
  const drawers = s.drawers ?? [];
  const drawer = drawers.length ? drawers[(s.turn ?? 0) % drawers.length] : null;
  const botDraws = !!drawer && bots.includes(drawer);

  if (s.phase === "choosing" && botDraws && Math.random() < 0.5) {
    out.push({ playerId: drawer!, type: "choose", payload: Math.floor(Math.random() * 3) });
  }

  if (s.phase === "drawing") {
    const strokes = s.strokes ?? [];
    if (botDraws && strokes.length < 10 && Math.random() < 0.6) {
      out.push({ playerId: drawer!, type: "stroke", payload: { s: strokes.length, c: Math.floor(Math.random() * COLORS.length), w: 1, p: squiggle() } });
    }
    const word = s.word?.split("|")[0];
    const elapsed = (Date.now() - (s.startedAt ?? Date.now())) / Math.max(1, (s.deadline ?? 0) - (s.startedAt ?? 0));
    for (const b of bots) {
      if (b === drawer || (s.correct ?? []).includes(b)) continue;
      const r = Math.random();
      if (word && elapsed > 0.2 && r < 0.07) out.push({ playerId: b, type: "guess", payload: word });
      else if (r > 0.95) out.push({ playerId: b, type: "guess", payload: WRONG[Math.floor(Math.random() * WRONG.length)] });
    }
  }
  return out;
}
