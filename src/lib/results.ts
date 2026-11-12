import { getGameInfo } from "@/games/catalog";
import type { Player } from "./types";

/** One line of a finished game's scorecard: a player or a team. */
export interface ResultRow {
  name: string;
  /** Avatar ids to show (one for a player, several for a team). */
  avatars: string[];
  /** Points, or null when the game ranks by finishing order (Ludo). */
  score: number | null;
  place: number;
}

/** What everyone sees in the lobby after a game ends. */
export interface GameResult {
  id: string;
  gameId: string;
  gameName: string;
  kind: "players" | "teams";
  rows: ResultRow[];
}

const TEAM_NAMES = ["Laddoo", "Jalebi"];

function rank(rows: Omit<ResultRow, "place">[]): ResultRow[] {
  const sorted = [...rows].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  let place = 0;
  let last: number | null = NaN;
  return sorted.map((r, i) => {
    if (r.score !== last) place = i + 1;
    last = r.score;
    return { ...r, place };
  });
}

/**
 * Builds the scorecard from a game's public view. Understands the three score
 * shapes the games use: points per player, points per team, or a finishing order.
 * Returns null when there's nothing worth showing (no points scored yet).
 */
export function summarizeGame(gameId: string, view: unknown, players: Player[], now: number): GameResult | null {
  if (!view || typeof view !== "object") return null;
  const v = view as Record<string, unknown>;
  const byId = new Map(players.map((p) => [p.id, p]));
  const gameName = getGameInfo(gameId)?.name ?? gameId;
  const base = { id: `${gameId}-${now}`, gameId, gameName };

  // Teams: Charades uses { A: [...], B: [...] }, Antakshari uses [[...], [...]].
  if (v.teams && v.scores && typeof v.scores === "object") {
    const teamIds: string[][] = Array.isArray(v.teams) ? (v.teams as string[][]) : [(v.teams as Record<string, string[]>).A ?? [], (v.teams as Record<string, string[]>).B ?? []];
    const scores: number[] = Array.isArray(v.scores) ? (v.scores as number[]) : [(v.scores as Record<string, number>).A ?? 0, (v.scores as Record<string, number>).B ?? 0];
    if (scores.every((n) => !n)) return null;
    const rows = teamIds.map((ids, i) => ({
      name: `Team ${TEAM_NAMES[i] ?? i + 1}`,
      avatars: ids.map((id) => byId.get(id)?.avatar ?? "").filter(Boolean),
      score: scores[i] ?? 0,
    }));
    return { ...base, kind: "teams", rows: rank(rows) };
  }

  // Finishing order (Ludo).
  if (Array.isArray(v.finished) && !v.scores) {
    const order = (v.finished as string[]).filter((id) => byId.has(id));
    if (!order.length) return null;
    return {
      ...base,
      kind: "players",
      rows: order.map((id, i) => ({ name: byId.get(id)!.name, avatars: [byId.get(id)!.avatar], score: null, place: i + 1 })),
    };
  }

  // Points per player.
  if (v.scores && typeof v.scores === "object" && !Array.isArray(v.scores)) {
    const entries = Object.entries(v.scores as Record<string, number>).filter(([id]) => byId.has(id));
    if (!entries.length || entries.every(([, n]) => !n)) return null;
    const rows = entries.map(([id, n]) => ({ name: byId.get(id)!.name, avatars: [byId.get(id)!.avatar], score: typeof n === "number" ? n : 0 }));
    return { ...base, kind: "players", rows: rank(rows) };
  }
  return null;
}
