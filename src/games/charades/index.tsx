"use client";
import { Avatar } from "@/components/Avatar";
import { Button, LevelPicker, Panel, PhoneMessage, PlayerChip, Stopwatch } from "@/components/ui";
import { CHARADES } from "@/content/charades";
import { HOST_ID, type ControllerProps, type GameModule, type Level, type Player, type ScreenProps } from "@/lib/types";
import { shuffle } from "@/lib/util";

type Team = "A" | "B";
const TEAM_NAMES: Record<Team, string> = { A: "Team Laddoo", B: "Team Jalebi" };
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
  lastResult: { text: string; good: boolean; at: number } | null;
  turns: number;
}

interface Pub {
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
}

interface Priv {
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

/** Picks the next actor of `team` starting at actorIdx, skipping players who left. */
function chooseActor(s: State, team: Team, players: Player[], advance: boolean): State {
  const present = new Set(players.map((p) => p.id));
  const members = s.teams[team];
  if (members.length === 0) return { ...s, turnTeam: team, actorId: null, movie: null, phase: "ready", turnStart: null };
  let idx = s.actorIdx[team] + (advance ? 1 : 0);
  for (let i = 0; i < members.length; i++) {
    const id = members[(idx + i) % members.length];
    if (present.has(id)) {
      idx = (idx + i) % members.length;
      return { ...s, turnTeam: team, actorIdx: { ...s.actorIdx, [team]: idx }, actorId: id, movie: null, phase: "ready", turnStart: null, passes: 0 };
    }
  }
  return { ...s, turnTeam: team, actorId: null, movie: null, phase: "ready", turnStart: null, passes: 0 };
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

function Screen({ view, players, act, now }: ScreenProps<Pub>) {
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
                <div className="text-3xl font-bold text-gold">is acting! 🤫 No talking!</div>
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
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {view.phase === "acting" && (
            <>
              <Button tone="green" onClick={() => act("got")}>
                ✅ Got it
              </Button>
              <Button tone="ghost" onClick={() => act("pass")}>
                ⏭ New movie
              </Button>
            </>
          )}
          <Button tone="ghost" onClick={() => act("skipActor")}>
            🙋 Different actor
          </Button>
          <Button tone="ghost" onClick={() => act("nextTurn")}>
            🔁 Other team’s turn
          </Button>
        </div>
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

function Controller({ view, priv, me, players, send, now }: ControllerProps<Pub, Priv>) {
  const myTeam: Team | null = view.teams.A.includes(me.id) ? "A" : view.teams.B.includes(me.id) ? "B" : null;
  const isActor = view.actorId === me.id;
  const header = myTeam && (
    <div className="mb-4 flex items-center justify-between rounded-2xl px-4 py-2 font-bold text-bg" style={{ background: TEAM_COLORS[myTeam] }}>
      <span>{TEAM_NAMES[myTeam]}</span>
      <span>
        {view.scores.A} – {view.scores.B}
      </span>
    </div>
  );
  if (isActor && view.phase === "ready") {
    return (
      <div>
        {header}
        <PhoneMessage emoji="🎬" title="You're acting!">
          Hide your screen from everyone, then tap below.
        </PhoneMessage>
        <Button size="xl" className="w-full" onClick={() => send("start")}>
          👀 Show my movie
        </Button>
      </div>
    );
  }
  if (isActor && view.phase === "acting") {
    const words = priv?.movie ? priv.movie.replace(/\(.*?\)/g, "").trim().split(/\s+/).length : 0;
    return (
      <div className="space-y-4">
        {header}
        <Panel className="py-8 text-center">
          <div className="text-sm font-bold uppercase tracking-widest text-muted">Act out</div>
          <div className="mt-2 text-4xl font-extrabold leading-tight text-gold">{priv?.movie ?? "…"}</div>
          {words > 0 && <div className="mt-3 text-lg text-muted">{words} word{words > 1 ? "s" : ""}</div>}
          <div className="mt-3">
            <Stopwatch since={view.turnStart} now={now} />
          </div>
        </Panel>
        <Button tone="green" size="xl" className="w-full" onClick={() => send("got")}>
          ✅ Got it!
        </Button>
        <Button tone="ghost" size="lg" className="w-full" onClick={() => send("pass")}>
          ⏭ Pass — new movie
        </Button>
        <p className="text-center text-sm text-muted">Fingers for words · tug your ear for “sounds like” · no talking!</p>
      </div>
    );
  }
  const actorName = name(players, view.actorId);
  const myTurn = myTeam === view.turnTeam;
  return (
    <div>
      {header}
      <PhoneMessage emoji={myTurn ? "🤔" : "🍿"} title={myTurn ? `Guess what ${actorName} is acting!` : `${actorName} is acting for the other team`}>
        {myTurn ? "Shout your guesses out loud." : "Stay quiet and enjoy the show!"}
      </PhoneMessage>
    </div>
  );
}

function OptionsForm({ value, onChange }: { value: Options; onChange: (o: Options) => void }) {
  return (
    <div className="space-y-3">
      <LevelPicker value={value.level} onChange={(level) => onChange({ ...value, level })} />
      <p className="text-sm text-muted">No countdown — each turn shows a stopwatch instead. Teams are split automatically.</p>
    </div>
  );
}

const charades: GameModule<State, Pub, Priv, Options> = {
  id: "charades",
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
        const scored = {
          ...s,
          scores: { ...s.scores, [s.turnTeam]: s.scores[s.turnTeam] + 1 },
          lastResult: { text: `🎉 ${TEAM_NAMES[s.turnTeam]} got “${s.movie}”!`, good: true, at: now },
        };
        return nextTurn(scored, players);
      }
      case "pass": {
        if (s.phase !== "acting") return s;
        const { movie, deck } = drawMovie(s);
        return { ...s, movie, deck, passes: s.passes + 1, lastResult: { text: `Passed on “${s.movie}”`, good: false, at: now } };
      }
      case "skipActor": {
        if (!isHost) return s;
        return chooseActor(s, s.turnTeam, players, true);
      }
      case "nextTurn": {
        if (!isHost) return s;
        return nextTurn({ ...s, lastResult: s.movie ? { text: `The movie was “${s.movie}”`, good: false, at: now } : s.lastResult }, players);
      }
    }
    return s;
  },
  tick(s, { players }) {
    // If the actor disconnects/leaves, hand the turn to the next teammate.
    if (s.actorId && !players.some((p) => p.id === s.actorId)) return chooseActor(s, s.turnTeam, players, true);
    if (!s.actorId && players.some((p) => s.teams[s.turnTeam].includes(p.id))) return chooseActor(s, s.turnTeam, players, false);
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
    };
  },
  privateView(s, id) {
    if (id !== s.actorId || s.phase !== "acting" || !s.movie) return undefined;
    return { movie: s.movie };
  },
  Screen,
  Controller,
};

export default charades;
