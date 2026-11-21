/**
 * Test-mode moves for simulated players in Spin the Bottle.
 * Uses the same actions a real phone sends: "spin", "pick", "flip", "done", "pass", "react".
 */
export interface BotMove {
  playerId: string;
  type: string;
  payload?: unknown;
}

type Rec = Record<string, unknown>;

export function botMoves(raw: unknown, _view: unknown, bots: string[]): BotMove[] {
  const s = (raw ?? {}) as Rec;
  const turn = (s.turn ?? {}) as Rec;
  const holder = turn.holder as string | null;
  const target = turn.target as string | null;
  const out: BotMove[] = [];

  switch (s.phase) {
    case "ready":
      if (holder && bots.includes(holder) && Math.random() < 0.4) out.push({ playerId: holder, type: "spin" });
      break;
    case "choose":
      if (target && bots.includes(target) && Math.random() < 0.4) out.push({ playerId: target, type: "pick", payload: Math.random() < 0.5 ? "truth" : "dare" });
      break;
    case "card":
      if (target && bots.includes(target)) {
        const r = Math.random();
        if (r < 0.08 && !turn.flipped) out.push({ playerId: target, type: "flip" });
        else if (r < 0.2) out.push({ playerId: target, type: "done" });
        else if (r < 0.24) out.push({ playerId: target, type: "pass" });
      } else if (bots.length && Math.random() < 0.15) {
        const b = bots[Math.floor(Math.random() * bots.length)];
        out.push({ playerId: b, type: "react", payload: ["😂", "🔥", "👏"][Math.floor(Math.random() * 3)] });
      }
      break;
  }
  return out;
}
