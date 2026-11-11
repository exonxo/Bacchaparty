/**
 * Test-mode moves for simulated players in Raja Mantri Chor Sipahi.
 * Uses the same actions a real phone sends: "pick", "raja", "guess".
 * Called about once a second; the random chances spread moves out so they feel human.
 */
export interface BotMove {
  playerId: string;
  type: string;
  payload?: unknown;
}

type Rec = Record<string, unknown>;

export function botMoves(raw: unknown, _view: unknown, bots: string[]): BotMove[] {
  const s = (raw ?? {}) as Rec;
  const seats = (s.seats as string[]) ?? [];
  const roles = (s.roles as Record<string, string>) ?? {};
  const taken = (s.taken as Record<string, number>) ?? {};
  const out: BotMove[] = [];
  const mine = bots.filter((b) => seats.includes(b));

  switch (s.phase) {
    case "pick": {
      const used = new Set(Object.values(taken));
      const free = [0, 1, 2, 3].filter((i) => !used.has(i));
      for (const b of mine) {
        if (b in taken || !free.length || Math.random() > 0.35) continue;
        const idx = free.splice(Math.floor(Math.random() * free.length), 1)[0];
        out.push({ playerId: b, type: "pick", payload: idx });
      }
      break;
    }
    case "raja": {
      const raja = mine.find((b) => roles[b] === "raja");
      if (raja && Math.random() < 0.3) out.push({ playerId: raja, type: "raja" });
      break;
    }
    case "mantri": {
      const mantri = mine.find((b) => roles[b] === "mantri");
      if (mantri && Math.random() < 0.2) {
        const suspects = seats.filter((id) => roles[id] === "chor" || roles[id] === "sipahi");
        if (suspects.length) out.push({ playerId: mantri, type: "guess", payload: suspects[Math.floor(Math.random() * suspects.length)] });
      }
      break;
    }
  }
  return out;
}
