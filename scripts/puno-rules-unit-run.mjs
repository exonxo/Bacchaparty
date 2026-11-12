import {
  buildDeck,
  canPlayOnTop,
  cardsIdentical,
  finishRanking,
  legalJumpIds,
  legalPlayIds,
  newGame,
  reduceDraw,
  reduceEkBacha,
  reduceJump,
  reducePakdo,
  reducePass,
  reducePlay,
  reduceTimeout,
  reshuffleDiscard,
} from "../src/games/puno/rules.ts";
import { TURN_MS } from "../src/games/puno/shared.ts";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(buildDeck().length === 108, "108-card deck");

const ids = ["a", "b", "c"];
let s = newGame(ids, 0);
assert(s.hands.a.length === 7, "deal seven");
assert(s.deck.length > 0, "deck remains");

const top = s.top;
const sample = { id: "x", color: top.color, kind: top.kind, value: top.value };
assert(canPlayOnTop(sample, top, s.wildColor, 0), "match top");
assert(cardsIdentical(sample, top), "identical");

// stack + draw (forced state)
const doLeCard = { id: "do-test", color: "haldi", kind: "action", value: "do-le" };
s = {
  ...s,
  turn: 0,
  top: { id: "top", color: "haldi", kind: "number", value: 5 },
  wildColor: null,
  stackTotal: 0,
  hands: { ...s.hands, a: [doLeCard, ...s.hands.a.slice(1)] },
};
s = reducePlay(s, "a", doLeCard.id, null, 100, (id) => id);
assert(s.stackTotal === 2, "do-le opens stack");
const victim = s.seats[s.turn].playerId;
const before = s.hands[victim].length;
s = reduceDraw(s, victim, 200, (id) => id);
assert(s.stackTotal === 0, "stack cleared on draw");
assert((s.hands[victim]?.length ?? 0) === before + 2, "drew stack total");

// two-player ulta behaves like skip (direction still flips but turn advances 2)
s = newGame(["p1", "p2"], 0);
const ulta = s.hands.p1.find((c) => c.value === "ulta");
if (ulta) {
  const turnBefore = s.turn;
  s = reducePlay(s, "p1", ulta.id, null, 300, () => "P");
  assert(s.turn === turnBefore, "2p ulta returns turn to same seat index pattern");
}

// reshuffle
s = newGame(["p1", "p2"], 0);
s = { ...s, deck: [], discard: s.discard.concat(s.deck) };
const shuffled = reshuffleDiscard(s);
assert(shuffled.deck.length > 0, "reshuffle refill");

// ek bacha penalty
s = newGame(["p1", "p2", "p3"], 0);
s = {
  ...s,
  ekBacha: { playerId: "p2", since: 50 },
  hands: { ...s.hands, p2: [{ id: "only", color: "haldi", kind: "number", value: 3 }] },
};
const beforeP2 = s.hands.p2.length;
s = reducePakdo(s, "p3", "p2", 400, () => "X");
assert(s.hands.p2.length === beforeP2 + 2, "pakdo draws two");
assert(!s.ekBacha, "caught clears ek bacha");

// win detection
s = newGame(["w1", "w2"], 0);
const card = s.hands.w1.find((c) => c.kind === "number") ?? s.hands.w1[0];
if (card) {
  s = {
    ...s,
    hands: { ...s.hands, w1: [card] },
    top: { id: "t", color: card.color, kind: card.kind, value: card.value },
    wildColor: null,
    turn: 0,
    seats: s.seats,
  };
  s = reducePlay(s, "w1", card.id, null, 500, () => "W");
  assert(s.phase === "over" && s.winner === "w1", "win when hand empty");
  assert(finishRanking(s, "w1")[0] === "w1", "winner first in ranking");
}

// jump-in
s = newGame(["j1", "j2", "j3"], 0);
const active = s.seats[s.turn].playerId;
const jumper = s.seats.find((x) => x.playerId !== active)?.playerId;
const twin = jumper ? s.hands[jumper]?.find((c) => c.color === s.top.color && c.value === s.top.value && s.top.color !== "wild") : undefined;
if (jumper && twin) {
  const legal = legalJumpIds(s.hands[jumper] ?? [], s.top, s.wildColor, 0);
  assert(legal.includes(twin.id), "jump legal");
  const next = reduceJump(s, jumper, twin.id, null, 600, () => "J");
  assert(next.turn === s.seats.findIndex((x) => x.playerId === jumper), "jump sets turn");
}

s = newGame(["e1", "e2"], 0);
s = { ...s, hands: { ...s.hands, e1: s.hands.e1.slice(0, 2) } };
s = reduceEkBacha(s, "e1", 700, () => "E");
assert(s.ekBachaSaid.includes("e1"), "ek bacha call recorded");

// pass after draw advances turn
s = newGame(["pa", "pb"], 0);
const turnBefore = s.turn;
s = { ...s, drawnThisTurn: true, stackTotal: 0 };
const activePass = s.seats[s.turn].playerId;
s = reducePass(s, activePass, 800);
assert(s.turn !== turnBefore, "pass advances");
assert(!s.drawnThisTurn, "pass clears drawn flag");
console.log("puno-rules-unit: OK");
