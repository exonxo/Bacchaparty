/**
 * Test-mode moves for Sound Guru, using the same actions a phone sends.
 * As the Sound Maker: start the timer, and reveal after a while.
 * As a guesser: sometimes guess right, sometimes guess wrong.
 */
export interface BotMove {
  playerId: string;
  type: string;
  payload?: unknown;
}

type Rec = Record<string, unknown>;

const WRONG = ["pressure cooker", "doorbell", "train", "cow", "phone", "baby", "auto"];

export function botMoves(raw: unknown, view: unknown, bots: string[]): BotMove[] {
  const s = (raw ?? {}) as Rec;
  const v = (view ?? {}) as Rec;
  const out: BotMove[] = [];
  const maker = (v.makerId as string | null) ?? null;
  const phase = v.phase as string | undefined;
  const prompt = s.prompt as { sound: string } | null | undefined;
  const correct = (s.correct as string[] | undefined) ?? [];

  if (maker && bots.includes(maker)) {
    if (phase === "ready" && Math.random() < 0.4) out.push({ playerId: maker, type: "start" });
    // Reveal after roughly 25 seconds of making the sound.
    const start = v.roundStart as number | null;
    if (phase === "making" && start && Date.now() - start > 25_000 && Math.random() < 0.3) out.push({ playerId: maker, type: "reveal" });
  }

  if (phase === "making" && prompt) {
    for (const b of bots) {
      if (b === maker || correct.includes(b)) continue;
      const r = Math.random();
      if (r < 0.12) out.push({ playerId: b, type: "guess", payload: prompt.sound });
      else if (r < 0.18) out.push({ playerId: b, type: "guess", payload: WRONG[Math.floor(Math.random() * WRONG.length)] });
    }
  }
  return out;
}
