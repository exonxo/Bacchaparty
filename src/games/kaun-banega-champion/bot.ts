/**
 * Test-mode moves for Kaun Banega Champion, using the same actions a real phone sends.
 * The hot-seat bot picks a level and answers (right about 70% of the time);
 * audience bots answer quietly with the same accuracy.
 */
export interface BotMove {
  playerId: string;
  type: string;
  payload?: unknown;
}

const LEVELS = ["kids", "family", "adults"] as const;
const ACCURACY = 0.7;

function guess(answer: number, removed: number[]): number {
  if (Math.random() < ACCURACY) return answer;
  const wrong = [0, 1, 2, 3].filter((i) => i !== answer && !removed.includes(i));
  return wrong.length ? wrong[Math.floor(Math.random() * wrong.length)] : answer;
}

export function botMoves(raw: unknown, _view: unknown, bots: string[]): BotMove[] {
  const s = (raw ?? {}) as {
    phase?: string;
    hotSeat?: string | null;
    question?: { answer: number } | null;
    removed?: number[];
    audience?: Record<string, number>;
  };
  const out: BotMove[] = [];
  const hot = s.hotSeat ?? null;
  const removed = s.removed ?? [];

  if (s.phase === "level" && hot && bots.includes(hot) && Math.random() < 0.5) {
    out.push({ playerId: hot, type: "level", payload: LEVELS[Math.floor(Math.random() * LEVELS.length)] });
  }

  if (s.question && (s.phase === "question" || s.phase === "locked")) {
    const answer = s.question.answer;
    if (s.phase === "question" && hot && bots.includes(hot) && Math.random() < 0.2) {
      out.push({ playerId: hot, type: "answer", payload: guess(answer, removed) });
    }
    const audience = s.audience ?? {};
    for (const b of bots) {
      if (b === hot || audience[b] !== undefined || Math.random() > 0.3) continue;
      out.push({ playerId: b, type: "audience", payload: guess(answer, removed) });
    }
  }
  return out;
}
