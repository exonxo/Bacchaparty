/**
 * Test mode: simulated players for the host's room.
 *
 * Bots live only in the host's state. They never open a connection, so they
 * can't be spoofed by a real phone (joins with a "bot-" id are refused), and
 * they're removed the moment test mode is switched off.
 */

export const BOT_PREFIX = "bot-";
export const isBot = (id: string) => id.startsWith(BOT_PREFIX);

/** Three bots: with the host that makes 4, which every game accepts (Raja Mantri needs exactly 4). */
export const BOTS = [
  { id: "bot-1", name: "Bunty", avatar: "panda" },
  { id: "bot-2", name: "Pinky", avatar: "rabbit" },
  { id: "bot-3", name: "Golu", avatar: "turtle" },
] as const;

import { botMoves as antakshariBot } from "@/games/antakshari/bot";
import { botMoves as charadesBot } from "@/games/charades/bot";
import { botMoves as drawGuessBot } from "@/games/draw-guess/bot";
import { botMoves as jaldiBot } from "@/games/jaldi-bolo/bot";
import { botMoves as kbcBot } from "@/games/kaun-banega-champion/bot";
import { botMoves as ludoBot } from "@/games/ludo-yatra/bot";
import { botMoves as oddWordBot } from "@/games/odd-word-out/bot";
import { botMoves as rajaBot } from "@/games/raja-mantri/bot";
import { botMoves as soundGuruBot } from "@/games/sound-guru/bot";

/** Games whose bot logic lives next to the game. */
const GAME_BOTS: Record<string, (raw: unknown, view: unknown, bots: string[]) => BotAction[]> = {
  antakshari: antakshariBot,
  charades: charadesBot,
  "draw-guess": drawGuessBot,
  "jaldi-bolo": jaldiBot,
  "kaun-banega-champion": kbcBot,
  "ludo-yatra": ludoBot,
  "odd-word-out": oddWordBot,
  "raja-mantri": rajaBot,
  "sound-guru": soundGuruBot,
};

export interface BotAction {
  playerId: string;
  type: string;
  payload?: unknown;
}

type Rec = Record<string, unknown>;

/**
 * The moves the simulated players make this tick, for the games that have
 * bot support. Games without support simply show the bots sitting in the room.
 * Uses the same action types a real phone sends, so the game logic is what's tested.
 */
export function botActions(gameId: string, raw: unknown, view: unknown, bots: string[]): BotAction[] {
  const own = GAME_BOTS[gameId];
  if (own) return own(raw, view, bots);
  const out: BotAction[] = [];
  const s = (raw ?? {}) as Rec;
  const v = (view ?? {}) as Rec;

  switch (gameId) {
    case "chor-kaun": {
      if (v.phase !== "playing") break;
      const participants = (v.participants as string[]) ?? [];
      const voted = (v.voted as string[]) ?? [];
      for (const b of bots) {
        if (!participants.includes(b) || voted.includes(b) || Math.random() > 0.35) continue;
        const targets = participants.filter((p) => p !== b);
        if (targets.length) out.push({ playerId: b, type: "vote", payload: targets[Math.floor(Math.random() * targets.length)] });
      }
      break;
    }
    case "emoji-picture": {
      if (s.phase !== "question") break;
      const puzzle = (s.puzzles as { answer: string }[] | undefined)?.[s.idx as number];
      const correct = (s.correct as string[]) ?? [];
      if (!puzzle) break;
      for (const b of bots) if (!correct.includes(b) && Math.random() < 0.3) out.push({ playerId: b, type: "answer", payload: puzzle.answer });
      break;
    }
    case "housie": {
      const tickets = (s.tickets ?? {}) as Record<string, number[][]>;
      const called = new Set((s.called as number[]) ?? []);
      const marks = (s.marks ?? {}) as Record<string, number[]>;
      for (const b of bots) {
        const t = tickets[b];
        if (!t) continue;
        const todo = t.flat().filter((n) => n && called.has(n) && !(marks[b] ?? []).includes(n));
        if (todo.length && Math.random() < 0.6) out.push({ playerId: b, type: "mark", payload: todo[0] });
      }
      break;
    }
  }
  return out;
}

export const BOT_GAMES = ["chor-kaun", "emoji-picture", "housie", ...Object.keys(GAME_BOTS)];
