/**
 * Test-mode moves for Dumb Charades. When a simulated player is the actor, it
 * pulls a chit, "acts" for a few seconds, then marks it guessed or passes.
 * Uses the same actions a real phone sends ("start", "got", "pass").
 * Called about once a second by the host's test-mode loop.
 */
export function botMoves(raw: unknown, view: unknown, bots: string[]): { playerId: string; type: string; payload?: unknown }[] {
  void view;
  const s = (raw ?? {}) as { actorId?: string | null; phase?: string; movie?: string | null };
  const actor = s.actorId;
  if (!actor || !bots.includes(actor)) return [];
  if (s.phase === "ready") return Math.random() < 0.5 ? [{ playerId: actor, type: "start" }] : [];
  if (s.phase === "acting" && s.movie) {
    // Roughly 6 seconds of "acting" on average, then mostly a correct guess.
    if (Math.random() > 0.16) return [];
    return [{ playerId: actor, type: Math.random() < 0.75 ? "got" : "pass" }];
  }
  return [];
}
