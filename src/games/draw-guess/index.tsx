"use client";
import { LevelPicker, NumberPicker } from "@/components/ui";
import { DRAW_WORDS } from "@/content/draw-guess";
import { HOST_ID, type ControllerProps, type GameModule, type Level } from "@/lib/types";
import { answerMatches, shuffle } from "@/lib/util";
import { Phone } from "./PaperPhone";
import { TvScreen } from "./Tv";
import {
  COLORS,
  DRAWER_AWAY_SKIP,
  KEYFRAME_EVERY,
  KEYFRAME_FOR,
  MAX_POINTS,
  MAX_STROKE_POINTS,
  TAIL_OPS,
  WIDTHS,
  applyOp,
  encodeDrawing,
  encodePoints,
  type FeedEntry,
  type LoggedOp,
  type Op,
  type Options,
  type Phase,
  type Priv,
  type Pub,
  type Stroke,
} from "./shared";

export interface State {
  level: Level;
  seconds: number;
  deck: string[];
  drawers: string[];
  turn: number;
  totalTurns: number;
  phase: Phase;
  choices: string[];
  word: string | null;
  startedAt: number;
  deadline: number;
  revealUntil: number | null;
  /** The drawing so far (host only; phones rebuild it from ops). */
  strokes: Stroke[];
  /** The last few drawing ops, with their index in the turn's log. */
  ops: LoggedOp[];
  /** Ops logged so far this turn. */
  opN: number;
  /** A keyframe (full drawing) is in updates while this is set. */
  kfOn: boolean;
  kfAt: number;
  correct: string[];
  feed: FeedEntry[];
  scores: Record<string, number>;
  gains: Record<string, number>;
  drawerAwaySince: number | null;
}

export const CHOOSE_FOR = 20_000;
const REVEAL_FOR = 7_000;

export const display = (entry: string) => entry.split("|")[0];
const accepted = (entry: string) => entry.split("|");
const maskOf = (word: string) => word.replace(/[A-Za-z0-9]/g, "_");

function deckFor(level: Level): string[] {
  const lists = level === "kids" ? [DRAW_WORDS.kids] : level === "family" ? [DRAW_WORDS.kids, DRAW_WORDS.family] : [DRAW_WORDS.family, DRAW_WORDS.adults];
  return shuffle(lists.flat());
}

export function drawerOf(s: State): string | null {
  return s.drawers.length ? s.drawers[s.turn % s.drawers.length] : null;
}

function startTurn(s: State, turn: number, now: number): State {
  if (turn >= s.totalTurns) return { ...s, turn, phase: "over", revealUntil: null, kfOn: false, drawerAwaySince: null };
  let deck = s.deck;
  if (deck.length < 3) deck = deckFor(s.level);
  return {
    ...s,
    turn,
    deck: deck.slice(3),
    choices: deck.slice(0, 3),
    word: null,
    phase: "choosing",
    startedAt: now,
    deadline: now + CHOOSE_FOR,
    revealUntil: null,
    strokes: [],
    ops: [],
    opN: 0,
    kfOn: false,
    kfAt: now,
    correct: [],
    feed: [],
    gains: {},
    drawerAwaySince: null,
  };
}

function choose(s: State, i: number, now: number): State {
  const word = s.choices[i] ?? s.choices[0];
  return { ...s, word, phase: "drawing", startedAt: now, deadline: now + s.seconds * 1000, kfAt: now, kfOn: false };
}

function reveal(s: State, now: number): State {
  return { ...s, phase: "reveal", revealUntil: now + REVEAL_FOR, kfOn: false };
}

function logOp(s: State, op: Op): State {
  return { ...s, strokes: applyOp(s.strokes, op), ops: [...s.ops, { ...op, i: s.opN } as LoggedOp].slice(-TAIL_OPS), opN: s.opN + 1 };
}

function isPointList(v: unknown): v is number[] {
  return Array.isArray(v) && v.length % 2 === 0 && v.length <= 400 && v.every((n) => Number.isInteger(n) && n >= 0 && n <= 1000);
}

function index(v: unknown, list: unknown[], fallback: number): number {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < list.length) return v;
  if (typeof v === "string") {
    const i = list.indexOf(v);
    if (i >= 0) return i;
  }
  return fallback;
}

/** Older code path (a phone without the phone-first view): same screen, no host controls. */
function Controller(props: ControllerProps<Pub, Priv>) {
  return <Phone {...props} isHost={false} hostAct={() => {}} together />;
}

function OptionsForm({ value, onChange }: { value: Options; onChange: (o: Options) => void }) {
  return (
    <div className="space-y-4">
      <LevelPicker value={value.level} onChange={(level) => onChange({ ...value, level })} />
      <NumberPicker label="Turns to draw" value={value.roundsPerPlayer} onChange={(roundsPerPlayer) => onChange({ ...value, roundsPerPlayer })} options={[1, 2, 3]} format={(n) => `${n} each`} />
      <NumberPicker label="Time per drawing" value={value.seconds} onChange={(seconds) => onChange({ ...value, seconds })} options={[60, 80, 100, 120]} format={(n) => `${n}s`} />
    </div>
  );
}

const drawGuess: GameModule<State, Pub, Priv, Options> = {
  id: "draw-guess",
  paper: true,
  tvPaper: true,
  defaultOptions: { level: "family", roundsPerPlayer: 1, seconds: 80 },
  OptionsForm,
  init({ players, options, now }) {
    const drawers = shuffle(players.map((p) => p.id));
    const base: State = {
      level: options.level,
      seconds: options.seconds,
      deck: deckFor(options.level),
      drawers,
      turn: 0,
      totalTurns: Math.max(1, drawers.length * options.roundsPerPlayer),
      phase: "choosing",
      choices: [],
      word: null,
      startedAt: now,
      deadline: now,
      revealUntil: null,
      strokes: [],
      ops: [],
      opN: 0,
      kfOn: false,
      kfAt: now,
      correct: [],
      feed: [],
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      gains: {},
      drawerAwaySince: null,
    };
    return startTurn(base, 0, now);
  },
  onPlayerJoin(s, p) {
    if (p.id in s.scores) return s;
    return { ...s, scores: { ...s.scores, [p.id]: 0 } };
  },
  reduce(s, a, { now, players }) {
    const drawer = drawerOf(s);
    const isHost = a.playerId === HOST_ID;
    const isDrawer = a.playerId === drawer;
    switch (a.type) {
      case "choose":
        if (!isDrawer || s.phase !== "choosing") return s;
        return choose(s, Number(a.payload) || 0, now);
      case "stroke": {
        if (!isDrawer || s.phase !== "drawing") return s;
        const m = a.payload as { s?: unknown; c?: unknown; w?: unknown; p?: unknown };
        if (!m || typeof m.s !== "number" || !isPointList(m.p) || m.p.length === 0) return s;
        const total = s.strokes.reduce((n, st) => n + st.p.length, 0);
        if (total + m.p.length > MAX_POINTS) return s;
        if (m.s === s.strokes.length) {
          return logOp(s, { k: "a", s: m.s, c: index(m.c, COLORS, 0), w: index(m.w, WIDTHS, 1), p: encodePoints(m.p) });
        }
        if (m.s === s.strokes.length - 1) {
          const last = s.strokes[s.strokes.length - 1];
          if (last.p.length + m.p.length > MAX_STROKE_POINTS) return s;
          return logOp(s, { k: "a", s: m.s, c: last.c, w: last.w, p: encodePoints(m.p) });
        }
        return s;
      }
      case "undo":
        if (!isDrawer || s.phase !== "drawing" || !s.strokes.length) return s;
        return logOp(s, { k: "u" });
      case "clear":
        if (!isDrawer || s.phase !== "drawing" || !s.strokes.length) return s;
        return logOp(s, { k: "x" });
      case "reveal":
        if (!isHost || s.phase !== "drawing") return s;
        return reveal(s, now);
      case "next":
        if (!isHost || s.phase !== "reveal") return s;
        return startTurn(s, s.turn + 1, now);
      case "skip":
        if (!isHost || s.phase === "over") return s;
        return startTurn(s, s.turn + 1, now);
      case "guess": {
        if (s.phase !== "drawing" || isHost || isDrawer || !s.word || s.correct.includes(a.playerId)) return s;
        if (!(a.playerId in s.scores)) return s;
        const text = String(a.payload ?? "").slice(0, 40).trim();
        if (!text) return s;
        if (answerMatches(text, accepted(s.word))) {
          const total = s.seconds * 1000;
          const left = Math.max(0, s.deadline - now);
          const pts = Math.max(2, Math.round((10 * left) / total));
          const scores = { ...s.scores, [a.playerId]: (s.scores[a.playerId] ?? 0) + pts };
          const gains = { ...s.gains, [a.playerId]: pts };
          if (drawer) {
            scores[drawer] = (scores[drawer] ?? 0) + 2;
            gains[drawer] = (gains[drawer] ?? 0) + 2;
          }
          const next: State = { ...s, scores, gains, correct: [...s.correct, a.playerId], feed: [...s.feed, { playerId: a.playerId, text: null }].slice(-30) };
          const waiting = players.filter((p) => p.connected && p.id !== drawer && p.id in next.scores && !next.correct.includes(p.id)).length;
          return waiting === 0 ? reveal(next, now) : next;
        }
        return { ...s, feed: [...s.feed, { playerId: a.playerId, text }].slice(-30) };
      }
    }
    return s;
  },
  tick(s, { now, players }) {
    if (s.phase === "over") return s;
    const drawerId = drawerOf(s);
    const drawer = players.find((p) => p.id === drawerId);
    if (s.phase !== "reveal" && drawerId && !drawer) return startTurn(s, s.turn + 1, now);
    let next = s;
    // The drawer's phone dropped: wait a little, then move on so the game doesn't stall.
    if (s.phase !== "reveal" && drawer) {
      if (!drawer.connected && s.drawerAwaySince === null) next = { ...next, drawerAwaySince: now };
      else if (drawer.connected && s.drawerAwaySince !== null) next = { ...next, drawerAwaySince: null };
      else if (!drawer.connected && s.drawerAwaySince !== null && now - s.drawerAwaySince >= DRAWER_AWAY_SKIP) return startTurn(s, s.turn + 1, now);
    }
    if (next.phase === "choosing" && now >= next.deadline) return choose(next, 0, now);
    if (next.phase === "drawing" && now >= next.deadline) return reveal(next, now);
    if (next.phase === "reveal" && next.revealUntil && now >= next.revealUntil) return startTurn(next, next.turn + 1, now);
    if (next.phase === "drawing") {
      if (!next.kfOn && now - next.kfAt >= KEYFRAME_EVERY) next = { ...next, kfOn: true, kfAt: now };
      else if (next.kfOn && now - next.kfAt >= KEYFRAME_FOR) next = { ...next, kfOn: false };
    }
    return next;
  },
  publicView(s) {
    const word = s.word ? display(s.word) : "";
    const full = s.phase === "reveal" || s.phase === "over" || s.kfOn ? encodeDrawing(s.strokes) : null;
    return {
      drawerId: drawerOf(s),
      turn: s.turn,
      totalTurns: s.totalTurns,
      phase: s.phase,
      seconds: s.seconds,
      deadline: s.deadline,
      hintAt: s.startedAt + (s.seconds * 1000) / 2,
      mask: maskOf(word),
      // Revealed by the phones only after hintAt.
      firstLetter: s.phase === "drawing" ? word.charAt(0) : "",
      pad: { turn: s.turn, n: s.opN, tail: s.ops, full },
      correct: s.correct,
      feed: s.feed,
      scores: s.scores,
      gains: s.gains,
      answer: s.phase === "reveal" ? word : null,
      revealUntil: s.phase === "reveal" ? s.revealUntil : null,
      drawerAwaySince: s.drawerAwaySince,
    };
  },
  privateView(s, id) {
    if (id !== drawerOf(s)) return undefined;
    if (s.phase === "choosing") return { choices: s.choices.map(display) };
    if (s.phase === "drawing" && s.word) return { word: display(s.word) };
    return undefined;
  },
  Screen: TvScreen,
  Controller,
  Phone,
};

export default drawGuess;
