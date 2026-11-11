"use client";
import { useState } from "react";
import { Button, LevelPicker, NumberPicker, Panel, PhoneMessage, PlayerChip, Scoreboard } from "@/components/ui";
import { locationsFor, type ChorLocation } from "@/content/chor-kaun";
import { HOST_ID, type GameModule, type Level, type Player } from "@/lib/types";
import { pick, shuffle } from "@/lib/util";

interface Options {
  level: Level;
  minutes: number;
}

type Reason = "vote" | "timer" | "guess" | "host";

interface Result {
  reason: Reason;
  accused: string | null;
  caught: boolean;
  chorGuess: string | null;
  chorGuessCorrect: boolean;
}

interface State {
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

interface Pub {
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

type Priv =
  | { chor: true; myVote: string | null }
  | { chor: false; location: string; emoji: string; role: string; myVote: string | null };

/** mm:ss timer (the shared Countdown shows raw seconds, too long for minutes). */
function Timer({ deadline, now, big = false }: { deadline: number; now: number; big?: boolean }) {
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const text = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full font-extrabold tabular-nums ${left <= 30 ? "bg-red text-white" : "bg-white/10"} ${
        big ? "px-8 py-4 text-6xl" : "px-3 py-1 text-xl"
      }`}
    >
      ⏱ {text}
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

function nameOf(players: Player[], id: string | null | undefined) {
  return players.find((p) => p.id === id)?.name ?? "Someone";
}

function resultText(r: Result, players: Player[], chorId: string): string {
  const chor = nameOf(players, chorId);
  if (r.reason === "guess") return r.chorGuessCorrect ? `${chor} guessed the place — the Chor wins!` : `${chor} guessed “${r.chorGuess}” — wrong! Chor caught!`;
  if (r.caught) return `You caught the Chor — it was ${chor}!`;
  if (!r.accused) return `No clear vote — ${chor} the Chor escapes!`;
  return `${nameOf(players, r.accused)} was innocent! ${chor} the Chor escapes!`;
}

function Screen({ view, players, act, now }: { view: Pub; players: Player[]; act: (t: string, p?: unknown) => void; now: number }) {
  const parts = view.participants.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {view.phase === "playing" ? (
          <Panel className="space-y-5 py-8 text-center">
            <div className="text-muted">Round {view.round}</div>
            <div className="text-4xl font-extrabold">🤫 Check your phone secretly!</div>
            <div className="text-2xl">
              <span className="font-bold text-gold">{nameOf(players, view.firstAsker)}</span> asks the first question.
            </div>
            <Timer deadline={view.deadline} now={now} big />
            <div className="text-muted">Vote anytime on your phone. The Chor can guess the place anytime.</div>
            <Button tone="ghost" onClick={() => confirm("Stop the round and count votes now?") && act("end")}>
              Stop & count votes
            </Button>
          </Panel>
        ) : (
          view.reveal && (
            <Panel className="pop-in space-y-4 py-8 text-center">
              <div className="text-6xl">{view.reveal.location.emoji}</div>
              <div className="text-xl text-muted">The place was</div>
              <div className="text-5xl font-extrabold text-gold">{view.reveal.location.name}</div>
              <div className="text-2xl font-bold">{resultText(view.reveal.result, players, view.reveal.chorId)}</div>
              <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2">
                {parts.map((p) => (
                  <PlayerChip
                    key={p.id}
                    player={p}
                    highlight={p.id === view.reveal!.chorId}
                    extra={<span className="text-sm opacity-80">· {p.id === view.reveal!.chorId ? "🦹 Chor" : view.reveal!.roles[p.id]}</span>}
                  />
                ))}
              </div>
              <Button size="lg" onClick={() => act("next")}>
                Next round ▶
              </Button>
            </Panel>
          )
        )}
        <Panel>
          <div className="mb-3 text-sm font-bold uppercase tracking-widest text-muted">Votes</div>
          <div className="flex flex-wrap gap-2">
            {parts.map((p) => (
              <PlayerChip
                key={p.id}
                player={p}
                extra={
                  <span className="text-sm">
                    {view.voted.includes(p.id) ? "✅" : "…"} {view.voteCounts[p.id] ? `· ${view.voteCounts[p.id]} 🗳️` : ""}
                  </span>
                }
              />
            ))}
          </div>
        </Panel>
        <Panel>
          <div className="mb-3 text-sm font-bold uppercase tracking-widest text-muted">Possible places</div>
          <div className="flex flex-wrap gap-2">
            {view.locations.map((l) => (
              <span key={l.name} className="rounded-full bg-white/5 px-3 py-1 text-sm">
                {l.emoji} {l.name}
              </span>
            ))}
          </div>
        </Panel>
      </div>
      <Scoreboard players={players} scores={view.scores} />
    </div>
  );
}

function Controller({ view, priv, me, players, send, now }: { view: Pub; priv: Priv | undefined; me: Player; players: Player[]; send: (t: string, p?: unknown) => void; now: number }) {
  const [hidden, setHidden] = useState(false);
  const [guessing, setGuessing] = useState(false);
  if (view.phase === "reveal" && view.reveal) {
    const r = view.reveal;
    const iWasChor = r.chorId === me.id;
    return (
      <PhoneMessage emoji={r.location.emoji} title={r.location.name}>
        <div className="font-bold text-ink">{resultText(r.result, players, r.chorId)}</div>
        <div className="mt-2">{iWasChor ? "You were the Chor 🦹" : `You were: ${r.roles[me.id] ?? "watching"}`}</div>
        <div className="mt-4 text-3xl font-extrabold text-gold">{view.scores[me.id] ?? 0} pts</div>
        <div className="mt-2 text-sm">Waiting for the host to start the next round…</div>
      </PhoneMessage>
    );
  }
  if (!view.participants.includes(me.id)) return <PhoneMessage emoji="👀" title="You’ll join next round">Watch the big screen!</PhoneMessage>;
  if (!priv) return <PhoneMessage emoji="🃏" title="Dealing cards…" />;
  const others = view.participants.filter((id) => id !== me.id).map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];

  if (guessing && priv.chor) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xl font-bold">Where are we?</div>
          <Button tone="ghost" size="sm" onClick={() => setGuessing(false)}>
            Back
          </Button>
        </div>
        <div className="text-sm text-muted">One guess only! Wrong guess = you’re caught.</div>
        <div className="grid grid-cols-2 gap-2">
          {view.locations.map((l) => (
            <button
              key={l.name}
              onClick={() => confirm(`Final answer: ${l.name}?`) && send("guess", l.name)}
              className="rounded-2xl bg-white/10 px-3 py-3 text-left font-semibold"
            >
              {l.emoji} {l.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button onClick={() => setHidden((h) => !h)} className="block w-full">
        <Panel className={`text-center ${priv.chor ? "border-red/60" : "border-gold/60"}`}>
          {hidden ? (
            <div className="py-6 text-xl font-bold text-muted">🙈 Hidden — tap to show</div>
          ) : priv.chor ? (
            <div className="py-2">
              <div className="text-6xl">🦹</div>
              <div className="text-3xl font-extrabold text-red">You are the Chor!</div>
              <div className="text-muted">Blend in. Figure out the place.</div>
            </div>
          ) : (
            <div className="py-2">
              <div className="text-6xl">{priv.emoji}</div>
              <div className="text-3xl font-extrabold text-gold">{priv.location}</div>
              <div className="text-lg">
                Your role: <b>{priv.role}</b>
              </div>
            </div>
          )}
          {!hidden && <div className="mt-2 text-xs text-muted">Tap to hide</div>}
        </Panel>
      </button>
      <div className="flex items-center justify-between">
        <div className="text-lg font-bold">Who is the Chor?</div>
        <Timer deadline={view.deadline} now={now} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {others.map((p) => (
          <button
            key={p.id}
            onClick={() => send("vote", priv.myVote === p.id ? null : p.id)}
            className={`flex items-center gap-2 rounded-2xl px-3 py-3 text-left font-bold ${priv.myVote === p.id ? "bg-pink text-white" : "bg-white/10"}`}
          >
            <span className="text-2xl">{p.avatar}</span>
            <span className="truncate">{p.name}</span>
          </button>
        ))}
      </div>
      <div className="text-center text-sm text-muted">{priv.myVote ? "Tap again to take back your vote." : "You can change your vote anytime."}</div>
      {priv.chor && (
        <Button tone="red" size="lg" className="w-full" onClick={() => setGuessing(true)}>
          🕵️ I know the place!
        </Button>
      )}
    </div>
  );
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
      voteCounts: counts,
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
};

export default chorKaun;
