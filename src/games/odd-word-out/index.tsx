"use client";
import { Avatar } from "@/components/Avatar";
import { Button, LevelPicker, NumberPicker, Panel, PlayerChip, Scoreboard } from "@/components/ui";
import { pairsFor } from "@/content/odd-word-out";
import { HOST_ID, type ControllerProps, type GameModule, type Level, type Player, type ScreenProps } from "@/lib/types";
import { answerMatches, pick, shuffle } from "@/lib/util";
import { Phone } from "./PaperPhone";

export interface Options {
  level: Level;
  /** Seconds to vote; time up counts the votes. */
  voteSeconds?: number;
}

export type Phase = "clues" | "vote" | "imposter-guess" | "reveal";

/** Time the caught Imposter gets to guess the real word. */
export const GUESS_SECONDS = 45;
const DEFAULT_VOTE_SECONDS = 60;

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
  /** Points each player won in the last finished round (for the reveal count-up). */
  gains: Record<string, number>;
  voteDeadline: number | null;
  guessDeadline: number | null;
  used: string[];
}

export interface Pub {
  round: number;
  phase: Phase;
  participants: string[];
  order: string[];
  speaker: number;
  clueRound: number;
  voted: string[];
  accused: string | null;
  voteDeadline: number | null;
  voteSeconds: number;
  guessDeadline: number | null;
  reveal: null | {
    imposterId: string;
    majorityWord: string;
    imposterWord: string;
    caught: boolean;
    imposterGuess: string | null;
    guessCorrect: boolean;
    votes: Record<string, string>;
    gains: Record<string, number>;
  };
  scores: Record<string, number>;
}

export interface Priv {
  word: string;
  myVote: string | null;
  mustGuess: boolean;
}

const voteSecondsOf = (o: Options) => o.voteSeconds ?? DEFAULT_VOTE_SECONDS;

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
    gains: {},
    voteDeadline: null,
    guessDeadline: null,
    used: [...(fresh.length ? used : []), pair.a],
  };
}

function addPoints(s: State, gains: Record<string, number>): Pick<State, "scores" | "gains"> {
  const scores = { ...s.scores };
  for (const [id, n] of Object.entries(gains)) scores[id] = (scores[id] ?? 0) + n;
  return { scores, gains };
}

function closeVoting(s: State, now: number): State {
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
  if (accused === s.imposterId) return { ...s, accused, phase: "imposter-guess", voteDeadline: null, guessDeadline: now + GUESS_SECONDS * 1000 };
  return { ...s, accused, phase: "reveal", voteDeadline: null, ...addPoints(s, { [s.imposterId]: 3 }) };
}

function resolveGuess(s: State, guess: string | null): State {
  const correct = guess ? answerMatches(guess, [s.majorityWord]) : false;
  const gains: Record<string, number> = {};
  if (correct) gains[s.imposterId] = 3;
  else s.participants.filter((id) => id !== s.imposterId).forEach((id) => (gains[id] = 1));
  return { ...s, phase: "reveal", imposterGuess: guess, guessCorrect: correct, guessDeadline: null, ...addPoints(s, gains) };
}

/** Next speaker index after `from` whose phone is connected (or the last index if none). */
function nextPresent(s: State, from: number, players: Player[]): number {
  const online = new Set(players.filter((p) => p.connected).map((p) => p.id));
  for (let i = from + 1; i < s.order.length; i++) if (online.has(s.order[i])) return i;
  return s.order.length - 1;
}

function firstPresent(s: State, players: Player[]): number {
  const online = new Set(players.filter((p) => p.connected).map((p) => p.id));
  const i = s.order.findIndex((id) => online.has(id));
  return i < 0 ? 0 : i;
}

/** Everyone still connected has voted (votes from people who left aren't needed). */
function allPresentVoted(s: State, players: Player[]): boolean {
  const online = new Set(players.filter((p) => p.connected).map((p) => p.id));
  const waiting = s.participants.filter((id) => online.has(id) && !(id in s.votes));
  return waiting.length === 0 && Object.keys(s.votes).length > 0;
}

export const nameOf = (players: Player[], id: string | null) => players.find((p) => p.id === id)?.name ?? "Someone";
const findP = (players: Player[], id: string): Player => players.find((p) => p.id === id) ?? { id, name: "Left", avatar: "", connected: false };

export function revealLine(r: NonNullable<Pub["reveal"]>, players: Player[]) {
  const imp = nameOf(players, r.imposterId);
  if (!r.caught) return `${imp} was the Imposter, and got away!`;
  if (r.guessCorrect) return `${imp} was caught, but guessed “${r.majorityWord}”. Imposter steals the round!`;
  return `Caught! ${imp} was the Imposter${r.imposterGuess ? ` (guessed “${r.imposterGuess}”)` : ""}.`;
}

/** Big-screen (TV) view. Host controls are hidden when it's a read-only spectator. */
function Screen({ view, players, act, now, spectator }: ScreenProps<Pub>) {
  const secs = (d: number | null) => (d ? Math.max(0, Math.ceil((d - now) / 1000)) : null);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {view.phase === "clues" && (
          <Panel className="space-y-5 py-8 text-center">
            <div className="text-muted">
              Round {view.round} · Clue round {view.clueRound}
            </div>
            <div className="text-3xl font-bold">Say ONE word about your secret word</div>
            <div className="text-5xl font-extrabold">
              <Avatar id={findP(players, view.order[view.speaker]).avatar} /> {nameOf(players, view.order[view.speaker])}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {view.order.map((id, i) => (
                <PlayerChip key={id} player={findP(players, id)} highlight={i === view.speaker} extra={<span className="text-sm">{i < view.speaker ? "done" : i + 1}</span>} />
              ))}
            </div>
            {!spectator && (
              <div className="flex flex-wrap justify-center gap-3">
                {view.speaker < view.order.length - 1 ? (
                  <Button size="lg" onClick={() => act("nextSpeaker")}>
                    Next speaker
                  </Button>
                ) : (
                  <Button size="lg" tone="ghost" onClick={() => act("anotherRound")}>
                    Another clue round
                  </Button>
                )}
                <Button size="lg" tone="pink" onClick={() => act("startVote")}>
                  Start voting
                </Button>
              </div>
            )}
          </Panel>
        )}
        {view.phase === "vote" && (
          <Panel className="space-y-5 py-8 text-center">
            <div className="text-4xl font-extrabold">Vote on your phone: who has the odd word?</div>
            {view.voteDeadline && <div className="text-5xl font-extrabold tabular-nums">{secs(view.voteDeadline)}s</div>}
            <div className="flex flex-wrap justify-center gap-2">
              {view.participants.map((id) => (
                <PlayerChip key={id} player={findP(players, id)} extra={<span>{view.voted.includes(id) ? "voted" : "…"}</span>} />
              ))}
            </div>
            {!spectator && (
              <Button tone="ghost" onClick={() => act("closeVote")}>
                Close voting now
              </Button>
            )}
          </Panel>
        )}
        {view.phase === "imposter-guess" && (
          <Panel className="space-y-4 py-8 text-center">
            <div className="text-4xl font-extrabold">
              Caught! <span className="text-pink">{nameOf(players, view.accused)}</span> is the Imposter!
            </div>
            <div className="text-2xl text-muted">One last chance: they’re guessing everyone else’s word… {secs(view.guessDeadline)}s</div>
            {!spectator && (
              <Button tone="ghost" onClick={() => act("skipGuess")}>
                Skip guess
              </Button>
            )}
          </Panel>
        )}
        {view.phase === "reveal" && view.reveal && (
          <Panel className="pop-in space-y-5 py-8 text-center">
            <div className="text-3xl font-bold">{revealLine(view.reveal, players)}</div>
            <div className="flex flex-wrap items-center justify-center gap-6">
              <div className="rounded-3xl bg-tint px-8 py-4">
                <div className="text-sm text-muted">Everyone’s word</div>
                <div className="text-4xl font-extrabold">{view.reveal.majorityWord}</div>
              </div>
              <div className="rounded-3xl bg-tint px-8 py-4">
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
            {!spectator && (
              <Button size="lg" onClick={() => act("next")}>
                Next round
              </Button>
            )}
          </Panel>
        )}
      </div>
      <Scoreboard players={players} scores={view.scores} />
    </div>
  );
}

const noop = () => {};

/** Older phone entry point: the paper phone view without host controls. */
function Controller(props: ControllerProps<Pub, Priv>) {
  return <Phone {...props} isHost={false} hostAct={noop} together />;
}

function OptionsForm({ value, onChange }: { value: Options; onChange: (o: Options) => void }) {
  return (
    <div className="space-y-4">
      <LevelPicker value={value.level} onChange={(level) => onChange({ ...value, level })} />
      <NumberPicker label="Time to vote" value={voteSecondsOf(value)} onChange={(voteSeconds) => onChange({ ...value, voteSeconds })} options={[45, 60, 90]} format={(n) => `${n}s`} />
      <p className="text-sm text-muted">Best with 4 or more players.</p>
    </div>
  );
}

function activeIds(players: Player[], fallback: string[]) {
  const online = players.filter((p) => p.connected).map((p) => p.id);
  return online.length >= 3 ? online : fallback;
}

const oddWordOut: GameModule<State, Pub, Priv, Options> = {
  id: "odd-word-out",
  paper: true,
  defaultOptions: { level: "family", voteSeconds: DEFAULT_VOTE_SECONDS },
  OptionsForm,
  init({ players, options }) {
    return deal(options, players.map((p) => p.id), 1, {}, []);
  },
  reduce(s, a, { players, now }) {
    if (a.playerId === HOST_ID) {
      switch (a.type) {
        case "nextSpeaker":
          return s.phase === "clues" && s.speaker < s.order.length - 1 ? { ...s, speaker: nextPresent(s, s.speaker, players) } : s;
        case "anotherRound":
          return s.phase === "clues" ? { ...s, speaker: firstPresent(s, players), clueRound: s.clueRound + 1 } : s;
        case "startVote":
          return s.phase === "clues" ? { ...s, phase: "vote", voteDeadline: now + voteSecondsOf(s.options) * 1000 } : s;
        case "closeVote":
          return s.phase === "vote" ? closeVoting(s, now) : s;
        case "skipGuess":
          return s.phase === "imposter-guess" ? resolveGuess(s, null) : s;
        case "next":
          return s.phase === "reveal" ? deal(s.options, activeIds(players, s.participants), s.round + 1, s.scores, s.used) : s;
      }
      return s;
    }
    if (!s.participants.includes(a.playerId)) return s;
    if (a.type === "vote" && s.phase === "vote") {
      const target = a.payload as string | null;
      if (target === null) {
        if (!(a.playerId in s.votes)) return s;
        const votes = { ...s.votes };
        delete votes[a.playerId];
        return { ...s, votes };
      }
      if (target === a.playerId || !s.participants.includes(target) || s.votes[a.playerId] === target) return s;
      const next = { ...s, votes: { ...s.votes, [a.playerId]: target } };
      return allPresentVoted(next, players) ? closeVoting(next, now) : next;
    }
    if (a.type === "guess" && s.phase === "imposter-guess" && a.playerId === s.imposterId) {
      return resolveGuess(s, String(a.payload ?? "").slice(0, 40));
    }
    return s;
  },
  tick(s, { players, now }) {
    if (s.phase === "vote") {
      if (s.voteDeadline && now >= s.voteDeadline) return closeVoting(s, now);
      // Someone who hadn't voted left the room: don't wait for them.
      if (allPresentVoted(s, players)) return closeVoting(s, now);
    }
    if (s.phase === "imposter-guess" && s.guessDeadline && now >= s.guessDeadline) return resolveGuess(s, null);
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
      voteDeadline: s.phase === "vote" ? s.voteDeadline : null,
      voteSeconds: voteSecondsOf(s.options),
      guessDeadline: s.phase === "imposter-guess" ? s.guessDeadline : null,
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
              gains: s.gains,
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
  Phone,
};

export default oddWordOut;
