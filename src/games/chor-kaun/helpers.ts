import type { Player } from "@/lib/types";
import type { Pub, Result } from "./index";

export function fmt(left: number) {
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

export function nameOf(players: Player[], id: string | null | undefined) {
  return players.find((p) => p.id === id)?.name ?? "Someone";
}

export function resultText(r: Result, players: Player[], chorId: string): string {
  const chor = nameOf(players, chorId);
  if (r.reason === "guess") return r.chorGuessCorrect ? `${chor} guessed the place — the Chor wins!` : `${chor} guessed “${r.chorGuess}” — wrong! Chor caught!`;
  if (r.caught) return `The Chor was caught — it was ${chor}!`;
  if (!r.accused) return `No clear vote — ${chor} the Chor escapes!`;
  return `${nameOf(players, r.accused)} was innocent! ${chor} the Chor escapes!`;
}

export function chorWon(r: Result): boolean {
  return r.reason === "guess" ? r.chorGuessCorrect : !r.caught;
}

/** Did this player win the round that was just revealed? */
export function iWon(r: NonNullable<Pub["reveal"]>, meId: string): boolean {
  return r.chorId === meId ? chorWon(r.result) : !chorWon(r.result);
}

/** Points each participant earned this round (mirrors the reducer's scoring). */
export function roundGains(reveal: NonNullable<Pub["reveal"]>, participants: string[]): Record<string, number> {
  const gains: Record<string, number> = {};
  const r = reveal.result;
  for (const id of participants) {
    const isChor = id === reveal.chorId;
    if (r.reason === "guess") gains[id] = r.chorGuessCorrect ? (isChor ? 3 : 0) : isChor ? 0 : 1;
    else gains[id] = r.caught ? (isChor ? 0 : 1) : isChor ? 2 : 0;
  }
  return gains;
}
