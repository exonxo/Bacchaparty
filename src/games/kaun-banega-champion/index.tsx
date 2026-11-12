"use client";
import { KBC_QUESTIONS, type KbcQuestion } from "@/content/kbc";
import { HOST_ID, type ControllerProps, type GameModule, type Level } from "@/lib/types";
import { shuffle } from "@/lib/util";
import { Phone } from "./PaperPhone";
import { TvScreen } from "./Tv";

export const LADDER = 10;
export const SAFE = 5;
/** Time to answer each question. */
export const QUESTION_MS = 30_000;
/** A hot-seat player who's been disconnected this long is skipped. */
const AWAY_MS = 10_000;

/** "over": one hot seat finished. "final": the whole game is over (everyone played, or the host ended it). */
export type Phase = "pick" | "level" | "question" | "locked" | "reveal" | "over" | "final";

interface Question {
  q: string;
  options: string[];
  answer: number;
}

export interface State {
  phase: Phase;
  hotSeat: string | null;
  level: Level | null;
  rung: number; // index of the current question, 0..9
  question: Question | null;
  used: string[];
  removed: number[];
  lifelines: { fifty: boolean; family: boolean };
  familyShown: boolean;
  hotAnswer: number | null;
  audience: Record<string, number>;
  /** Best hot-seat level reached per player. */
  best: Record<string, number>;
  bonus: Record<string, number>;
  played: string[];
  result: { playerId: string; won: number; how: "wrong" | "quit" | "champion" } | null;
  /** When the current question's time runs out (null while paused or not answering). */
  deadline: number | null;
  /** Time left when the host paused (null = running). */
  pausedLeft: number | null;
  /** The hot-seat player ran out of time on this question. */
  timedOut: boolean;
  /** Since when the hot-seat player has been disconnected. */
  hotAwaySince: number | null;
}

export interface Pub {
  phase: Phase;
  hotSeat: string | null;
  level: Level | null;
  rung: number;
  question: { q: string; options: string[] } | null;
  removed: number[];
  lifelines: { fifty: boolean; family: boolean };
  family: number[] | null;
  audienceCount: number;
  hotAnswer: number | null;
  answer: number | null;
  /** Ids of audience players who have answered (not what they answered). */
  answered: string[];
  scores: Record<string, number>;
  played: string[];
  result: State["result"];
  deadline: number | null;
  pausedLeft: number | null;
  timedOut: boolean;
  seconds: number;
  /** Best hot-seat level per player, and audience bonus points per player. */
  best: Record<string, number>;
  bonus: Record<string, number>;
}

export interface Priv {
  myAnswer: number | null;
}

function pickQuestion(level: Level, step: number, used: string[]): Question {
  const bank = KBC_QUESTIONS[level].filter((q) => !used.includes(q.q));
  const pool = bank.length ? bank : KBC_QUESTIONS[level];
  // Closest difficulty step available, random among ties.
  let bestDist = Infinity;
  let cands: KbcQuestion[] = [];
  for (const q of pool) {
    const d = Math.abs(q.step - step);
    if (d < bestDist) {
      bestDist = d;
      cands = [q];
    } else if (d === bestDist) cands.push(q);
  }
  const chosen = cands[Math.floor(Math.random() * cands.length)];
  const options = shuffle([chosen.a, ...chosen.w]);
  return { q: chosen.q, options, answer: options.indexOf(chosen.a) };
}

function newQuestion(s: State, rung: number, now: number): State {
  const question = pickQuestion(s.level!, rung + 1, s.used);
  return {
    ...s,
    phase: "question",
    deadline: now + QUESTION_MS,
    pausedLeft: null,
    timedOut: false,
    rung,
    question,
    used: [...s.used, question.q],
    removed: [],
    familyShown: false,
    hotAnswer: null,
    audience: {},
  };
}

function finishRun(s: State, won: number, how: "wrong" | "quit" | "champion"): State {
  const id = s.hotSeat!;
  return {
    ...s,
    phase: how === "quit" ? "over" : s.phase,
    best: { ...s.best, [id]: Math.max(s.best[id] ?? 0, won) },
    played: s.played.includes(id) ? s.played : [...s.played, id],
    result: { playerId: id, won, how },
  };
}

/** Shows the answer; audience players who got it right earn a bonus point. */
function toReveal(s: State, timedOut = false): State {
  if (!s.question) return s;
  const bonus = { ...s.bonus };
  for (const [pid, ans] of Object.entries(s.audience)) if (ans === s.question.answer) bonus[pid] = (bonus[pid] ?? 0) + 1;
  return { ...s, phase: "reveal", bonus, deadline: null, pausedLeft: null, timedOut, hotAnswer: timedOut ? null : s.hotAnswer };
}

/** Back to choosing who sits in the hot seat, without changing anyone's score. */
function toPick(s: State): State {
  return { ...s, phase: "pick", hotSeat: null, question: null, result: null, deadline: null, pausedLeft: null, timedOut: false, hotAwaySince: null };
}

function toFinal(s: State): State {
  return { ...s, phase: "final", hotSeat: null, question: null, deadline: null, pausedLeft: null, timedOut: false, hotAwaySince: null };
}

function scoresOf(s: State): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of new Set([...Object.keys(s.best), ...Object.keys(s.bonus)])) out[id] = (s.best[id] ?? 0) + (s.bonus[id] ?? 0);
  return out;
}

function Controller(props: ControllerProps<Pub, Priv>) {
  return <Phone {...props} isHost={false} hostAct={() => {}} together />;
}

const game: GameModule<State, Pub, Priv, Record<string, never>> = {
  id: "kaun-banega-champion",
  paper: true,
  tvPaper: true,
  defaultOptions: {},
  init({ players }) {
    return {
      phase: "pick",
      hotSeat: null,
      level: null,
      rung: 0,
      question: null,
      used: [],
      removed: [],
      lifelines: { fifty: false, family: false },
      familyShown: false,
      hotAnswer: null,
      audience: {},
      best: Object.fromEntries(players.map((p) => [p.id, 0])),
      bonus: {},
      played: [],
      result: null,
      deadline: null,
      pausedLeft: null,
      timedOut: false,
      hotAwaySince: null,
    };
  },
  reduce(s, a, { players, now }) {
    if (a.playerId === HOST_ID) {
      if (a.type === "hotseat" && (s.phase === "pick" || s.phase === "level")) {
        const id = String(a.payload);
        if (!players.some((p) => p.id === id && p.connected)) return s;
        return {
          ...s,
          phase: "level",
          hotSeat: id,
          level: null,
          rung: 0,
          question: null,
          lifelines: { fifty: false, family: false },
          result: null,
          deadline: null,
          pausedLeft: null,
          timedOut: false,
          hotAwaySince: null,
        };
      }
      if (a.type === "skip" && (s.phase === "level" || s.phase === "question" || s.phase === "locked")) return toPick(s);
      if (a.type === "pause" && s.phase === "question") {
        if (s.pausedLeft === null) return { ...s, pausedLeft: Math.max(0, (s.deadline ?? now) - now), deadline: null };
        return { ...s, deadline: now + s.pausedLeft, pausedLeft: null };
      }
      if (a.type === "reveal" && s.phase === "locked" && s.question) return toReveal(s);
      if (a.type === "next" && s.phase === "reveal" && s.question && s.hotAnswer === s.question.answer && s.rung < LADDER - 1) {
        return newQuestion(s, s.rung + 1, now);
      }
      if (a.type === "finish" && s.phase === "reveal" && s.question) {
        const right = s.hotAnswer === s.question.answer;
        if (right && s.rung === LADDER - 1) return { ...finishRun(s, LADDER, "champion"), phase: "over" };
        if (!right) return { ...finishRun(s, s.rung >= SAFE ? SAFE : 0, "wrong"), phase: "over" };
        return s;
      }
      if (a.type === "nextSeat" && s.phase === "over") {
        // Everyone in the room has had a turn: show the final results instead of another pick.
        const online = players.filter((p) => p.connected);
        if (online.length > 0 && online.every((p) => s.played.includes(p.id))) return toFinal(s);
        return toPick(s);
      }
      // "Khel khatam": the host ends the game and everyone sees the final results.
      if (a.type === "final" && (s.phase === "pick" || s.phase === "over") && s.played.length > 0) return toFinal(s);
      if (a.type === "again" && s.phase === "final") {
        return {
          ...toPick(s),
          best: Object.fromEntries(players.map((p) => [p.id, 0])),
          bonus: {},
          played: [],
          used: [],
        };
      }
      return s;
    }
    const isHot = a.playerId === s.hotSeat;
    if (isHot) {
      if (a.type === "level" && s.phase === "level") {
        const level = a.payload as Level;
        if (!(level in KBC_QUESTIONS)) return s;
        return newQuestion({ ...s, level }, 0, now);
      }
      if (s.phase !== "question" || !s.question) return s;
      if (a.type === "answer") {
        const i = Number(a.payload);
        if (!(i >= 0 && i < 4) || s.removed.includes(i)) return s;
        return { ...s, hotAnswer: i, phase: "locked", deadline: null, pausedLeft: null };
      }
      if (a.type === "fifty" && !s.lifelines.fifty) {
        const wrong = shuffle([0, 1, 2, 3].filter((i) => i !== s.question!.answer)).slice(0, 2);
        return { ...s, removed: wrong, lifelines: { ...s.lifelines, fifty: true } };
      }
      if (a.type === "family" && !s.lifelines.family) return { ...s, familyShown: true, lifelines: { ...s.lifelines, family: true } };
      if (a.type === "quit") return { ...finishRun(s, s.rung, "quit"), deadline: null, pausedLeft: null };
      return s;
    }
    if (a.type === "audience" && (s.phase === "question" || s.phase === "locked") && s.audience[a.playerId] === undefined) {
      const i = Number(a.payload);
      if (!(i >= 0 && i < 4) || s.removed.includes(i)) return s;
      return { ...s, audience: { ...s.audience, [a.playerId]: i } };
    }
    return s;
  },
  tick(s, { players, now }) {
    const seated = s.phase === "level" || s.phase === "question" || s.phase === "locked";
    if (seated && s.hotSeat) {
      const hot = players.find((p) => p.id === s.hotSeat);
      // Left the room: skip straight away. Disconnected: skip after a short wait.
      if (!hot) return toPick(s);
      if (!hot.connected) {
        if (s.hotAwaySince === null) return { ...s, hotAwaySince: now };
        if (now - s.hotAwaySince >= AWAY_MS) return toPick(s);
      } else if (s.hotAwaySince !== null) return { ...s, hotAwaySince: null };
    }
    // Out of time counts as a wrong answer.
    if (s.phase === "question" && s.deadline !== null && now >= s.deadline) return toReveal(s, true);
    return s;
  },
  publicView(s) {
    // Ask the Family only counts the options still on the card after 50:50.
    const counts = [0, 0, 0, 0];
    Object.values(s.audience).forEach((i) => {
      if (!s.removed.includes(i)) counts[i]++;
    });
    return {
      phase: s.phase,
      hotSeat: s.hotSeat,
      level: s.level,
      rung: s.rung,
      question: s.question ? { q: s.question.q, options: s.question.options } : null,
      removed: s.removed,
      lifelines: s.lifelines,
      family: s.familyShown ? counts : null,
      audienceCount: 0,
      hotAnswer: s.hotAnswer,
      answer: s.phase === "reveal" && s.question ? s.question.answer : null,
      answered: Object.keys(s.audience),
      scores: scoresOf(s),
      played: s.played,
      result: s.result,
      deadline: s.deadline,
      pausedLeft: s.pausedLeft,
      timedOut: s.timedOut,
      seconds: QUESTION_MS / 1000,
      best: s.best,
      bonus: s.bonus,
    };
  },
  privateView(s, id) {
    return { myAnswer: s.audience[id] ?? null };
  },
  Screen: (props) => <TvScreen {...props} view={{ ...props.view, audienceCount: props.players.filter((p) => p.connected && p.id !== props.view.hotSeat).length }} />,
  Controller,
  Phone,
};

export default game;
