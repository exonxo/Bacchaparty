"use client";
import { useState } from "react";
import { Button, LevelPicker, Panel, PhoneMessage, PlayerChip, Scoreboard, TextAnswer } from "@/components/ui";
import { pairsFor } from "@/content/odd-word-out";
import { HOST_ID, type GameModule, type Level, type Player } from "@/lib/types";
import { answerMatches, pick, shuffle } from "@/lib/util";

interface Options {
  level: Level;
}

type Phase = "clues" | "vote" | "imposter-guess" | "reveal";

interface State {
  options: Options;
  round: number;
  participants: string[];
  order: string[];
  speaker: number;
  clueRound: number;
  majorityWord: string;
  imposterWord: string;
  imposterId: string;
  phase: Phase;
  votes: Record<string, string>;
  accused: string | null;
  imposterGuess: string | null;
  guessCorrect: boolean;
  scores: Record<string, number>;
  used: string[];
}

interface Pub {
  round: number;
  phase: Phase;
  participants: string[];
  order: string[];
  speaker: number;
  clueRound: number;
  voted: string[];
  accused: string | null;
  reveal: null | {
    imposterId: string;
    majorityWord: string;
    imposterWord: string;
    caught: boolean;
    imposterGuess: string | null;
    guessCorrect: boolean;
    votes: Record<string, string>;
  };
  scores: Record<string, number>;
}

interface Priv {
  word: string;
  myVote: string | null;
  mustGuess: boolean;
}

function deal(options: Options, participants: string[], round: number, scores: Record<string, number>, used: string[]): State {
  const pool = pairsFor(options.level);
  const fresh = pool.filter((p) => !used.includes(p.a));
  const pair = pick(fresh.length ? fresh : pool);
  // Randomly swap which word is the "majority" so players can't learn the pattern.
  const [majorityWord, imposterWord] = Math.random() < 0.5 ? [pair.a, pair.b] : [pair.b, pair.a];
  const next = { ...scores };
  participants.forEach((id) => (next[id] ??= 0));
  return {
    options,
    round,
    participants,
    order: shuffle(participants),
    speaker: 0,
    clueRound: 1,
    majorityWord,
    imposterWord,
    imposterId: pick(participants),
    phase: "clues",
    votes: {},
    accused: null,
    imposterGuess: null,
    guessCorrect: false,
    scores: next,
    used: [...(fresh.length ? used : []), pair.a],
  };
}

function closeVoting(s: State): State {
  const counts: Record<string, number> = {};
  Object.values(s.votes).forEach((t) => (counts[t] = (counts[t] ?? 0) + 1));
  let accused: string | null = null;
  let best = 0;
  let tie = false;
  for (const [id, n] of Object.entries(counts)) {
    if (n > best) {
      best = n;
      accused = id;
      tie = false;
    } else if (n === best) tie = true;
  }
  if (tie) accused = null;
  if (accused === s.imposterId) return { ...s, accused, phase: "imposter-guess" };
  const scores = { ...s.scores, [s.imposterId]: (s.scores[s.imposterId] ?? 0) + 3 };
  return { ...s, accused, phase: "reveal", scores };
}

function resolveGuess(s: State, guess: string | null): State {
  const correct = guess ? answerMatches(guess, [s.majorityWord]) : false;
  const scores = { ...s.scores };
  if (correct) scores[s.imposterId] = (scores[s.imposterId] ?? 0) + 3;
  else s.participants.filter((id) => id !== s.imposterId).forEach((id) => (scores[id] = (scores[id] ?? 0) + 1));
  return { ...s, phase: "reveal", imposterGuess: guess, guessCorrect: correct, scores };
}

const nameOf = (players: Player[], id: string | null) => players.find((p) => p.id === id)?.name ?? "Someone";
const findP = (players: Player[], id: string): Player => players.find((p) => p.id === id) ?? { id, name: "Left", avatar: "👋", connected: false };

function revealLine(r: NonNullable<Pub["reveal"]>, players: Player[]) {
  const imp = nameOf(players, r.imposterId);
  if (!r.caught) return `${imp} was the Imposter — and got away! 🏃`;
  if (r.guessCorrect) return `${imp} was caught, but guessed “${r.majorityWord}” — Imposter steals the win!`;
  return `Caught! ${imp} was the Imposter${r.imposterGuess ? ` (guessed “${r.imposterGuess}”)` : ""}.`;
}

function Screen({ view, players, act }: { view: Pub; players: Player[]; act: (t: string, p?: unknown) => void }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {view.phase === "clues" && (
          <Panel className="space-y-5 py-8 text-center">
            <div className="text-muted">
              Round {view.round} · Clue round {view.clueRound}
            </div>
            <div className="text-3xl font-bold">Say ONE word about your secret word</div>
            <div className="text-5xl font-extrabold text-gold">
              {findP(players, view.order[view.speaker]).avatar} {nameOf(players, view.order[view.speaker])}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {view.order.map((id, i) => (
                <PlayerChip key={id} player={findP(players, id)} highlight={i === view.speaker} extra={<span className="text-sm">{i < view.speaker ? "✓" : i + 1}</span>} />
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {view.speaker < view.order.length - 1 ? (
                <Button size="lg" onClick={() => act("nextSpeaker")}>
                  Next speaker ▶
                </Button>
              ) : (
                <Button size="lg" tone="ghost" onClick={() => act("anotherRound")}>
                  🔁 Another clue round
                </Button>
              )}
              <Button size="lg" tone="pink" onClick={() => act("startVote")}>
                🗳️ Start voting
              </Button>
            </div>
          </Panel>
        )}
        {view.phase === "vote" && (
          <Panel className="space-y-5 py-8 text-center">
            <div className="text-4xl font-extrabold">🗳️ Vote on your phone: who has the odd word?</div>
            <div className="flex flex-wrap justify-center gap-2">
              {view.participants.map((id) => (
                <PlayerChip key={id} player={findP(players, id)} extra={<span>{view.voted.includes(id) ? "✅" : "…"}</span>} />
              ))}
            </div>
            <Button tone="ghost" onClick={() => act("closeVote")}>
              Close voting now
            </Button>
          </Panel>
        )}
        {view.phase === "imposter-guess" && (
          <Panel className="space-y-4 py-8 text-center">
            <div className="text-5xl">🎯</div>
            <div className="text-4xl font-extrabold">
              Caught! <span className="text-pink">{nameOf(players, view.accused)}</span> is the Imposter!
            </div>
            <div className="text-2xl text-muted">One last chance: they’re guessing everyone else’s word…</div>
            <Button tone="ghost" onClick={() => act("skipGuess")}>
              Skip guess
            </Button>
          </Panel>
        )}
        {view.phase === "reveal" && view.reveal && (
          <Panel className="pop-in space-y-5 py-8 text-center">
            <div className="text-3xl font-bold">{revealLine(view.reveal, players)}</div>
            <div className="flex flex-wrap items-center justify-center gap-6">
              <div className="rounded-3xl bg-white/5 px-8 py-4">
                <div className="text-sm text-muted">Everyone’s word</div>
                <div className="text-4xl font-extrabold text-gold">{view.reveal.majorityWord}</div>
              </div>
              <div className="rounded-3xl bg-white/5 px-8 py-4">
                <div className="text-sm text-muted">Imposter’s word</div>
                <div className="text-4xl font-extrabold text-pink">{view.reveal.imposterWord}</div>
              </div>
            </div>
            <div className="mx-auto max-w-xl space-y-1 text-left text-lg">
              {Object.entries(view.reveal.votes).map(([voter, target]) => (
                <div key={voter}>
                  {nameOf(players, voter)} → <b>{nameOf(players, target)}</b>
                </div>
              ))}
            </div>
            <Button size="lg" onClick={() => act("next")}>
              Next round ▶
            </Button>
          </Panel>
        )}
      </div>
      <Scoreboard players={players} scores={view.scores} />
    </div>
  );
}

function Controller({ view, priv, me, players, send }: { view: Pub; priv: Priv | undefined; me: Player; players: Player[]; send: (t: string, p?: unknown) => void }) {
  const [hidden, setHidden] = useState(false);
  if (view.phase === "reveal" && view.reveal) {
    return (
      <PhoneMessage emoji={view.reveal.imposterId === me.id ? "🤫" : "🎉"} title={revealLine(view.reveal, players)}>
        Words: <b className="text-gold">{view.reveal.majorityWord}</b> vs <b className="text-pink">{view.reveal.imposterWord}</b>
        <div className="mt-3 text-3xl font-extrabold text-gold">{view.scores[me.id] ?? 0} pts</div>
      </PhoneMessage>
    );
  }
  if (!view.participants.includes(me.id)) return <PhoneMessage emoji="👀" title="You’ll join next round">Watch the big screen!</PhoneMessage>;
  if (!priv) return <PhoneMessage emoji="🃏" title="Getting your word…" />;

  if (view.phase === "imposter-guess") {
    if (priv.mustGuess)
      return (
        <div className="space-y-4">
          <PhoneMessage emoji="🎯" title="You were the Imposter!">
            Your word was different. Guess everyone else’s word to steal the win!
          </PhoneMessage>
          <TextAnswer onSubmit={(t) => send("guess", t)} placeholder="Their word was…" buttonLabel="Guess" />
        </div>
      );
    return <PhoneMessage emoji="🎯" title={`${nameOf(players, view.accused)} is the Imposter!`}>They’re making one last guess…</PhoneMessage>;
  }

  const others = view.participants.filter((id) => id !== me.id).map((id) => findP(players, id));
  return (
    <div className="space-y-5">
      <button className="block w-full" onClick={() => setHidden((h) => !h)}>
        <Panel className="py-6 text-center">
          <div className="text-sm text-muted">Your secret word</div>
          <div className="text-4xl font-extrabold text-gold">{hidden ? "🙈 ••••" : priv.word}</div>
          <div className="mt-1 text-xs text-muted">Tap to {hidden ? "show" : "hide"}</div>
        </Panel>
      </button>
      {view.phase === "clues" && (
        <div className="text-center text-lg">
          {view.order[view.speaker] === me.id ? (
            <b className="text-gold">Your turn! Say one word out loud.</b>
          ) : (
            <span className="text-muted">Listen to {nameOf(players, view.order[view.speaker])}’s clue…</span>
          )}
        </div>
      )}
      {view.phase === "vote" && (
        <div className="space-y-3">
          <div className="text-center text-xl font-bold">Who has the odd word?</div>
          <div className="grid grid-cols-2 gap-2">
            {others.map((p) => (
              <button
                key={p.id}
                onClick={() => send("vote", p.id)}
                className={`flex items-center gap-2 rounded-2xl px-3 py-3 text-left font-bold ${priv.myVote === p.id ? "bg-pink text-white" : "bg-white/10"}`}
              >
                <span className="text-2xl">{p.avatar}</span>
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
          <div className="text-center text-sm text-muted">{priv.myVote ? "You can change your vote until everyone has voted." : "Tap a name to vote."}</div>
        </div>
      )}
    </div>
  );
}

function OptionsForm({ value, onChange }: { value: Options; onChange: (o: Options) => void }) {
  return <LevelPicker value={value.level} onChange={(level) => onChange({ ...value, level })} />;
}

function activeIds(players: Player[], fallback: string[]) {
  const online = players.filter((p) => p.connected).map((p) => p.id);
  return online.length >= 3 ? online : fallback;
}

const oddWordOut: GameModule<State, Pub, Priv, Options> = {
  id: "odd-word-out",
  defaultOptions: { level: "family" },
  OptionsForm,
  init({ players, options }) {
    return deal(options, players.map((p) => p.id), 1, {}, []);
  },
  reduce(s, a, { players }) {
    if (a.playerId === HOST_ID) {
      switch (a.type) {
        case "nextSpeaker":
          return s.phase === "clues" && s.speaker < s.order.length - 1 ? { ...s, speaker: s.speaker + 1 } : s;
        case "anotherRound":
          return s.phase === "clues" ? { ...s, speaker: 0, clueRound: s.clueRound + 1 } : s;
        case "startVote":
          return s.phase === "clues" ? { ...s, phase: "vote" } : s;
        case "closeVote":
          return s.phase === "vote" ? closeVoting(s) : s;
        case "skipGuess":
          return s.phase === "imposter-guess" ? resolveGuess(s, null) : s;
        case "next":
          return s.phase === "reveal" ? deal(s.options, activeIds(players, s.participants), s.round + 1, s.scores, s.used) : s;
      }
      return s;
    }
    if (!s.participants.includes(a.playerId)) return s;
    if (a.type === "vote" && s.phase === "vote") {
      const target = a.payload as string;
      if (target === a.playerId || !s.participants.includes(target) || s.votes[a.playerId] === target) return s;
      const next = { ...s, votes: { ...s.votes, [a.playerId]: target } };
      const connected = new Set(players.filter((p) => p.connected).map((p) => p.id));
      const waiting = s.participants.filter((id) => connected.has(id) && !(id in next.votes));
      return waiting.length === 0 ? closeVoting(next) : next;
    }
    if (a.type === "guess" && s.phase === "imposter-guess" && a.playerId === s.imposterId) {
      return resolveGuess(s, String(a.payload ?? "").slice(0, 40));
    }
    return s;
  },
  publicView(s) {
    return {
      round: s.round,
      phase: s.phase,
      participants: s.participants,
      order: s.order,
      speaker: s.speaker,
      clueRound: s.clueRound,
      voted: Object.keys(s.votes),
      accused: s.phase === "imposter-guess" || s.phase === "reveal" ? s.accused : null,
      reveal:
        s.phase === "reveal"
          ? {
              imposterId: s.imposterId,
              majorityWord: s.majorityWord,
              imposterWord: s.imposterWord,
              caught: s.accused === s.imposterId,
              imposterGuess: s.imposterGuess,
              guessCorrect: s.guessCorrect,
              votes: s.votes,
            }
          : null,
      scores: s.scores,
    };
  },
  privateView(s, id) {
    if (!s.participants.includes(id) || s.phase === "reveal") return undefined;
    return {
      word: id === s.imposterId ? s.imposterWord : s.majorityWord,
      myVote: s.votes[id] ?? null,
      mustGuess: s.phase === "imposter-guess" && id === s.imposterId,
    };
  },
  Screen,
  Controller,
};

export default oddWordOut;
