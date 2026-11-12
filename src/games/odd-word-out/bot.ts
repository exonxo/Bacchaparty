/**
 * Test-mode moves for Odd Word Out, using the same actions a real phone sends:
 * bots vote during voting, and a caught bot Imposter guesses the word.
 */
type Move = { playerId: string; type: string; payload?: unknown };

const WRONG_GUESSES = ["Pata nahi", "Samosa", "Cricket", "Chai"];

export function botMoves(raw: unknown, _view: unknown, bots: string[]): Move[] {
  const s = (raw ?? {}) as {
    phase?: string;
    participants?: string[];
    votes?: Record<string, string>;
    imposterId?: string;
    majorityWord?: string;
  };
  const out: Move[] = [];
  const participants = s.participants ?? [];

  if (s.phase === "vote") {
    const votes = s.votes ?? {};
    for (const b of bots) {
      if (!participants.includes(b) || b in votes || Math.random() > 0.3) continue;
      const others = participants.filter((p) => p !== b);
      if (!others.length) continue;
      // Bots that aren't the Imposter lean towards the real Imposter, so rounds can end either way.
      const target = b !== s.imposterId && s.imposterId && Math.random() < 0.45 ? s.imposterId : others[Math.floor(Math.random() * others.length)];
      if (target !== b) out.push({ playerId: b, type: "vote", payload: target });
    }
  }

  if (s.phase === "imposter-guess" && s.imposterId && bots.includes(s.imposterId) && Math.random() < 0.25) {
    const guess = Math.random() < 0.4 && s.majorityWord ? s.majorityWord : WRONG_GUESSES[Math.floor(Math.random() * WRONG_GUESSES.length)];
    out.push({ playerId: s.imposterId, type: "guess", payload: guess });
  }

  return out;
}
