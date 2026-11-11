"use client";
import { Check, EyeOff, MapPin, Timer as TimerIcon, Vote } from "lucide-react";
import { Button, Label, LevelPicker, NumberPicker, Panel, PlayerChip, Scoreboard } from "@/components/ui";
import { locationsFor, type ChorLocation } from "@/content/chor-kaun";
import { HOST_ID, type ControllerProps, type GameModule, type Level, type Player, type ScreenProps } from "@/lib/types";
import { fmt, nameOf, resultText } from "./helpers";
import { Phone } from "./PaperPhone";
import { pick, shuffle } from "@/lib/util";

export interface Options {
  level: Level;
  minutes: number;
}

export type Reason = "vote" | "timer" | "guess" | "host";

export interface Result {
  reason: Reason;
  accused: string | null;
  caught: boolean;
  chorGuess: string | null;
  chorGuessCorrect: boolean;
}

export interface State {
  options: Options;
  round: number;
  participants: string[];
  location: ChorLocation;
  roles: Record<string, string>;
  chorId: string;
  firstAsker: string;
  votes: Record<string, string>;
  deadline: number;
  phase: "playing" | "reveal";
  result: Result | null;
  scores: Record<string, number>;
  usedLocations: string[];
}

export interface Pub {
  round: number;
  phase: State["phase"];
  participants: string[];
  firstAsker: string;
  deadline: number;
  voteCounts: Record<string, number>;
  voted: string[];
  locations: { name: string; emoji: string }[];
  scores: Record<string, number>;
  reveal: null | {
    location: { name: string; emoji: string };
    chorId: string;
    roles: Record<string, string>;
    result: Result;
  };
}

export type Priv =
  | { chor: true; myVote: string | null }
  | { chor: false; location: string; emoji: string; role: string; myVote: string | null };

/** mm:ss timer pill. */
function TimerPill({ deadline, now, big = false }: { deadline: number; now: number; big?: boolean }) {
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full font-display font-bold tabular-nums ${left <= 30 ? "bg-red text-white" : "bg-white/[0.08]"} ${
        big ? "px-8 py-4 text-6xl" : "px-3 py-1.5 text-base"
      }`}
    >
      <TimerIcon className={big ? "h-12 w-12" : "h-4 w-4"} />
      {fmt(left)}
    </div>
  );
}

function activeIds(players: Player[], fallback: string[]): string[] {
  const online = players.filter((p) => p.connected).map((p) => p.id);
  return online.length >= 3 ? online : fallback;
}

function deal(options: Options, participants: string[], now: number, scores: Record<string, number>, round: number, used: string[]): State {
  const pool = locationsFor(options.level);
  const fresh = pool.filter((l) => !used.includes(l.name));
  const location = pick(fresh.length ? fresh : pool);
  const chorId = pick(participants);
  const roleList = shuffle(location.roles);
  const roles: Record<string, string> = {};
  participants.forEach((id, i) => {
    if (id !== chorId) roles[id] = roleList[i % roleList.length];
  });
  const nextScores = { ...scores };
  participants.forEach((id) => (nextScores[id] ??= 0));
  return {
    options,
    round,
    participants,
    location,
    roles,
    chorId,
    firstAsker: pick(participants),
    votes: {},
    deadline: now + options.minutes * 60_000,
    phase: "playing",
    result: null,
    scores: nextScores,
    usedLocations: [...(fresh.length ? used : []), location.name],
  };
}

function tally(s: State): { counts: Record<string, number>; leader: string | null } {
  const counts: Record<string, number> = {};
  Object.values(s.votes).forEach((t) => (counts[t] = (counts[t] ?? 0) + 1));
  let leader: string | null = null;
  let best = 0;
  let tie = false;
  for (const [id, n] of Object.entries(counts)) {
    if (n > best) {
      best = n;
      leader = id;
      tie = false;
    } else if (n === best) tie = true;
  }
  return { counts, leader: tie ? null : leader };
}

function finish(s: State, reason: Reason, chorGuess: string | null = null): State {
  let accused: string | null = null;
  let caught = false;
  let chorGuessCorrect = false;
  const scores = { ...s.scores };
  const others = s.participants.filter((id) => id !== s.chorId);
  if (reason === "guess") {
    chorGuessCorrect = chorGuess === s.location.name;
    if (chorGuessCorrect) scores[s.chorId] = (scores[s.chorId] ?? 0) + 3;
    else {
      caught = true;
      others.forEach((id) => (scores[id] = (scores[id] ?? 0) + 1));
    }
  } else {
    accused = tally(s).leader;
    caught = accused === s.chorId;
    if (caught) others.forEach((id) => (scores[id] = (scores[id] ?? 0) + 1));
    else scores[s.chorId] = (scores[s.chorId] ?? 0) + 2;
  }
  return { ...s, phase: "reveal", scores, result: { reason, accused, caught, chorGuess, chorGuessCorrect } };
}

/** Voting closes early when a majority of the non-Chor players agree on one person. */
function checkMajority(s: State): State {
  const nonChor = s.participants.filter((id) => id !== s.chorId);
  const counts: Record<string, number> = {};
  for (const [voter, target] of Object.entries(s.votes)) {
    if (voter === s.chorId) continue;
    counts[target] = (counts[target] ?? 0) + 1;
  }
  const hit = Object.values(counts).some((n) => n > nonChor.length / 2);
  return hit ? finish(s, "vote") : s;
}

function Screen({ view, players, act, now, spectator }: ScreenProps<Pub>) {
  const parts = view.participants.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {view.phase === "playing" ? (
          <Panel className="space-y-5 py-8 text-center">
            <Label>Round {view.round}</Label>
            <div className="flex items-center justify-center gap-3 font-display text-4xl font-black">
              <EyeOff className="h-9 w-9 text-saffron" /> Check your phone secretly
            </div>
            <div className="text-2xl">
              <span className="font-bold text-saffron">{nameOf(players, view.firstAsker)}</span> asks the first question.
            </div>
            <TimerPill deadline={view.deadline} now={now} big />
            <div className="text-muted">Vote anytime on your phone. The Chor can guess the place anytime.</div>
            {!spectator && (
              <Button tone="ghost" onClick={() => confirm("Stop the round and count votes now?") && act("end")}>
                Stop & count votes
              </Button>
            )}
          </Panel>
        ) : (
          view.reveal && (
            <Panel className="pop-in space-y-4 py-8 text-center">
              <MapPin className="mx-auto h-12 w-12 text-saffron" />
              <div className="text-xl text-muted">The place was</div>
              <div className="font-display text-5xl font-black text-saffron">{view.reveal.location.name}</div>
              <div className="text-2xl font-bold">{resultText(view.reveal.result, players, view.reveal.chorId)}</div>
              <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2">
                {parts.map((p) => (
                  <PlayerChip
                    key={p.id}
                    player={p}
                    highlight={p.id === view.reveal!.chorId}
                    extra={<span className="text-sm opacity-80">· {p.id === view.reveal!.chorId ? "Chor" : view.reveal!.roles[p.id]}</span>}
                  />
                ))}
              </div>
              {!spectator && (
                <Button size="lg" onClick={() => act("next")}>
                  Next round
                </Button>
              )}
            </Panel>
          )
        )}
        <Panel>
          <Label className="mb-3">Votes</Label>
          <div className="flex flex-wrap gap-2">
            {parts.map((p) => (
              <PlayerChip
                key={p.id}
                player={p}
                extra={
                  <span className="flex items-center gap-1 text-sm">
                    {view.voted.includes(p.id) ? <Check className="h-4 w-4 text-green" /> : <span className="text-muted">…</span>}
                    {view.voteCounts[p.id] ? (
                      <span className="flex items-center gap-0.5 text-saffron">
                        <Vote className="h-3.5 w-3.5" /> {view.voteCounts[p.id]}
                      </span>
                    ) : null}
                  </span>
                }
              />
            ))}
          </div>
        </Panel>
        <Panel>
          <Label className="mb-3">Possible places</Label>
          <div className="flex flex-wrap gap-2">
            {view.locations.map((l) => (
              <span key={l.name} className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-3 py-1 text-sm">
                <MapPin className="h-3.5 w-3.5 text-muted" /> {l.name}
              </span>
            ))}
          </div>
        </Panel>
      </div>
      <Scoreboard players={players} scores={view.scores} />
    </div>
  );
}

const noop = () => {};

/** Classic controller (used with a big screen) — same as the phone view without host controls. */
function Controller(props: ControllerProps<Pub, Priv>) {
  return <Phone {...props} isHost={false} hostAct={noop} together />;
}

function OptionsForm({ value, onChange }: { value: Options; onChange: (o: Options) => void }) {
  return (
    <div className="space-y-4">
      <LevelPicker value={value.level} onChange={(level) => onChange({ ...value, level })} />
      <NumberPicker label="Round time" value={value.minutes} options={[5, 8, 10]} format={(n) => `${n} min`} onChange={(minutes) => onChange({ ...value, minutes })} />
    </div>
  );
}

const chorKaun: GameModule<State, Pub, Priv, Options> = {
  id: "chor-kaun",
  paper: true,
  defaultOptions: { level: "family", minutes: 8 },
  OptionsForm,
  init({ players, options, now }) {
    return deal(options, players.map((p) => p.id), now, {}, 1, []);
  },
  reduce(s, a, { now, players }) {
    if (a.playerId === HOST_ID) {
      if (a.type === "end" && s.phase === "playing") return finish(s, "host");
      if (a.type === "next" && s.phase === "reveal") return deal(s.options, activeIds(players, s.participants), now, s.scores, s.round + 1, s.usedLocations);
      return s;
    }
    if (s.phase !== "playing" || !s.participants.includes(a.playerId)) return s;
    if (a.type === "vote") {
      const target = a.payload as string | null;
      if (target === null) {
        if (!(a.playerId in s.votes)) return s;
        const votes = { ...s.votes };
        delete votes[a.playerId];
        return { ...s, votes };
      }
      if (target === a.playerId || !s.participants.includes(target) || s.votes[a.playerId] === target) return s;
      return checkMajority({ ...s, votes: { ...s.votes, [a.playerId]: target } });
    }
    if (a.type === "guess" && a.playerId === s.chorId && typeof a.payload === "string") return finish(s, "guess", a.payload);
    return s;
  },
  tick(s, { now }) {
    if (s.phase === "playing" && now >= s.deadline) return finish(s, "timer");
    return s;
  },
  publicView(s) {
    const { counts } = tally(s);
    return {
      round: s.round,
      phase: s.phase,
      participants: s.participants,
      firstAsker: s.firstAsker,
      deadline: s.deadline,
      // Hidden during the round so nobody can see who is being suspected.
      voteCounts: s.phase === "reveal" ? counts : {},
      voted: Object.keys(s.votes),
      locations: locationsFor(s.options.level).map((l) => ({ name: l.name, emoji: l.emoji })),
      scores: s.scores,
      reveal:
        s.phase === "reveal" && s.result
          ? { location: { name: s.location.name, emoji: s.location.emoji }, chorId: s.chorId, roles: s.roles, result: s.result }
          : null,
    };
  },
  privateView(s, id) {
    if (!s.participants.includes(id) || s.phase !== "playing") return undefined;
    const myVote = s.votes[id] ?? null;
    if (id === s.chorId) return { chor: true, myVote };
    return { chor: false, location: s.location.name, emoji: s.location.emoji, role: s.roles[id], myVote };
  },
  Screen,
  Controller,
  Phone,
};

export default chorKaun;
