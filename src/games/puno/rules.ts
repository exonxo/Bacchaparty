import { shuffle } from "@/lib/util";
import type {
  ActionKind,
  EkBachaState,
  PlayMoment,
  PunoCard,
  PunoColor,
  PunoNote,
  PunoValue,
  Seat,
} from "./shared";
import { TURN_MS } from "./shared";

const COLORS: PunoColor[] = ["haldi", "sindoor", "mehndi", "neel"];
const ACTIONS: ActionKind[] = ["ruk-ja", "ulta", "do-le"];

export interface PunoState {
  seats: Seat[];
  turn: number;
  direction: 1 | -1;
  deck: PunoCard[];
  discard: PunoCard[];
  top: PunoCard;
  wildColor: PunoColor | null;
  hands: Record<string, PunoCard[]>;
  phase: "playing" | "over";
  stackTotal: number;
  turnStartedAt: number;
  winner: string | null;
  ranking: string[];
  note: PunoNote | null;
  lastPlay: PlayMoment | null;
  playId: number;
  ekBacha: EkBachaState | null;
  ekBachaSaid: string[];
  drawnThisTurn: boolean;
}

let cardSerial = 0;
function cid(color: PunoCard["color"], kind: PunoCard["kind"], value: PunoValue) {
  cardSerial += 1;
  return `${color}-${kind}-${String(value)}-${cardSerial}`;
}

export function buildDeck(): PunoCard[] {
  cardSerial = 0;
  const out: PunoCard[] = [];
  for (const color of COLORS) {
    out.push({ id: cid(color, "number", 0), color, kind: "number", value: 0 });
    for (let n = 1; n <= 9; n++) {
      out.push({ id: cid(color, "number", n), color, kind: "number", value: n });
      out.push({ id: cid(color, "number", n), color, kind: "number", value: n });
    }
    for (const action of ACTIONS) {
      out.push({ id: cid(color, "action", action), color, kind: "action", value: action });
      out.push({ id: cid(color, "action", action), color, kind: "action", value: action });
    }
  }
  for (let i = 0; i < 4; i++) {
    out.push({ id: cid("wild", "wild", "rang-badal"), color: "wild", kind: "wild", value: "rang-badal" });
    out.push({ id: cid("wild", "wild", "chaar-le"), color: "wild", kind: "wild", value: "chaar-le" });
  }
  return out;
}

export function effectiveColor(top: PunoCard, wildColor: PunoColor | null): PunoColor | null {
  if (top.color === "wild") return wildColor;
  return top.color;
}

export function cardsIdentical(a: PunoCard, b: PunoCard): boolean {
  if (a.color !== b.color) return false;
  return a.value === b.value;
}

function isPenalty(card: PunoCard): boolean {
  return card.value === "do-le" || card.value === "chaar-le";
}

function canStack(card: PunoCard, stackTotal: number): boolean {
  if (stackTotal <= 0) return false;
  if (card.value === "do-le") return true;
  if (card.value === "chaar-le") return true;
  return false;
}

export function canPlayOnTop(card: PunoCard, top: PunoCard, wildColor: PunoColor | null, stackTotal: number): boolean {
  if (stackTotal > 0) return canStack(card, stackTotal);
  if (card.color === "wild") return true;
  const active = effectiveColor(top, wildColor);
  if (!active) return true;
  if (card.color === active) return true;
  if (card.kind === "number" && top.kind === "number" && card.value === top.value) return true;
  if (card.kind !== "number" && top.kind !== "number" && card.value === top.value) return true;
  if (card.kind === "number" && top.kind === "number" && card.value === top.value) return true;
  if (card.value === top.value) return true;
  return false;
}

export function legalPlayIds(
  hand: PunoCard[],
  top: PunoCard,
  wildColor: PunoColor | null,
  stackTotal: number,
): string[] {
  return hand.filter((c) => canPlayOnTop(c, top, wildColor, stackTotal)).map((c) => c.id);
}

export function legalJumpIds(hand: PunoCard[], top: PunoCard, wildColor: PunoColor | null, stackTotal: number): string[] {
  if (stackTotal > 0) return [];
  const active = effectiveColor(top, wildColor);
  if (!active && top.color !== "wild") return [];
  return hand.filter((c) => top.color !== "wild" && c.color === top.color && c.value === top.value).map((c) => c.id);
}

function drawFromDeck(s: PunoState, n: number): { state: PunoState; drawn: PunoCard[] } {
  let state = { ...s, deck: [...s.deck], discard: [...s.discard], hands: { ...s.hands } };
  const drawn: PunoCard[] = [];
  for (let i = 0; i < n; i++) {
    if (!state.deck.length) state = reshuffleDiscard(state);
    if (!state.deck.length) break;
    const card = state.deck.pop()!;
    drawn.push(card);
  }
  return { state, drawn };
}

export function reshuffleDiscard(s: PunoState): PunoState {
  if (s.deck.length || s.discard.length <= 1) return s;
  const top = s.discard[s.discard.length - 1];
  const rest = s.discard.slice(0, -1);
  return { ...s, deck: shuffle(rest), discard: [top] };
}

function seatAt(s: PunoState, idx: number): Seat | undefined {
  return s.seats[idx];
}

function currentPlayer(s: PunoState): string | null {
  return seatAt(s, s.turn)?.playerId ?? null;
}

function turnSeatIndex(s: PunoState, delta: number): number {
  const n = s.seats.length;
  return (s.turn + delta * s.direction + n * 8) % n;
}

function advanceTurn(s: PunoState, now: number, steps = 1): PunoState {
  let turn = s.turn;
  for (let i = 0; i < steps; i++) turn = turnSeatIndex({ ...s, turn }, 1);
  return { ...s, turn, turnStartedAt: now, drawnThisTurn: false, ekBacha: s.ekBacha };
}

function closeEkBachaWindow(s: PunoState): PunoState {
  if (!s.ekBacha) return s;
  return { ...s, ekBacha: null };
}

function penaltyForCard(card: PunoCard): number {
  if (card.value === "do-le") return 2;
  if (card.value === "chaar-le") return 4;
  return 0;
}

function applySpecials(s: PunoState, card: PunoCard, playerId: string, now: number, nameOf: (id: string) => string): PunoState {
  let next = { ...s };
  const n = next.seats.length;
  const name = nameOf(playerId);
  if (card.value === "ruk-ja") {
    next = advanceTurn(next, now, 2);
    next = { ...next, note: { kind: "play", text: `${name} ne Ruk Ja — agla skip`, at: now, playerId } };
    return next;
  }
  if (card.value === "ulta") {
    if (n === 2) {
      next = advanceTurn(next, now, 2);
      next = { ...next, note: { kind: "play", text: `${name} ne Ulta — do khiladi mein skip`, at: now, playerId } };
    } else {
      next = { ...next, direction: (next.direction * -1) as 1 | -1, note: { kind: "play", text: `${name} ne Ulta — direction palat`, at: now, playerId } };
      next = advanceTurn(next, now, 1);
    }
    return next;
  }
  const pen = penaltyForCard(card);
  if (pen > 0) {
    const total = next.stackTotal + pen;
    next = { ...next, stackTotal: total, note: { kind: "stack", text: `${name} ne +${pen} — kul ${total}`, at: now, playerId } };
    next = advanceTurn(next, now, 1);
    return next;
  }
  next = advanceTurn(next, now, 1);
  return { ...next, note: { kind: "play", text: `${name} ne card daala`, at: now, playerId } };
}

function playOntoDiscard(
  s: PunoState,
  playerId: string,
  card: PunoCard,
  wildColor: PunoColor | null,
  now: number,
  nameOf: (id: string) => string,
  jump = false,
): PunoState {
  const hand = s.hands[playerId] ?? [];
  const nextHand = hand.filter((c) => c.id !== card.id);
  const playId = s.playId + 1;
  const moment: PlayMoment = { id: playId, playerId, card, wildColor, at: now, jump: jump || undefined };
  let next: PunoState = {
    ...s,
    hands: { ...s.hands, [playerId]: nextHand },
    discard: [...s.discard, card],
    top: card,
    wildColor: card.color === "wild" ? wildColor : null,
    lastPlay: moment,
    playId,
    stackTotal: s.stackTotal,
    drawnThisTurn: false,
  };

  if (nextHand.length === 0) {
    const ranking = finishRanking(next, playerId);
    return {
      ...next,
      phase: "over",
      winner: playerId,
      ranking,
      note: { kind: "win", text: `${nameOf(playerId)} jeet gaye!`, at: now, playerId },
      ekBacha: null,
    };
  }

  if (nextHand.length === 1 && !s.ekBachaSaid.includes(playerId)) {
    next = { ...next, ekBacha: { playerId, since: now } };
  } else if (nextHand.length > 1) {
    next = { ...next, ekBacha: next.ekBacha?.playerId === playerId ? null : next.ekBacha };
  }

  if (jump) {
    const idx = next.seats.findIndex((x) => x.playerId === playerId);
    if (idx >= 0) next = { ...next, turn: idx, turnStartedAt: now };
    return resolveAfterPlay(next, card, playerId, now, nameOf, true);
  }

  const wasTurn = currentPlayer(s) === playerId;
  if (!wasTurn) return next;
  return resolveAfterPlay(next, card, playerId, now, nameOf, false);
}

function resolveAfterPlay(s: PunoState, card: PunoCard, playerId: string, now: number, nameOf: (id: string) => string, jump: boolean): PunoState {
  if (s.stackTotal > 0) {
    const pen = penaltyForCard(card);
    const name = nameOf(playerId);
    const total = s.stackTotal + (pen > 0 ? pen : 0);
    return advanceTurn(
      { ...s, stackTotal: total, note: { kind: "stack", text: `${name} ne stack — kul ${total}`, at: now, playerId } },
      now,
      1,
    );
  }
  let next = { ...s, stackTotal: 0 };
  if (jump) next = { ...next, note: { kind: "jump", text: `${nameOf(playerId)} ne jump-in kiya!`, at: now, playerId } };
  return applySpecials(next, card, playerId, now, nameOf);
}

export function finishRanking(s: PunoState, winnerId: string): string[] {
  const rest = s.seats
    .map((x) => x.playerId)
    .filter((id) => id !== winnerId)
    .sort((a, b) => (s.hands[a]?.length ?? 0) - (s.hands[b]?.length ?? 0));
  return [winnerId, ...rest];
}

function flipFirstCard(deck: PunoCard[]): { deck: PunoCard[]; top: PunoCard; wildColor: PunoColor | null } {
  const d = [...deck];
  let top = d.pop()!;
  while (top.color === "wild" || isPenalty(top)) {
    d.unshift(top);
    top = d.pop()!;
  }
  return { deck: d, top, wildColor: null };
}

export function newGame(playerIds: string[], now: number): PunoState {
  const seats = playerIds.slice(0, 10).map((playerId) => ({ playerId }));
  const deck = shuffle(buildDeck());
  const hands: Record<string, PunoCard[]> = {};
  for (const id of playerIds) hands[id] = [];
  let d = [...deck];
  for (let round = 0; round < 7; round++) {
    for (const seat of seats) {
      if (!d.length) break;
      hands[seat.playerId].push(d.pop()!);
    }
  }
  const flipped = flipFirstCard(d);
  d = flipped.deck;
  return {
    seats,
    turn: 0,
    direction: 1,
    deck: d,
    discard: [flipped.top],
    top: flipped.top,
    wildColor: flipped.wildColor,
    hands,
    phase: "playing",
    stackTotal: 0,
    turnStartedAt: now,
    winner: null,
    ranking: [],
    note: null,
    lastPlay: null,
    playId: 0,
    ekBacha: null,
    ekBachaSaid: [],
    drawnThisTurn: false,
  };
}

export function reducePlay(
  s: PunoState,
  playerId: string,
  cardId: string,
  wildColor: PunoColor | null,
  now: number,
  nameOf: (id: string) => string,
): PunoState {
  if (s.phase !== "playing") return s;
  const hand = s.hands[playerId] ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card) return s;
  const myTurn = currentPlayer(s) === playerId;
  if (!myTurn) return s;
  if (!canPlayOnTop(card, s.top, s.wildColor, s.stackTotal)) return s;
  if (card.color === "wild" && !wildColor) return s;
  const next = closeEkBachaWindow(s);
  return playOntoDiscard(next, playerId, card, wildColor, now, nameOf, false);
}

export function reduceJump(
  s: PunoState,
  playerId: string,
  cardId: string,
  wildColor: PunoColor | null,
  now: number,
  nameOf: (id: string) => string,
): PunoState {
  if (s.phase !== "playing" || s.stackTotal > 0) return s;
  if (currentPlayer(s) === playerId) return s;
  const hand = s.hands[playerId] ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card || !cardsIdentical(card, s.top)) return s;
  if (card.color === "wild" && !wildColor) return s;
  return playOntoDiscard(s, playerId, card, wildColor, now, nameOf, true);
}

export function reduceDraw(s: PunoState, playerId: string, now: number, nameOf: (id: string) => string): PunoState {
  if (s.phase !== "playing" || currentPlayer(s) !== playerId) return s;
  if (s.drawnThisTurn && s.stackTotal === 0) return s;
  let next = closeEkBachaWindow(s);
  const n = next.stackTotal > 0 ? next.stackTotal : 1;
  const { state, drawn } = drawFromDeck(next, n);
  next = { ...state, stackTotal: 0, drawnThisTurn: true };
  const hand = [...(next.hands[playerId] ?? []), ...drawn];
  next = { ...next, hands: { ...next.hands, [playerId]: hand } };
  const name = nameOf(playerId);
  next = { ...next, note: { kind: "draw", text: n > 1 ? `${name} ne ${n} cards liye` : `${name} ne 1 card liya`, at: now, playerId } };
  if (n > 1 || !drawn.some((c) => canPlayOnTop(c, next.top, next.wildColor, 0))) {
    next = advanceTurn(next, now, 1);
  }
  return next;
}

export function reducePass(s: PunoState, playerId: string, now: number): PunoState {
  if (s.phase !== "playing" || currentPlayer(s) !== playerId || !s.drawnThisTurn) return s;
  return advanceTurn(closeEkBachaWindow(s), now, 1);
}

export function reduceEkBacha(s: PunoState, playerId: string, now: number, nameOf: (id: string) => string): PunoState {
  const hand = s.hands[playerId] ?? [];
  if (hand.length > 2 && !s.ekBacha?.playerId) return s;
  if (s.ekBachaSaid.includes(playerId)) return s;
  const name = nameOf(playerId);
  return {
    ...s,
    ekBachaSaid: [...s.ekBachaSaid, playerId],
    ekBacha: s.ekBacha?.playerId === playerId ? null : s.ekBacha,
    note: { kind: "ek-bacha", text: `${name}: Ek Bacha!`, at: now, playerId },
  };
}

export function reducePakdo(s: PunoState, catcherId: string, targetId: string, now: number, nameOf: (id: string) => string): PunoState {
  if (s.phase !== "playing" || catcherId === targetId) return s;
  if (!s.ekBacha || s.ekBacha.playerId !== targetId) return s;
  if (s.ekBachaSaid.includes(targetId)) return s;
  const { state, drawn } = drawFromDeck(s, 2);
  const hand = [...(state.hands[targetId] ?? []), ...drawn];
  const next = {
    ...state,
    hands: { ...state.hands, [targetId]: hand },
    ekBacha: null,
    note: { kind: "pakdo" as const, text: `${nameOf(catcherId)} ne pakda! ${nameOf(targetId)} +2`, at: now, playerId: catcherId },
  };
  return next;
}

export function reduceTimeout(s: PunoState, now: number, nameOf: (id: string) => string): PunoState {
  if (s.phase !== "playing") return s;
  const pid = currentPlayer(s);
  if (!pid) return s;
  if (now - s.turnStartedAt < TURN_MS) return s;
  const played = legalPlayIds(s.hands[pid] ?? [], s.top, s.wildColor, s.stackTotal);
  if (played.length && s.stackTotal === 0) {
    const card = (s.hands[pid] ?? []).find((c) => c.id === played[0])!;
    let wild: PunoColor | null = null;
    if (card.color === "wild") wild = "haldi";
    return { ...reducePlay(s, pid, card.id, wild, now, nameOf), note: { kind: "timeout", text: `${nameOf(pid)} — time up, auto play`, at: now, playerId: pid } };
  }
  return { ...reduceDraw(s, pid, now, nameOf), note: { kind: "timeout", text: `${nameOf(pid)} — time up, auto draw`, at: now, playerId: pid } };
}

export function privForPlayer(s: PunoState, playerId: string) {
  const hand = s.hands[playerId] ?? [];
  const myTurn = currentPlayer(s) === playerId;
  const playable = myTurn ? legalPlayIds(hand, s.top, s.wildColor, s.stackTotal) : [];
  const jumpable = !myTurn ? legalJumpIds(hand, s.top, s.wildColor, s.stackTotal) : [];
  return { hand, playable, jumpable };
}
