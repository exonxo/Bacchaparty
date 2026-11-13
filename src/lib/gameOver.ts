/**
 * Whether a game has reached its own end (a winner, the last round played).
 * Round-based games that keep going until the host stops them (Chor Kaun,
 * Charades, Antakshari, Raja Mantri, Odd Word Out) never return true.
 */
export function isGameOver(gameId: string | null | undefined, view: unknown): boolean {
  if (!gameId || !view || typeof view !== "object") return false;
  const v = view as { phase?: unknown; done?: unknown };
  switch (gameId) {
    case "kaun-banega-champion":
    case "jaldi-bolo":
      return v.phase === "final";
    case "housie":
      return v.done === true;
    case "puno":
    case "ludo-yatra":
    case "draw-guess":
    case "emoji-picture":
    case "sound-guru":
      return v.phase === "over";
    default:
      return false;
  }
}
