"use client";
import { NumberPicker, Toggle } from "@/components/ui";
import { START_LETTERS, songsFor } from "@/content/antakshari";
import { HOST_ID, type ControllerProps, type GameModule, type Player } from "@/lib/types";
import { pick, shuffle } from "@/lib/util";
import { Phone } from "./PaperPhone";
import { TvScreen } from "./Tv";

export interface Options {
  hints: boolean;
  /** Seconds the singing team has to start; 0 = no timer. */
  seconds: number;
}

export type Team = 0 | 1;
export type Phase = "singing" | "judging" | "challenged" | "next-letter";

export const TEAM_NAMES = ["Team Laddoo", "Team Jalebi"] as const;
export const TEAM_SHORT = ["Laddoo", "Jalebi"] as const;
export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
/** A whole team offline this long and the turn moves on. */
export const AWAY_MS = 10_000;

export type EventKind = "valid" | "reject" | "giveup" | "timeout" | "skip";

interface State {
  options: Options;
  teams: [string[], string[]];
  turn: Team;
  letter: string;
  phase: Phase;
  votes: Record<string, "valid" | "challenge">;
  scores: [number, number];
  songsSung: number;
  hintSeed: number;
  lastEvent: { text: string; at: number; kind?: EventKind; team?: Team } | null;
  /** Singing team must start before this (game clock). Null when there's no timer or it isn't running. */
  deadline: number | null;
  /** Host paused the timer: what was left, in ms. */
  pausedLeft: number | null;
  /** When the team whose turn it is was first seen with nobody online. */
  awaySince: number | null;
}

export interface Pub {
  teams: [string[], string[]];
  teamNames: readonly string[];
  turn: Team;
  letter: string;
  phase: Phase;
  votes: Record<string, "valid" | "challenge">;
  scores: [number, number];
  songsSung: number;
  hint: { title: string; source: string } | null;
  hintsOn: boolean;
  lastEvent: State["lastEvent"];
  seconds: number;
  deadline: number | null;
  paused: boolean;
  pausedLeft: number | null;
  awaySince: number | null;
}

export const other = (t: Team): Team => (t === 0 ? 1 : 0);
export const teamOf = (s: { teams: [string[], string[]] }, id: string): Team | null => (s.teams[0].includes(id) ? 0 : s.teams[1].includes(id) ? 1 : null);

const secondsOf = (s: State) => (typeof s.options.seconds === "number" ? s.options.seconds : 30);

/** A fresh singing turn: timer restarts unless the host has paused it. */
function startTurn(s: State, now: number): State {
  const secs = secondsOf(s);
  if (!secs) return { ...s, phase: "singing", votes: {}, deadline: null, pausedLeft: null, awaySince: null };
  if (s.pausedLeft !== null) return { ...s, phase: "singing", votes: {}, deadline: null, pausedLeft: secs * 1000, awaySince: null };
  return { ...s, phase: "singing", votes: {}, deadline: now + secs * 1000, awaySince: null };
}

function accept(s: State, now: number): State {
  const scores: [number, number] = [...s.scores];
  scores[s.turn] += 1;
  return {
    ...s,
    scores,
    phase: "next-letter",
    votes: {},
    deadline: null,
    awaySince: null,
    songsSung: s.songsSung + 1,
    lastEvent: { text: `Sahi gaana! +1 ${TEAM_NAMES[s.turn]}`, at: now, kind: "valid", team: s.turn },
  };
}

/** The other team gets the point and sings next (give up, or time ran out). */
function concede(s: State, now: number, kind: "giveup" | "timeout"): State {
  const scores: [number, number] = [...s.scores];
  const winner = other(s.turn);
  scores[winner] += 1;
  const text = kind === "timeout" ? `Time up! +1 ${TEAM_NAMES[winner]}` : `${TEAM_NAMES[s.turn]} gave up — +1 ${TEAM_NAMES[winner]}`;
  return startTurn({ ...s, scores, turn: winner, lastEvent: { text, at: now, kind, team: winner } }, now);
}

const connectedIds = (players: Player[]) => new Set(players.filter((p) => p.connected).map((p) => p.id));

const noop = () => {};

/** Older phones that ask for the classic controller get the phone view without host buttons. */
function Controller(props: ControllerProps<Pub, undefined>) {
  return <Phone {...props} isHost={false} hostAct={noop} together />;
}

function OptionsForm({ value, onChange }: { value: Options; onChange: (o: Options) => void }) {
  const seconds = typeof value.seconds === "number" ? value.seconds : 30;
  return (
    <div className="space-y-4">
      <NumberPicker
        label="Time to start singing"
        value={seconds}
        onChange={(s) => onChange({ ...value, seconds: s })}
        options={[20, 30, 45, 0]}
        format={(n) => (n ? `${n}s` : "No timer")}
      />
      <Toggle label="Show song hints to the singing team" value={value.hints} onChange={(hints) => onChange({ ...value, hints })} />
    </div>
  );
}

const antakshari: GameModule<State, Pub, undefined, Options> = {
  id: "antakshari",
  paper: true,
  tvPaper: true,
  defaultOptions: { hints: false, seconds: 30 },
  OptionsForm,
  init({ players, options, now }) {
    const ids = shuffle(players.map((p) => p.id));
    const teams: [string[], string[]] = [ids.filter((_, i) => i % 2 === 0), ids.filter((_, i) => i % 2 === 1)];
    const base: State = {
      options: { hints: !!options.hints, seconds: typeof options.seconds === "number" ? options.seconds : 30 },
      teams,
      turn: 0,
      letter: pick(START_LETTERS),
      phase: "singing",
      votes: {},
      scores: [0, 0],
      songsSung: 0,
      hintSeed: Math.floor(Math.random() * 100),
      lastEvent: null,
      deadline: null,
      pausedLeft: null,
      awaySince: null,
    };
    return startTurn(base, now);
  },
  onPlayerJoin(s, p) {
    if (teamOf(s, p.id) !== null) return s;
    const t: Team = s.teams[0].length <= s.teams[1].length ? 0 : 1;
    const teams: [string[], string[]] = [[...s.teams[0]], [...s.teams[1]]];
    teams[t].push(p.id);
    return { ...s, teams };
  },
  reduce(s, a, { now, players }) {
    if (a.playerId === HOST_ID) {
      switch (a.type) {
        case "accept":
          return s.phase === "judging" || s.phase === "challenged" ? accept(s, now) : s;
        case "reject":
          return s.phase === "judging" || s.phase === "challenged"
            ? startTurn({ ...s, lastEvent: { text: "Nahi chalega — try another song!", at: now, kind: "reject", team: s.turn } }, now)
            : s;
        case "letter": {
          const l = String(a.payload ?? "").toUpperCase();
          if (s.phase !== "next-letter" || !LETTERS.includes(l)) return s;
          return startTurn({ ...s, letter: l, turn: other(s.turn) }, now);
        }
        case "newLetter":
          return s.phase === "singing" ? startTurn({ ...s, letter: pick(START_LETTERS.filter((l) => l !== s.letter)) }, now) : s;
        case "hint":
          return { ...s, hintSeed: s.hintSeed + 1 };
        case "toggleHints":
          return { ...s, options: { ...s.options, hints: !s.options.hints } };
        case "pause": {
          if (!secondsOf(s)) return s;
          if (s.pausedLeft !== null) {
            // Resume
            return s.phase === "singing" ? { ...s, deadline: now + s.pausedLeft, pausedLeft: null } : { ...s, pausedLeft: null };
          }
          const left = s.phase === "singing" && s.deadline ? Math.max(1000, s.deadline - now) : secondsOf(s) * 1000;
          return { ...s, deadline: null, pausedLeft: left };
        }
        case "skipTurn":
          // Hand the turn to the other team, no points, fresh letter.
          return startTurn(
            {
              ...s,
              turn: other(s.turn),
              letter: pick(START_LETTERS.filter((l) => l !== s.letter)),
              lastEvent: { text: `Turn skipped — ${TEAM_NAMES[other(s.turn)]} ki baari`, at: now, kind: "skip", team: other(s.turn) },
            },
            now,
          );
      }
      return s;
    }
    const team = teamOf(s, a.playerId);
    if (team === null) return s;
    if (team === s.turn) {
      if (a.type === "sang" && s.phase === "singing") {
        const judges = s.teams[other(s.turn)].filter((id) => connectedIds(players).has(id));
        // Nobody on the other team to judge: the song counts.
        if (judges.length === 0) return accept(s, now);
        return { ...s, phase: "judging", votes: {}, deadline: null };
      }
      if (a.type === "giveup" && s.phase === "singing") return concede(s, now, "giveup");
      if (a.type === "letter" && s.phase === "next-letter") {
        const l = String(a.payload ?? "").toUpperCase();
        if (!LETTERS.includes(l)) return s;
        return startTurn({ ...s, letter: l, turn: other(s.turn) }, now);
      }
      return s;
    }
    if (a.type === "vote" && s.phase === "judging" && (a.payload === "valid" || a.payload === "challenge")) {
      const vote: "valid" | "challenge" = a.payload;
      if (s.votes[a.playerId] === vote) return s;
      const votes: State["votes"] = { ...s.votes, [a.playerId]: vote };
      if (vote === "challenge") return { ...s, votes, phase: "challenged" };
      const connected = connectedIds(players);
      const judges = s.teams[team].filter((id) => connected.has(id));
      if (judges.every((id) => votes[id] === "valid")) return accept({ ...s, votes }, now);
      return { ...s, votes };
    }
    return s;
  },
  tick(s, { now, players }) {
    const connected = connectedIds(players);
    // Judges who went offline don't hold up the vote.
    if (s.phase === "judging") {
      const judges = s.teams[other(s.turn)].filter((id) => connected.has(id));
      if (judges.length === 0 || judges.every((id) => s.votes[id] === "valid")) return accept(s, now);
    }
    // The team whose turn it is has nobody online: move on after a while.
    if (s.phase === "singing" || s.phase === "next-letter") {
      const anyone = s.teams[s.turn].some((id) => connected.has(id));
      if (anyone) {
        if (s.awaySince !== null) return { ...s, awaySince: null };
      } else if (s.awaySince === null) {
        return { ...s, awaySince: now };
      } else if (now - s.awaySince >= AWAY_MS) {
        const next: State = {
          ...s,
          turn: other(s.turn),
          letter: s.phase === "next-letter" ? pick(START_LETTERS) : s.letter,
          lastEvent: { text: `${TEAM_NAMES[s.turn]} offline — ${TEAM_NAMES[other(s.turn)]} ki baari`, at: now, kind: "skip", team: other(s.turn) },
        };
        return startTurn(next, now);
      }
    }
    if (s.phase === "singing" && s.deadline !== null && now >= s.deadline) return concede(s, now, "timeout");
    return s;
  },
  publicView(s) {
    const songs = songsFor(s.letter);
    return {
      teams: s.teams,
      teamNames: TEAM_NAMES,
      turn: s.turn,
      letter: s.letter,
      phase: s.phase,
      votes: s.votes,
      scores: s.scores,
      songsSung: s.songsSung,
      hintsOn: s.options.hints,
      hint: s.options.hints && songs.length ? songs[s.hintSeed % songs.length] : null,
      lastEvent: s.lastEvent,
      seconds: secondsOf(s),
      deadline: s.deadline ?? null,
      paused: s.pausedLeft != null,
      pausedLeft: s.pausedLeft ?? null,
      awaySince: s.awaySince ?? null,
    };
  },
  Screen: TvScreen,
  Controller,
  Phone,
};

export default antakshari;
