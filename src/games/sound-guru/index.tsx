"use client";
import { LevelPicker, NumberPicker } from "@/components/ui";
import { SOUNDS, type SoundPrompt } from "@/content/sound-guru";
import { HOST_ID, type ControllerProps, type GameModule, type Level, type Player } from "@/lib/types";
import { answerMatches, shuffle } from "@/lib/util";
import { Phone } from "./PaperPhone";
import { TvScreen } from "./Tv";

export interface Options {
  level: Level;
  roundsPerPlayer: number;
  /** Seconds per sound. */
  seconds: number;
}

export type Phase = "ready" | "making" | "reveal" | "over";

interface State {
  level: Level;
  seconds: number;
  deck: SoundPrompt[];
  makers: string[];
  turn: number;
  totalTurns: number;
  phase: Phase;
  prompt: SoundPrompt | null;
  roundStart: number | null;
  deadline: number | null;
  revealUntil: number | null;
  correct: string[];
  /** Wrong guesses per player — only ever shown to that player. */
  wrong: Record<string, { text: string; at: number; tries: number }>;
  scores: Record<string, number>;
  /** When the Sound Maker's phone went offline (null while connected). */
  makerAwaySince: number | null;
  /** Why the last turn ended early, for a short note. */
  lastSkip: { name: string; at: number } | null;
}

export interface Pub {
  makerId: string | null;
  turn: number;
  totalTurns: number;
  phase: Phase;
  seconds: number;
  roundStart: number | null;
  deadline: number | null;
  revealUntil: number | null;
  /** Players who guessed right, in order (1st gets the most points). */
  correct: string[];
  scores: Record<string, number>;
  /** Only filled in after the round. */
  answer: string | null;
  makerAwaySince: number | null;
  lastSkip: State["lastSkip"];
}

export type Priv =
  | { role: "maker"; sound: string; tip: string }
  | { role: "guesser"; tries: number; lastWrong: string | null; at: number };

/** Points for the 1st, 2nd and later right guesses. The Sound Maker gets +1 per right guess. */
export const POINTS = [3, 2];
export function pointsFor(rank: number) {
  return POINTS[rank] ?? 1;
}
/** How long a Sound Maker can be offline before the turn moves on. */
export const AWAY_MS = 10_000;
/** How long the answer stays on screen before the next maker's turn. */
export const REVEAL_MS = 9_000;

function deckFor(level: Level): SoundPrompt[] {
  const levels: Level[] = level === "kids" ? ["kids"] : level === "family" ? ["kids", "family"] : ["family", "adults"];
  return shuffle(SOUNDS.filter((s) => levels.includes(s.level)));
}

function makerOf(s: State): string | null {
  return s.makers.length ? s.makers[s.turn % s.makers.length] : null;
}

function startTurn(s: State, turn: number): State {
  if (turn >= s.totalTurns) return { ...s, turn, phase: "over", prompt: null, deadline: null, revealUntil: null, makerAwaySince: null };
  const deck = s.deck.length ? s.deck : deckFor(s.level);
  return {
    ...s,
    turn,
    deck: deck.slice(1),
    prompt: deck[0],
    phase: "ready",
    roundStart: null,
    deadline: null,
    revealUntil: null,
    correct: [],
    wrong: {},
    makerAwaySince: null,
  };
}

function reveal(s: State, now: number): State {
  return { ...s, phase: "reveal", deadline: null, revealUntil: now + REVEAL_MS };
}

function guessersLeft(s: State, players: Player[]): number {
  const maker = makerOf(s);
  return players.filter((p) => p.connected && p.id !== maker && !s.correct.includes(p.id)).length;
}

const noop = () => {};

/** Older "with a TV" controller: same phone view, without host controls. */
function Controller(props: ControllerProps<Pub, Priv>) {
  return <Phone {...props} isHost={false} hostAct={noop} together />;
}

function OptionsForm({ value, onChange }: { value: Options; onChange: (o: Options) => void }) {
  return (
    <div className="space-y-4">
      <LevelPicker value={value.level} onChange={(level) => onChange({ ...value, level })} />
      <NumberPicker
        label="Turns as Sound Maker"
        value={value.roundsPerPlayer}
        onChange={(roundsPerPlayer) => onChange({ ...value, roundsPerPlayer })}
        options={[1, 2, 3]}
        format={(n) => `${n} each`}
      />
      <NumberPicker label="Time per sound" value={value.seconds ?? 60} onChange={(seconds) => onChange({ ...value, seconds })} options={[45, 60, 90]} format={(n) => `${n}s`} />
    </div>
  );
}

const soundGuru: GameModule<State, Pub, Priv, Options> = {
  id: "sound-guru",
  paper: true,
  tvPaper: true,
  defaultOptions: { level: "family", roundsPerPlayer: 1, seconds: 60 },
  OptionsForm,
  init({ players, options }) {
    const makers = shuffle(players.map((p) => p.id));
    const base: State = {
      level: options.level,
      seconds: options.seconds ?? 60,
      deck: deckFor(options.level),
      makers,
      turn: 0,
      totalTurns: Math.max(1, makers.length * options.roundsPerPlayer),
      phase: "ready",
      prompt: null,
      roundStart: null,
      deadline: null,
      revealUntil: null,
      correct: [],
      wrong: {},
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      makerAwaySince: null,
      lastSkip: null,
    };
    return startTurn(base, 0);
  },
  onPlayerJoin(s, p) {
    if (p.id in s.scores) return s;
    return { ...s, scores: { ...s.scores, [p.id]: 0 } };
  },
  reduce(s, a, { now, players }) {
    const maker = makerOf(s);
    const isHost = a.playerId === HOST_ID;
    const isMaker = a.playerId === maker;
    switch (a.type) {
      case "start":
        if ((!isHost && !isMaker) || s.phase !== "ready") return s;
        return { ...s, phase: "making", roundStart: now, deadline: now + s.seconds * 1000 };
      case "skip":
        if (!isHost || s.phase !== "ready") return s;
        return startTurn(s, s.turn);
      case "skipMaker":
        if (!isHost || s.phase === "over") return s;
        return startTurn(s, s.turn + 1);
      case "reveal":
        if ((!isHost && !isMaker) || s.phase !== "making") return s;
        return reveal(s, now);
      case "next":
        if ((!isHost && !isMaker) || s.phase !== "reveal") return s;
        return startTurn(s, s.turn + 1);
      case "guess": {
        if (s.phase !== "making" || isHost || isMaker || !s.prompt || s.correct.includes(a.playerId) || !(a.playerId in s.scores)) return s;
        const text = String(a.payload ?? "").slice(0, 40).trim();
        if (!text) return s;
        if (answerMatches(text, [s.prompt.sound, ...s.prompt.answers])) {
          const scores = { ...s.scores, [a.playerId]: (s.scores[a.playerId] ?? 0) + pointsFor(s.correct.length) };
          if (maker) scores[maker] = (scores[maker] ?? 0) + 1;
          const next: State = { ...s, correct: [...s.correct, a.playerId], scores };
          return guessersLeft(next, players) === 0 ? reveal(next, now) : next;
        }
        const tries = (s.wrong[a.playerId]?.tries ?? 0) + 1;
        return { ...s, wrong: { ...s.wrong, [a.playerId]: { text, at: now, tries } } };
      }
    }
    return s;
  },
  tick(s, { players, now }) {
    if (s.phase === "over") return s;
    if (s.phase === "reveal") return s.revealUntil && now >= s.revealUntil ? startTurn(s, s.turn + 1) : s;
    if (s.phase === "making" && s.deadline && now >= s.deadline) return reveal(s, now);
    // Sound Maker left or their phone went quiet: give them a moment, then move on.
    const maker = makerOf(s);
    if (!maker) return s;
    const p = players.find((x) => x.id === maker);
    if (!p) return { ...startTurn(s, s.turn + 1), lastSkip: { name: "The Sound Maker", at: now } };
    if (p.connected) return s.makerAwaySince ? { ...s, makerAwaySince: null } : s;
    if (!s.makerAwaySince) return { ...s, makerAwaySince: now };
    if (now - s.makerAwaySince >= AWAY_MS) return { ...startTurn(s, s.turn + 1), lastSkip: { name: p.name, at: now } };
    return s;
  },
  publicView(s) {
    return {
      makerId: makerOf(s),
      turn: s.turn,
      totalTurns: s.totalTurns,
      phase: s.phase,
      seconds: s.seconds,
      roundStart: s.roundStart,
      deadline: s.deadline,
      revealUntil: s.revealUntil,
      correct: s.correct,
      scores: s.scores,
      answer: s.phase === "reveal" ? (s.prompt?.sound ?? null) : null,
      makerAwaySince: s.makerAwaySince,
      lastSkip: s.lastSkip,
    };
  },
  privateView(s, id) {
    if (s.phase === "over" || !s.prompt) return undefined;
    if (id === makerOf(s)) return s.phase === "ready" || s.phase === "making" ? { role: "maker", sound: s.prompt.sound, tip: s.prompt.tip } : undefined;
    const w = s.wrong[id];
    return { role: "guesser", tries: w?.tries ?? 0, lastWrong: w?.text ?? null, at: w?.at ?? 0 };
  },
  Screen: TvScreen,
  Controller,
  Phone,
};

export default soundGuru;
