import type { PunoState } from "./rules";
import { legalJumpIds, legalPlayIds } from "./rules";
import type { Pub } from "./shared";
import type { PunoColor } from "./shared";

type BotMove = { playerId: string; type: string; payload?: unknown };

export function botMoves(raw: unknown, view: unknown, bots: string[]): BotMove[] {
  const s = raw as PunoState | null;
  const v = view as Pub | null;
  if (!s || !v || v.phase !== "playing") return [];
  const out: BotMove[] = [];
  const turnId = v.turnPlayerId;

  for (const b of bots) {
    if (Math.random() > 0.45) continue;
    const hand = s.hands[b] ?? [];
    if (!hand.length) continue;

    if (v.ekBacha?.playerId === b && !v.ekBachaSaid.includes(b) && Math.random() < 0.55) {
      out.push({ playerId: b, type: "ek-bacha" });
      continue;
    }

    if (v.ekBacha && v.ekBacha.playerId !== b && !v.ekBachaSaid.includes(v.ekBacha.playerId) && Math.random() < 0.25) {
      out.push({ playerId: b, type: "pakdo", payload: { who: v.ekBacha.playerId } });
      continue;
    }

    const jumps = legalJumpIds(hand, s.top, s.wildColor, s.stackTotal);
    if (turnId !== b && jumps.length && Math.random() < 0.35) {
      const id = jumps[Math.floor(Math.random() * jumps.length)]!;
      out.push({ playerId: b, type: "jump", payload: { cardId: id, wildColor: pickWild(hand, id) } });
      continue;
    }

    if (turnId !== b) continue;

    const plays = legalPlayIds(hand, s.top, s.wildColor, s.stackTotal);
    if (plays.length) {
      if (hand.length === 2 && !v.ekBachaSaid.includes(b) && Math.random() < 0.75) {
        out.push({ playerId: b, type: "ek-bacha" });
      }
      const id = plays[Math.floor(Math.random() * plays.length)]!;
      out.push({ playerId: b, type: "play", payload: { cardId: id, wildColor: pickWild(hand, id) } });
      continue;
    }

    if (Math.random() < 0.7) out.push({ playerId: b, type: "draw" });
  }

  // Sometimes forget Ek Bacha when down to 1 (handled by not calling before play)
  if (turnId && bots.includes(turnId)) {
    const hand = s.hands[turnId] ?? [];
    if (hand.length === 2 && !v.ekBachaSaid.includes(turnId)) {
      // bias: 20% forget to call even when about to win
    }
  }

  return out.slice(0, 3);
}

function pickWild(hand: { id: string; color: string }[], id: string): PunoColor | undefined {
  const c = hand.find((x) => x.id === id);
  if (!c || c.color !== "wild") return undefined;
  const colors: PunoColor[] = ["haldi", "sindoor", "mehndi", "neel"];
  return colors[Math.floor(Math.random() * colors.length)];
}
