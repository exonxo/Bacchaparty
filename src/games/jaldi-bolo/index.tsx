"use client";
import { NumberPicker } from "@/components/ui";
import { HOST_ID, type ControllerProps, type GameModule } from "@/lib/types";
import { normalize, shuffle } from "@/lib/util";
import { Phone } from "./PaperPhone";
import { Screen } from "./TvScreen";
import { LETTERS, N, SHUFFLE_MS, startsWithLetter, type Options, type Phase, type Priv, type Pub } from "./shared";

interface State {
  options: Options;
  phase: Phase;
  round: number;
  letters: string[];
  /** When the shuffled letter lands and writing starts. */
  revealAt: number;
  deadline: number | null;
  answers: Record<string, string[]>;
  done: Record<string, boolean>;
  struck: Record<string, boolean>; // key `${playerId}:${cat}`
  scores: Record<string, number>;
  participants: string[];
}

/** Points per player per category for the current round. */
export function roundPoints(s: Pick<State, "answers" | "struck" | "participants" | "letters" | "round">): Record<string, number[]> {
  const letter = s.letters[s.round - 1];
  const out: Record<string, number[]> = {};
  for (const id of s.participants) out[id] = Array(N).fill(0);
  for (let c = 0; c < N; c++) {
    const valid: [string, string][] = [];
    for (const id of s.participants) {
      const ans = s.answers[id]?.[c] ?? "";
      if (!ans.trim() || s.struck[`${id}:${c}`] || !startsWithLetter(ans, letter)) continue;
      valid.push([id, normalize(ans)]);
    }
    const counts = new Map<string, number>();
    valid.forEach(([, n]) => counts.set(n, (counts.get(n) ?? 0) + 1));
    valid.forEach(([id, n]) => (out[id][c] = counts.get(n)! > 1 ? 5 : 10));
  }
  return out;
}

function startRound(s: State, round: number, now: number): State {
  const revealAt = now + SHUFFLE_MS;
  return { ...s, phase: "answering", round, revealAt, deadline: revealAt + s.options.seconds * 1000, answers: {}, done: {}, struck: {} };
}

function toReview(s: State): State {
  return { ...s, phase: "review", deadline: null };
}

/** Phones that still render the old controller get the new phone view, without host buttons. */
function Controller(props: ControllerProps<Pub, Priv>) {
  return <Phone {...props} isHost={false} hostAct={() => {}} together />;
}

function OptionsForm({ value, onChange }: { value: Options; onChange: (o: Options) => void }) {
  return (
    <div className="space-y-4">
      <NumberPicker label="Time per letter" value={value.seconds} onChange={(seconds) => onChange({ ...value, seconds })} options={[60, 90, 120]} format={(n) => `${n}s`} />
      <NumberPicker label="Letters (rounds)" value={value.rounds} onChange={(rounds) => onChange({ ...value, rounds })} options={[3, 5, 8]} />
    </div>
  );
}

const game: GameModule<State, Pub, Priv, Options> = {
  id: "jaldi-bolo",
  paper: true,
  tvPaper: true,
  defaultOptions: { seconds: 60, rounds: 5 },
  OptionsForm,
  init({ players, options, now }) {
    const base: State = {
      options,
      phase: "answering",
      round: 1,
      letters: shuffle(LETTERS).slice(0, options.rounds),
      revealAt: now,
      deadline: null,
      answers: {},
      done: {},
      struck: {},
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      participants: players.map((p) => p.id),
    };
    return startRound(base, 1, now);
  },
  onPlayerJoin(s, p) {
    if (s.participants.includes(p.id)) return s;
    return { ...s, participants: [...s.participants, p.id], scores: { ...s.scores, [p.id]: 0 } };
  },
  reduce(s, a, { now }) {
    if (a.playerId === HOST_ID) {
      if (a.type === "stop" && s.phase === "answering") return toReview(s);
      if (a.type === "strike" && s.phase === "review") {
        const { playerId, cat } = (a.payload ?? {}) as { playerId?: string; cat?: number };
        if (!playerId || typeof cat !== "number" || cat < 0 || cat >= N || !s.answers[playerId]?.[cat]?.trim()) return s;
        const key = `${playerId}:${cat}`;
        const struck = { ...s.struck };
        if (struck[key]) delete struck[key];
        else struck[key] = true;
        return { ...s, struck };
      }
      if (a.type === "next" && s.phase === "review") {
        const pts = roundPoints(s);
        const scores = { ...s.scores };
        for (const [id, arr] of Object.entries(pts)) scores[id] = (scores[id] ?? 0) + arr.reduce((x, y) => x + y, 0);
        if (s.round >= s.options.rounds) return { ...s, phase: "final", scores };
        return startRound({ ...s, scores }, s.round + 1, now);
      }
      return s;
    }
    if (s.phase !== "answering" || !s.participants.includes(a.playerId)) return s;
    if (a.type === "answers" && Array.isArray(a.payload)) {
      if (s.done[a.playerId]) return s;
      const arr = (a.payload as unknown[]).slice(0, N).map((x) => String(x ?? "").slice(0, 40));
      while (arr.length < N) arr.push("");
      return { ...s, answers: { ...s.answers, [a.playerId]: arr } };
    }
    if (a.type === "done") {
      if (s.done[a.playerId]) return s;
      const done = { ...s.done, [a.playerId]: true };
      const next = { ...s, done };
      return s.participants.every((id) => done[id]) ? toReview(next) : next;
    }
    return s;
  },
  tick(s, { now, players }) {
    if (s.phase !== "answering") return s;
    if (s.deadline && now >= s.deadline) return toReview(s);
    // Everyone still connected is done → don't wait for people who left.
    const active = s.participants.filter((id) => players.find((p) => p.id === id)?.connected);
    if (active.length && active.every((id) => s.done[id]) && !s.participants.every((id) => s.done[id])) return toReview(s);
    return s;
  },
  publicView(s) {
    const reveal = s.phase !== "answering";
    return {
      phase: s.phase,
      round: s.round,
      rounds: s.options.rounds,
      letter: s.letters[s.round - 1],
      seconds: s.options.seconds,
      revealAt: s.revealAt ?? 0,
      deadline: s.deadline,
      participants: s.participants,
      done: Object.keys(s.done),
      answers: reveal ? s.answers : {},
      points: s.phase === "review" ? roundPoints(s) : {},
      struck: Object.keys(s.struck),
      scores: s.scores,
    };
  },
  privateView(s, id) {
    return { answers: s.answers[id] ?? Array(N).fill(""), done: !!s.done[id] };
  },
  Screen,
  Controller,
  Phone,
};

export default game;
