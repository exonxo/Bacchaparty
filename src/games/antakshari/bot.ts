import { START_LETTERS } from "@/content/antakshari";

type Rec = Record<string, unknown>;
export interface BotMove {
  playerId: string;
  type: string;
  payload?: unknown;
}

/**
 * Test-mode moves for Antakshari, using the real player action types:
 * the singing team "sings" after a few seconds, judges mostly vote valid,
 * and the singing team picks the next letter.
 */
export function botMoves(raw: unknown, _view: unknown, bots: string[]): BotMove[] {
  const s = (raw ?? {}) as Rec;
  const teams = (s.teams as [string[], string[]] | undefined) ?? [[], []];
  const turn = s.turn === 1 ? 1 : 0;
  const judging = turn === 0 ? 1 : 0;
  const votes = (s.votes ?? {}) as Record<string, string>;
  const out: BotMove[] = [];
  const singers = bots.filter((b) => teams[turn]?.includes(b));
  const judges = bots.filter((b) => teams[judging]?.includes(b));

  switch (s.phase) {
    case "singing":
      // On average every 4-5 seconds, one bot on the singing team says they sang.
      if (singers.length && Math.random() < 0.2) out.push({ playerId: singers[0], type: "sang" });
      break;
    case "judging":
      for (const b of judges) {
        if (votes[b] || Math.random() > 0.5) continue;
        out.push({ playerId: b, type: "vote", payload: Math.random() < 0.9 ? "valid" : "challenge" });
      }
      break;
    case "next-letter":
      if (singers.length && Math.random() < 0.4) {
        out.push({ playerId: singers[0], type: "letter", payload: START_LETTERS[Math.floor(Math.random() * START_LETTERS.length)] });
      }
      break;
  }
  return out;
}
