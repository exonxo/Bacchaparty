"use client";
import { Avatar } from "@/components/Avatar";
import { Button, LevelPicker, Panel, PlayerChip, Stopwatch } from "@/components/ui";
import { CHARADES } from "@/content/charades";
import { HOST_ID, type ControllerProps, type GameModule, type Level, type Player, type ScreenProps } from "@/lib/types";
import { Phone } from "./PaperPhone";
import { shuffle } from "@/lib/util";

export type Team = "A" | "B";
export const TEAM_NAMES: Record<Team, string> = { A: "Team Laddoo", B: "Team Jalebi" };
/** How long the actor's phone may be offline before the turn passes to a teammate. */
export const AWAY_MS = 10_000;
const TEAM_COLORS: Record<Team, string> = { A: "#ff9933", B: "#ff4fa3" };

interface Options {
  level: Level;
}

interface State {
  level: Level;
  deck: string[];
  teams: Record<Team, string[]>;
  scores: Record<Team, number>;
  turnTeam: Team;
  actorIdx: Record<Team, number>;
  actorId: string | null;
  movie: string | null;
  phase: "ready" | "acting";
  turnStart: number | null;
  passes: number;
  lastResult: LastResult | null;
  turns: number;
  /** When the current actor's phone went offline (host clock), or null. */
  actorAwaySince: number | null;
}

export interface LastResult {
  /** got: team guessed it · pass: chit went back · switch: actor changed · reveal: host moved on */
  kind: "got" | "pass" | "switch" | "reveal";
  team: Team;
  movie: string | null;
  text: string;
  good: boolean;
  at: number;
}

export interface Pub {
  teams: Record<Team, string[]>;
  scores: Record<Team, number>;
  turnTeam: Team;
  actorId: string | null;
  phase: State["phase"];
  turnStart: number | null;
  passes: number;
  lastResult: State["lastResult"];
  turns: number;
  deckLeft: number;
  actorAwaySince: number | null;
}

export interface Priv {
  movie: string;
}

function deckFor(level: Level): string[] {
  const lists = level === "kids" ? [CHARADES.kids] : level === "family" ? [CHARADES.kids, CHARADES.family] : [CHARADES.family, CHARADES.adults];
  return shuffle([...new Set(lists.flat())]);
}

function drawMovie(s: State): { movie: string; deck: string[] } {
  let deck = s.deck;
  if (deck.length === 0) deck = deckFor(s.level);
  return { movie: deck[0], deck: deck.slice(1) };
}

/** Picks the next actor of `team` starting at actorIdx, skipping players who left or are offline. */
function chooseActor(s: State, team: Team, players: Player[], advance: boolean): State {
  const present = new Set(players.filter((p) => p.connected).map((p) => p.id));
  const members = s.teams[team];
  if (members.length === 0) return { ...s, turnTeam: team, actorId: null, movie: null, phase: "ready", turnStart: null, actorAwaySince: null };
  let idx = s.actorIdx[team] + (advance ? 1 : 0);
  for (let i = 0; i < members.length; i++) {
    const id = members[(idx + i) % members.length];
    if (present.has(id)) {
      idx = (idx + i) % members.length;
      return { ...s, turnTeam: team, actorIdx: { ...s.actorIdx, [team]: idx }, actorId: id, movie: null, phase: "ready", turnStart: null, passes: 0, actorAwaySince: null };
    }
  }
  return { ...s, turnTeam: team, actorId: null, movie: null, phase: "ready", turnStart: null, passes: 0, actorAwaySince: null };
}

function nextTurn(s: State, players: Player[]): State {
  const other: Team = s.turnTeam === "A" ? "B" : "A";
  const team = s.teams[other].length ? other : s.turnTeam;
  // The team that just played advances its actor for next time.
  const advanced = { ...s, actorIdx: { ...s.actorIdx, [s.turnTeam]: s.actorIdx[s.turnTeam] + 1 }, turns: s.turns + 1 };
  return chooseActor(advanced, team, players, false);
}

function name(players: Player[], id: string | null) {
  return players.find((p) => p.id === id)?.name ?? "Someone";
}

function Screen({ view, players, act, now, spectator }: ScreenProps<Pub>) {
  const actor = players.find((p) => p.id === view.actorId);
  const teamName = TEAM_NAMES[view.turnTeam];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <Panel className="flex min-h-[26rem] flex-col items-center justify-center gap-5 text-center">
        <div className="rounded-full px-5 py-1.5 text-xl font-extrabold text-bg" style={{ background: TEAM_COLORS[view.turnTeam] }}>
          {teamName}&apos;s turn
        </div>
        {actor ? (
          <>
            <div className="text-8xl"><Avatar id={actor.avatar} /></div>
            <div className="text-5xl font-extrabold">{actor.name}</div>
            {view.phase === "ready" ? (
              <div className="text-2xl text-muted">is getting ready… tap “Show my movie” on your phone!</div>
            ) : (
              <>
                <div className="text-3xl font-bold text-gold">is acting! No talking!</div>
                <div className="flex items-center gap-3 text-2xl">
                  <Stopwatch since={view.turnStart} now={now} />
                  {view.passes > 0 && <span className="text-muted">{view.passes} pass{view.passes > 1 ? "es" : ""}</span>}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="text-2xl text-muted">No one from {teamName} is connected.</div>
        )}
        {view.lastResult && now - view.lastResult.at < 6000 && (
          <div className={`pop-in rounded-2xl px-5 py-2 text-xl font-bold ${view.lastResult.good ? "bg-green text-bg" : "bg-white/10"}`}>{view.lastResult.text}</div>
        )}
        {!spectator && (
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {view.phase === "acting" && (
              <>
                <Button tone="green" onClick={() => act("got")}>
                  Got it
                </Button>
                <Button tone="ghost" onClick={() => act("pass")}>
                  New movie
                </Button>
              </>
            )}
            <Button tone="ghost" onClick={() => act("skipActor")}>
              Different actor
            </Button>
            <Button tone="ghost" onClick={() => act("nextTurn")}>
              Other team’s turn
            </Button>
          </div>
        )}
      </Panel>
      <div className="space-y-4">
        {(["A", "B"] as Team[]).map((t) => (
          <Panel key={t} className={view.turnTeam === t ? "ring-4" : ""}>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-extrabold" style={{ color: TEAM_COLORS[t] }}>
                {TEAM_NAMES[t]}
              </div>
              <div className="text-5xl font-extrabold text-gold">{view.scores[t]}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {view.teams[t].map((id) => {
                const p = players.find((x) => x.id === id);
                return p ? <PlayerChip key={id} player={p} highlight={id === view.actorId} /> : null;
              })}
            </div>
          </Panel>
        ))}
        <div className="text-center text-muted">No timer — take your time! Turns played: {view.turns}</div>
      </div>
    </div>
  );
}

/** Phones use the paper view; this keeps the classic controller path working without host controls. */
function Controller(props: ControllerProps<Pub, Priv>) {
  return <Phone {...props} isHost={false} hostAct={() => {}} together />;
}

function OptionsForm({ value, onChange }: { value: Options; onChange: (o: Options) => void }) {
  return (
    <div className="space-y-3">
      <LevelPicker value={value.level} onChange={(level) => onChange({ ...value, level })} />
      <p className="text-sm text-muted">No countdown — each turn shows a stopwatch instead. Teams are split automatically. Best with 4 or more (2 per team).</p>
    </div>
  );
}

const charades: GameModule<State, Pub, Priv, Options> = {
  id: "charades",
  paper: true,
  defaultOptions: { level: "family" },
  OptionsForm,
  init({ players, options }) {
    const order = shuffle(players);
    const teams: Record<Team, string[]> = { A: [], B: [] };
    order.forEach((p, i) => teams[i % 2 === 0 ? "A" : "B"].push(p.id));
    const base: State = {
      level: options.level,
      deck: deckFor(options.level),
      teams,
      scores: { A: 0, B: 0 },
      turnTeam: "A",
      actorIdx: { A: 0, B: 0 },
      actorId: null,
      movie: null,
      phase: "ready",
      turnStart: null,
      passes: 0,
      lastResult: null,
      turns: 0,
      actorAwaySince: null,
    };
    return chooseActor(base, "A", players, false);
  },
  onPlayerJoin(s, p) {
    if (s.teams.A.includes(p.id) || s.teams.B.includes(p.id)) return s;
    const t: Team = s.teams.A.length <= s.teams.B.length ? "A" : "B";
    const next = { ...s, teams: { ...s.teams, [t]: [...s.teams[t], p.id] } };
    if (!next.actorId && next.turnTeam === t) return { ...next, actorId: p.id, actorIdx: { ...next.actorIdx, [t]: next.teams[t].length - 1 } };
    return next;
  },
  reduce(s, a, { now, players }) {
    const isHost = a.playerId === HOST_ID;
    const isActor = a.playerId === s.actorId;
    if (!isHost && !isActor) return s;
    switch (a.type) {
      case "start": {
        if (s.phase !== "ready" || !s.actorId) return s;
        const { movie, deck } = drawMovie(s);
        return { ...s, movie, deck, phase: "acting", turnStart: now, passes: 0 };
      }
      case "got": {
        if (s.phase !== "acting" || !s.movie) return s;
        const scored: State = {
          ...s,
          scores: { ...s.scores, [s.turnTeam]: s.scores[s.turnTeam] + 1 },
          lastResult: { kind: "got", team: s.turnTeam, movie: s.movie, text: `${TEAM_NAMES[s.turnTeam]} got “${s.movie}”!`, good: true, at: now },
        };
        return nextTurn(scored, players);
      }
      case "pass": {
        if (s.phase !== "acting") return s;
        const { movie, deck } = drawMovie(s);
        // The passed chit goes back to the bottom of the bowl.
        return {
          ...s,
          movie,
          deck: s.movie ? [...deck, s.movie] : deck,
          passes: s.passes + 1,
          lastResult: { kind: "pass", team: s.turnTeam, movie: s.movie, text: `Passed on “${s.movie}”`, good: false, at: now },
        };
      }
      case "skipActor": {
        if (!isHost) return s;
        const next = chooseActor({ ...s, deck: s.movie ? [...s.deck, s.movie] : s.deck }, s.turnTeam, players, true);
        const who = name(players, next.actorId);
        return { ...next, lastResult: { kind: "switch", team: s.turnTeam, movie: null, text: next.actorId ? `New actor: ${who}` : "No one else can act right now", good: false, at: now } };
      }
      case "nextTurn": {
        if (!isHost) return s;
        return nextTurn(
          { ...s, lastResult: s.movie ? { kind: "reveal", team: s.turnTeam, movie: s.movie, text: `The movie was “${s.movie}”`, good: false, at: now } : s.lastResult },
          players,
        );
      }
    }
    return s;
  },
  tick(s, { players, now }) {
    const actor = s.actorId ? players.find((p) => p.id === s.actorId) : null;
    // The actor left the room: hand the turn to the next teammate straight away.
    if (s.actorId && !actor) return chooseActor(s, s.turnTeam, players, true);
    // The actor's phone went offline: wait a little, then pick the next teammate.
    if (actor && !actor.connected) {
      if (s.actorAwaySince === null) return { ...s, actorAwaySince: now };
      if (now - s.actorAwaySince < AWAY_MS) return s;
      const next = chooseActor({ ...s, deck: s.movie ? [...s.deck, s.movie] : s.deck }, s.turnTeam, players, true);
      return { ...next, lastResult: { kind: "switch", team: s.turnTeam, movie: null, text: `${actor.name}’s phone went offline — next actor`, good: false, at: now } };
    }
    if (actor && s.actorAwaySince !== null) return { ...s, actorAwaySince: null };
    if (!s.actorId && players.some((p) => p.connected && s.teams[s.turnTeam].includes(p.id))) return chooseActor(s, s.turnTeam, players, false);
    return s;
  },
  publicView(s) {
    return {
      teams: s.teams,
      scores: s.scores,
      turnTeam: s.turnTeam,
      actorId: s.actorId,
      phase: s.phase,
      turnStart: s.turnStart,
      passes: s.passes,
      lastResult: s.lastResult,
      turns: s.turns,
      deckLeft: s.deck.length,
      actorAwaySince: s.actorAwaySince,
    };
  },
  privateView(s, id) {
    if (id !== s.actorId || s.phase !== "acting" || !s.movie) return undefined;
    return { movie: s.movie };
  },
  Screen,
  Controller,
  Phone,
};

export default charades;
