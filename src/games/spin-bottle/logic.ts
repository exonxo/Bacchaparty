import { BOTTLE_PROMPTS, TONE_INFO, isBottleTone, type BottleKind, type BottlePrompt, type BottleTone } from "@/content/spin-bottle";
import { breaksBottleRules } from "@/lib/suggest/bottle";
import { HOST_ID, type GameAction, type Player } from "@/lib/types";
import { shuffle } from "@/lib/util";

/**
 * Spin the Bottle. The host device runs this reducer.
 *
 * ready → (holder spins) → spinning → (bottle stops) → choose → (target picks Sach/Himmat) → card
 * Each card has two sides: a prompt and an alternate. The target can flip between them, then
 * taps Done or Pass. Passing is always free. There are no points.
 */

export type Phase = "ready" | "spinning" | "choose" | "card";

export interface Options {
  tone: BottleTone;
}

/** How long the bottle spins. The result is decided before the animation starts. */
export const SPIN_MS = 2_800;
/** Social dares appear on roughly 1 in this many dares, and at most once per game. */
export const SOCIAL_ODDS = 12;
/** Ask the AI for more when a pile gets this low. */
export const LOW_WATER = 6;
export const REACTIONS = ["😂", "🔥", "👏", "😱", "💀", "🙈"] as const;
const REACTION_MS = 3_500;

export interface Reaction {
  id: number;
  from: string;
  emoji: string;
  at: number;
}

export interface Turn {
  n: number;
  /** Who holds the bottle and spins next (the last person picked). Null before the first spin. */
  holder: string | null;
  target: string | null;
  /** The circle of players at the moment of the spin, clockwise from the top. */
  seats: string[];
  /** Total bottle rotation in degrees. Only grows, so the animation always spins forward. */
  rotation: number;
  spinEnd: number;
  kind: BottleKind | null;
  card: [BottlePrompt, BottlePrompt] | null;
  side: 0 | 1;
  flipped: boolean;
  /** The last card's result, shown while waiting for the next spin. */
  outcome: { target: string; kind: BottleKind; result: "done" | "pass" } | null;
}

export interface State {
  tone: BottleTone;
  phase: Phase;
  turn: Turn;
  /** Players still to be picked this cycle, so everyone gets a turn before anyone repeats. */
  bag: string[];
  queue: Record<BottleKind, BottlePrompt[]>;
  /** Lower-cased texts already dealt this game. */
  used: string[];
  socialUsed: boolean;
  /** Players who switched off social dares. Never shown to others. */
  noSocial: string[];
  reactions: Reaction[];
  reactionSeq: number;
  /** Texts reported this game, so the host device can avoid them next time. */
  reported: string[];
  stats: { done: number; pass: number };
}

export interface Pub {
  tone: BottleTone;
  adult: boolean;
  phase: Phase;
  n: number;
  holder: string | null;
  target: string | null;
  seats: string[];
  rotation: number;
  spinEnd: number;
  kind: BottleKind | null;
  card: { text: string; social: boolean; side: 0 | 1; flipped: boolean } | null;
  outcome: Turn["outcome"];
  reactions: Reaction[];
  /** The host device should fetch more prompts. */
  needMore: boolean;
  reported: string[];
  stats: { done: number; pass: number };
}

export interface Priv {
  noSocial: boolean;
}

const key = (t: string) => t.trim().toLowerCase();

function deckFor(tone: BottleTone, kind: BottleKind, used: Set<string>): BottlePrompt[] {
  const all = BOTTLE_PROMPTS[tone].filter((p) => p.kind === kind);
  const fresh = all.filter((p) => !used.has(key(p.text)));
  return shuffle(fresh.length >= 4 ? fresh : all);
}

export function initState(tone: BottleTone, players: Player[]): State {
  const t = isBottleTone(tone) ? tone : "family";
  return {
    tone: t,
    phase: "ready",
    turn: { n: 0, holder: null, target: null, seats: circleOf(players), rotation: 0, spinEnd: 0, kind: null, card: null, side: 0, flipped: false, outcome: null },
    bag: [],
    queue: { truth: deckFor(t, "truth", new Set()), dare: deckFor(t, "dare", new Set()) },
    used: [],
    socialUsed: false,
    noSocial: [],
    reactions: [],
    reactionSeq: 0,
    reported: [],
    stats: { done: 0, pass: 0 },
  };
}

function circleOf(players: Player[]): string[] {
  return players.filter((p) => p.connected).map((p) => p.id);
}

/**
 * Picks who the bottle lands on: the first person in the bag who isn't holding the bottle.
 * The holder stays in the bag for later, so nobody loses their turn by spinning.
 */
function chooseTarget(s: State, online: string[]): { target: string; bag: string[] } | null {
  const holder = s.turn.holder;
  if (!online.some((id) => id !== holder)) return null;
  let bag = s.bag.filter((id) => online.includes(id));
  if (!bag.some((id) => id !== holder)) bag = [...bag, ...shuffle(online.filter((id) => !bag.includes(id)))];
  if (!bag.some((id) => id !== holder)) bag = shuffle(online);
  const i = bag.findIndex((id) => id !== holder);
  return { target: bag[i], bag: bag.filter((_, j) => j !== i) };
}

function spin(s: State, players: Player[], now: number): State {
  const online = circleOf(players);
  const pick = chooseTarget(s, online);
  if (!pick) return s;
  const idx = online.indexOf(pick.target);
  const targetAngle = (idx / online.length) * 360;
  const current = ((s.turn.rotation % 360) + 360) % 360;
  const extra = 360 * (3 + Math.floor(Math.random() * 2));
  const rotation = s.turn.rotation + extra + ((targetAngle - current + 360) % 360);
  return {
    ...s,
    phase: "spinning",
    bag: pick.bag,
    turn: { ...s.turn, n: s.turn.n + 1, target: pick.target, seats: online, rotation, spinEnd: now + SPIN_MS, kind: null, card: null, side: 0, flipped: false },
  };
}

/**
 * Takes the next prompt that fits. `hard` is never repeated (the other side of this card);
 * texts already used this game are skipped too, until the whole deck has been seen, then it
 * reshuffles. Never runs dry.
 */
function take(s: State, kind: BottleKind, allowSocial: boolean, wantSocial: boolean, hard: Set<string>): { prompt: BottlePrompt; queue: BottlePrompt[] } {
  const used = new Set(s.used);
  const ok = (p: BottlePrompt) => !hard.has(key(p.text)) && (allowSocial || !p.social);
  let queue = s.queue[kind].filter((p) => !hard.has(key(p.text)) && !used.has(key(p.text)));
  if (!queue.some(ok)) queue = [...queue, ...deckFor(s.tone, kind, new Set([...used, ...hard])).filter((p) => !used.has(key(p.text)) && !hard.has(key(p.text)))];
  // Everything has been seen: start the deck over (still never the other side of this card).
  if (!queue.some(ok)) queue = shuffle(BOTTLE_PROMPTS[s.tone].filter((p) => p.kind === kind && ok(p)));
  let i = -1;
  if (wantSocial && allowSocial) i = queue.findIndex((p) => p.social);
  if (i < 0) i = queue.findIndex((p) => ok(p) && !p.social);
  if (i < 0) i = queue.findIndex(ok);
  const prompt = queue[i];
  return { prompt, queue: queue.filter((_, j) => j !== i) };
}

function deal(s: State, kind: BottleKind): State {
  const target = s.turn.target;
  if (!target) return s;
  const allowSocial = kind === "dare" && TONE_INFO[s.tone].adult && !s.socialUsed && !s.noSocial.includes(target);
  const wantSocial = allowSocial && Math.random() < 1 / SOCIAL_ODDS;
  const first = take(s, kind, allowSocial, wantSocial, new Set());
  // The flip side is never social, so a social dare always has a normal way out.
  const second = take({ ...s, queue: { ...s.queue, [kind]: first.queue } }, kind, false, false, new Set([key(first.prompt.text)]));
  const card: [BottlePrompt, BottlePrompt] = [first.prompt, second.prompt];
  return {
    ...s,
    phase: "card",
    queue: { ...s.queue, [kind]: second.queue },
    used: [...s.used, key(first.prompt.text), key(second.prompt.text)].slice(-400),
    socialUsed: s.socialUsed || !!first.prompt.social,
    turn: { ...s.turn, kind, card, side: 0, flipped: false },
  };
}

function finishCard(s: State, result: "done" | "pass"): State {
  const { target, kind } = s.turn;
  if (s.phase !== "card" || !target || !kind) return s;
  return {
    ...s,
    phase: "ready",
    stats: { done: s.stats.done + (result === "done" ? 1 : 0), pass: s.stats.pass + (result === "pass" ? 1 : 0) },
    turn: { ...s.turn, holder: target, card: null, kind: null, outcome: { target, kind, result } },
  };
}

/** Replaces the side being shown with a new prompt of the same kind, and remembers the report. */
function report(s: State): State {
  const { card, kind, side } = s.turn;
  if (s.phase !== "card" || !card || !kind) return s;
  const bad = card[side];
  const next = take(s, kind, false, false, new Set([key(card[0].text), key(card[1].text), ...s.reported.map(key)]));
  const nextCard: [BottlePrompt, BottlePrompt] = side === 0 ? [next.prompt, card[1]] : [card[0], next.prompt];
  return {
    ...s,
    queue: { ...s.queue, [kind]: next.queue },
    used: [...s.used, key(next.prompt.text)].slice(-400),
    reported: [...s.reported, bad.text].slice(-20),
    turn: { ...s.turn, card: nextCard },
  };
}

/** New prompts from the host's AI fetch. Re-checked here, so a bad batch can't reach the TV. */
function refill(s: State, payload: unknown): State {
  if (!payload || typeof payload !== "object") return s;
  const p = payload as { tone?: unknown; prompts?: unknown };
  if (p.tone !== s.tone || !Array.isArray(p.prompts)) return s;
  const have = new Set([...s.used, ...s.queue.truth.map((x) => key(x.text)), ...s.queue.dare.map((x) => key(x.text))]);
  const add: Record<BottleKind, BottlePrompt[]> = { truth: [], dare: [] };
  for (const raw of p.prompts.slice(0, 40)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const kind = r.kind === "truth" || r.kind === "dare" ? r.kind : null;
    const text = typeof r.text === "string" ? r.text.trim() : "";
    const social = r.social === true && kind === "dare";
    const id = typeof r.id === "string" ? r.id.slice(0, 40) : `ai-${have.size}`;
    if (!kind || !text || have.has(key(text)) || breaksBottleRules(text, s.tone, social)) continue;
    have.add(key(text));
    add[kind].push({ id, kind, text, ...(social ? { social: true } : {}) });
  }
  if (!add.truth.length && !add.dare.length) return s;
  // Fresh AI prompts go first; the built-in deck stays behind them as a backup.
  return { ...s, queue: { truth: [...shuffle(add.truth), ...s.queue.truth], dare: [...shuffle(add.dare), ...s.queue.dare] } };
}

function react(s: State, from: string, emoji: unknown, now: number): State {
  if (typeof emoji !== "string" || !(REACTIONS as readonly string[]).includes(emoji)) return s;
  // One reaction per player per ~0.6 s, so nobody floods the screen.
  const lastMine = [...s.reactions].reverse().find((r) => r.from === from);
  if (lastMine && now - lastMine.at < 600) return s;
  const seq = s.reactionSeq + 1;
  return { ...s, reactionSeq: seq, reactions: [...s.reactions.filter((r) => now - r.at < REACTION_MS), { id: seq, from, emoji, at: now }].slice(-12) };
}

function isActor(s: State, id: string) {
  return id === HOST_ID || id === s.turn.target;
}

export function reduce(s: State, a: GameAction, players: Player[], now: number): State {
  const host = a.playerId === HOST_ID;
  switch (a.type) {
    case "spin": {
      if (s.phase !== "ready") return s;
      const holder = s.turn.holder;
      const holderHere = !!holder && players.some((p) => p.id === holder && p.connected);
      // The bottle holder spins; the host can always spin; anyone can if the holder is gone.
      if (!host && holderHere && a.playerId !== holder) return s;
      return spin(s, players, now);
    }
    case "pick":
      if (s.phase !== "choose" || !isActor(s, a.playerId)) return s;
      return a.payload === "truth" || a.payload === "dare" ? deal(s, a.payload) : s;
    case "flip":
      if (s.phase !== "card" || !isActor(s, a.playerId)) return s;
      return { ...s, turn: { ...s.turn, side: s.turn.side === 0 ? 1 : 0, flipped: true } };
    case "done":
      return isActor(s, a.playerId) ? finishCard(s, "done") : s;
    case "pass":
      return isActor(s, a.playerId) ? finishCard(s, "pass") : s;
    case "skip":
      // Host only: the picked phone went away. Hand the bottle back without a result.
      if (!host || (s.phase !== "choose" && s.phase !== "card")) return s;
      return { ...s, phase: "ready", turn: { ...s.turn, card: null, kind: null, outcome: null } };
    case "report":
      return players.some((p) => p.id === a.playerId) || host ? report(s) : s;
    case "react":
      return host ? s : react(s, a.playerId, a.payload, now);
    case "social": {
      if (host) return s;
      const off = a.payload === false;
      const has = s.noSocial.includes(a.playerId);
      if (off === has) return s;
      return { ...s, noSocial: off ? [...s.noSocial, a.playerId] : s.noSocial.filter((id) => id !== a.playerId) };
    }
    case "refill":
      return host ? refill(s, a.payload) : s;
  }
  return s;
}

export function tick(s: State, now: number): State {
  let next = s;
  if (s.phase === "spinning" && now >= s.turn.spinEnd) next = { ...next, phase: "choose" };
  if (next.reactions.length && next.reactions.some((r) => now - r.at >= REACTION_MS)) {
    next = { ...next, reactions: next.reactions.filter((r) => now - r.at < REACTION_MS) };
  }
  return next;
}

export function onPlayerJoin(s: State, player: Player): State {
  // A newcomer joins the end of this cycle's bag.
  return s.bag.includes(player.id) ? s : { ...s, bag: [...s.bag, player.id] };
}

export function publicView(s: State): Pub {
  const { turn } = s;
  const shown = turn.card ? turn.card[turn.side] : null;
  return {
    tone: s.tone,
    adult: TONE_INFO[s.tone].adult,
    phase: s.phase,
    n: turn.n,
    holder: turn.holder,
    target: turn.target,
    seats: turn.seats,
    rotation: turn.rotation,
    spinEnd: turn.spinEnd,
    kind: turn.kind,
    card: shown ? { text: shown.text, social: !!shown.social, side: turn.side, flipped: turn.flipped } : null,
    outcome: turn.outcome,
    reactions: s.reactions,
    needMore: s.queue.truth.length < LOW_WATER || s.queue.dare.length < LOW_WATER,
    reported: s.reported,
    stats: s.stats,
  };
}

export function privateView(s: State, id: string): Priv {
  return { noSocial: s.noSocial.includes(id) };
}

/** Fills the {player} placeholder an AI prompt may use. */
export function fillName(text: string, name: string | undefined): string {
  return text.replace(/\{player\}/gi, name || "you");
}
