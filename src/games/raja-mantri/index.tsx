"use client";
import { HOST_ID, type ControllerProps, type GameModule } from "@/lib/types";
import { shuffle } from "@/lib/util";
import { Phone } from "./PaperPhone";
import { Screen } from "./TvScreen";

export type Role = "raja" | "mantri" | "chor" | "sipahi";
export type Phase = "pick" | "raja" | "mantri" | "result";

export const ROLE_INFO: Record<Role, { label: string; points: number; line: string }> = {
  raja: { label: "Raja", points: 1000, line: "Sabse bada! Sabko batao: “Main Raja hoon!”" },
  mantri: { label: "Mantri", points: 800, line: "Chor ko pakdo — sahi pakda toh 800, galat toh 0." },
  chor: { label: "Chor", points: 0, line: "Chehra seedha! Bach gaye toh Mantri ke 800 aapke." },
  sipahi: { label: "Sipahi", points: 500, line: "Aaram se baitho — 500 pakke. Chehra seedha rakho." },
};

/** Time to pick a chit before the rest are dealt automatically. */
export const PICK_MS = 25_000;

export interface State {
  round: number;
  seats: string[];
  /** The role written on each of the four chits, in table order (secret). */
  chits: Role[];
  /** Which chit each seat picked up. */
  taken: Record<string, number>;
  pickDeadline: number;
  roles: Record<string, Role>;
  phase: Phase;
  guess: string | null;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
  /** The host announced the Raja because the Raja's phone was gone. */
  hostAnnounced?: boolean;
}

export interface Pub {
  round: number;
  seats: string[];
  phase: Phase;
  taken: Record<string, number>;
  pickDeadline: number | null;
  rajaId: string | null;
  mantriId: string | null;
  suspects: string[];
  guess: string | null;
  correct: boolean | null;
  roles: Record<string, Role> | null;
  lastPoints: Record<string, number>;
  scores: Record<string, number>;
  hostAnnounced: boolean;
}

export interface Priv {
  role: Role;
}

const ROLES: Role[] = ["raja", "mantri", "chor", "sipahi"];

function deal(seats: string[], round: number, scores: Record<string, number>, now: number): State {
  const next = { ...scores };
  for (const id of seats) next[id] = next[id] ?? 0;
  return {
    round,
    seats,
    chits: shuffle(ROLES),
    taken: {},
    pickDeadline: now + PICK_MS,
    roles: {},
    phase: "pick",
    guess: null,
    scores: next,
    lastPoints: {},
    hostAnnounced: false,
  };
}

function takeChit(s: State, id: string, idx: number): State {
  const taken = s.taken ?? {};
  if (s.phase !== "pick" || !s.seats.includes(id) || id in taken) return s;
  if (!Number.isInteger(idx) || idx < 0 || idx > 3 || Object.values(taken).includes(idx)) return s;
  const nextTaken = { ...taken, [id]: idx };
  const roles = { ...s.roles, [id]: s.chits[idx] };
  const done = s.seats.every((seat) => seat in nextTaken);
  return { ...s, taken: nextTaken, roles, phase: done ? "raja" : "pick" };
}

/** Hands the chits nobody picked to the players who haven't picked yet. */
function dealRest(s: State): State {
  if (s.phase !== "pick") return s;
  const taken = { ...(s.taken ?? {}) };
  const used = new Set(Object.values(taken));
  const free = shuffle([0, 1, 2, 3].filter((i) => !used.has(i)));
  const roles = { ...s.roles };
  for (const id of s.seats) {
    if (id in taken) continue;
    const idx = free.shift();
    if (idx === undefined) break;
    taken[id] = idx;
    roles[id] = s.chits[idx];
  }
  return { ...s, taken, roles, phase: "raja" };
}

const whoIs = (s: State, r: Role) => s.seats.find((id) => s.roles[id] === r) ?? null;

function score(s: State, guess: string): State {
  const chor = whoIs(s, "chor")!;
  const correct = guess === chor;
  const pts: Record<string, number> = {};
  for (const id of s.seats) {
    const r = s.roles[id];
    if (r === "raja") pts[id] = 1000;
    else if (r === "sipahi") pts[id] = 500;
    else if (r === "mantri") pts[id] = correct ? 800 : 0;
    else pts[id] = correct ? 0 : 800;
  }
  const scores = { ...s.scores };
  for (const id of s.seats) scores[id] = (scores[id] ?? 0) + pts[id];
  return { ...s, phase: "result", guess, scores, lastPoints: pts };
}


const noop = () => {};

/** Older controller entry point: the phone view without host controls. */
function Controller(props: ControllerProps<Pub, Priv>) {
  return <Phone {...props} isHost={false} hostAct={noop} together />;
}

const rajaMantri: GameModule<State, Pub, Priv, Record<string, never>> = {
  id: "raja-mantri",
  paper: true,
  tvPaper: true,
  defaultOptions: {},
  init({ players, now }) {
    const seats = players.slice(0, 4).map((p) => p.id);
    return deal(seats, 1, {}, now);
  },
  reduce(s, a, { players, now }) {
    if (a.playerId === HOST_ID) {
      switch (a.type) {
        case "next":
          return s.phase === "result" ? deal(s.seats, s.round + 1, s.scores, now) : s;
        case "redeal":
          // Start this round over: no points are given.
          return s.phase === "result" ? s : deal(s.seats, s.round + 1, s.scores, now);
        case "assign":
          return dealRest(s);
        case "announce":
          return s.phase === "raja" ? { ...s, phase: "mantri", hostAnnounced: true } : s;
        case "reseat": {
          // Seat four connected players: keep everyone still here, fill from the room.
          const online = players.filter((p) => p.connected).map((p) => p.id);
          const keep = s.seats.filter((id) => online.includes(id));
          const seats = [...keep, ...online.filter((id) => !keep.includes(id))].slice(0, 4);
          if (seats.length < 4 || seats.every((id) => s.seats.includes(id))) return s;
          return deal(seats, s.round + 1, s.scores, now);
        }
      }
      return s;
    }
    if (a.type === "next") {
      if (s.phase !== "result" || !s.seats.includes(a.playerId)) return s;
      return deal(s.seats, s.round + 1, s.scores, now);
    }
    if (a.type === "pick") return takeChit(s, a.playerId, Number(a.payload));
    if (a.type === "raja" && s.phase === "raja" && s.roles[a.playerId] === "raja") return { ...s, phase: "mantri" };
    if (a.type === "guess" && s.phase === "mantri" && s.roles[a.playerId] === "mantri") {
      const target = a.payload as string;
      const r = s.roles[target];
      if (r !== "chor" && r !== "sipahi") return s;
      return score(s, target);
    }
    return s;
  },
  tick(s, { now }) {
    if (s.phase === "pick" && s.pickDeadline && now >= s.pickDeadline) return dealRest(s);
    return s;
  },
  publicView(s) {
    const chor = whoIs(s, "chor");
    const early = s.phase === "pick" || s.phase === "raja";
    return {
      round: s.round,
      seats: s.seats,
      phase: s.phase,
      taken: s.taken ?? {},
      pickDeadline: s.phase === "pick" ? (s.pickDeadline ?? null) : null,
      rajaId: early ? null : whoIs(s, "raja"),
      mantriId: early ? null : whoIs(s, "mantri"),
      suspects: early ? [] : s.seats.filter((id) => s.roles[id] === "chor" || s.roles[id] === "sipahi").sort(),
      guess: s.guess,
      correct: s.phase === "result" ? s.guess === chor : null,
      roles: s.phase === "result" ? s.roles : null,
      lastPoints: s.lastPoints,
      scores: s.scores,
      hostAnnounced: !!s.hostAnnounced,
    };
  },
  privateView(s, id) {
    return s.roles[id] ? { role: s.roles[id] } : undefined;
  },
  Screen,
  Controller,
  Phone,
};

export default rajaMantri;
