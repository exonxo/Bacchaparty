"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import { SuggestPaperButton } from "@/components/suggest/SuggestPaperButton";
import { requestSuggest } from "@/lib/suggest/client";
import { NumberPicker } from "@/components/ui";
import { CHOR_TOPICS, CHOR_TOPIC_ALL, resolveRoundTopic, topicById, topicLabel, type ChorTopic, type ChorTopicChoice } from "@/content/chor-kaun";
import { HOST_ID, type ControllerProps, type GameModule, type Player } from "@/lib/types";
import { Phone } from "./PaperPhone";
import { TvScreen } from "./TvScreen";
import { TopicPickerLobby } from "./TopicPicker";
import { pick, shuffle } from "@/lib/util";

export interface Options {
  topic: ChorTopicChoice;
  minutes: number;
  /** AI- or host-added packs merged at runtime (not in defaultOptions). */
  extraTopics?: ChorTopic[];
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
  topicId: string;
  topicLabel: string;
  majorityWord: string;
  chorWord: string;
  chorId: string;
  firstAsker: string;
  votes: Record<string, string>;
  deadline: number;
  phase: "playing" | "reveal";
  result: Result | null;
  scores: Record<string, number>;
  usedMajorityWords: string[];
}

export interface Pub {
  round: number;
  phase: State["phase"];
  participants: string[];
  firstAsker: string;
  deadline: number;
  /** Length of a round in ms, for the timer bar. */
  roundMs: number;
  voteCounts: Record<string, number>;
  voted: string[];
  topicId: string;
  topicLabel: string;
  topicSetting: ChorTopicChoice;
  wordChoices: string[];
  scores: Record<string, number>;
  reveal: null | {
    topicLabel: string;
    majorityWord: string;
    chorWord: string;
    chorId: string;
    result: Result;
  };
}

export type Priv =
  | { chor: true; word: string; myVote: string | null }
  | { chor: false; word: string; myVote: string | null };

function activeIds(players: Player[], fallback: string[]): string[] {
  const online = players.filter((p) => p.connected).map((p) => p.id);
  return online.length >= 3 ? online : fallback;
}

function pickWords(topic: ChorTopic, used: string[]): { majorityWord: string; chorWord: string; usedMajorityWords: string[] } {
  const pool = [...topic.words];
  const fresh = pool.filter((w) => !used.includes(w));
  const majorityWord = pick(fresh.length ? fresh : pool);
  const others = pool.filter((w) => w !== majorityWord);
  const chorWord = pick(others.length ? others : pool.filter((w) => w !== majorityWord)) ?? majorityWord;
  return {
    majorityWord,
    chorWord,
    usedMajorityWords: [...(fresh.length ? used : []), majorityWord],
  };
}

function deal(options: Options, participants: string[], now: number, scores: Record<string, number>, round: number, usedMajorityWords: string[]): State {
  const topic = resolveRoundTopic(options.topic, options.extraTopics);
  const { majorityWord, chorWord, usedMajorityWords: nextUsed } = pickWords(topic, usedMajorityWords);
  const chorId = pick(participants);
  const nextScores = { ...scores };
  participants.forEach((id) => (nextScores[id] ??= 0));
  return {
    options,
    round,
    participants,
    topicId: topic.id,
    topicLabel: topic.label,
    majorityWord,
    chorWord,
    chorId,
    firstAsker: pick(participants),
    votes: {},
    deadline: now + options.minutes * 60_000,
    phase: "playing",
    result: null,
    scores: nextScores,
    usedMajorityWords: nextUsed,
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
    chorGuessCorrect = chorGuess === s.majorityWord;
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

const noop = () => {};

function Controller(props: ControllerProps<Pub, Priv>) {
  return <Phone {...props} isHost={false} hostAct={noop} together />;
}

function OptionsForm({ value, onChange }: { value: Options; onChange: (o: Options) => void }) {
  return (
    <div className="space-y-4">
      <TopicOptionsField value={value} onChange={onChange} />
      <NumberPicker label="Round time" value={value.minutes} options={[5, 8, 10]} format={(n) => `${n} min`} onChange={(minutes) => onChange({ ...value, minutes })} />
    </div>
  );
}

function TopicOptionsField({ value, onChange }: { value: Options; onChange: (o: Options) => void }) {
  const params = useParams();
  const roomCode = typeof params?.code === "string" ? params.code : undefined;
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const freshTopic = async () => {
    setLoading(true);
    try {
      const { data } = await requestSuggest<ChorTopic>(
        "chor-kaun-topic",
        { excludeTopicIds: [...CHOR_TOPICS.map((t) => t.id), ...(value.extraTopics ?? []).map((t) => t.id)] },
        roomCode,
      );
      const extraTopics = [...(value.extraTopics ?? []).filter((t) => t.id !== data.id), data];
      onChange({ ...value, topic: data.id, extraTopics });
      setHint(`${data.emoji} ${data.label} · ${data.words.length} words`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-muted">Topic</div>
        <SuggestPaperButton loading={loading} onClick={() => void freshTopic()}>
          ✨ Fresh topic
        </SuggestPaperButton>
      </div>
      {hint && <p className="text-p-note text-muted">{hint}</p>}
      <TopicPickerLobby value={value.topic} extraTopics={value.extraTopics} onChange={(topic) => onChange({ ...value, topic })} />
    </div>
  );
}

const chorKaun: GameModule<State, Pub, Priv, Options> = {
  id: "chor-kaun",
  paper: true,
  tvPaper: true,
  defaultOptions: { topic: CHOR_TOPIC_ALL, minutes: 8 },
  OptionsForm,
  init({ players, options, now }) {
    return deal(options, players.map((p) => p.id), now, {}, 1, []);
  },
  reduce(s, a, { now, players }) {
    if (a.playerId === HOST_ID) {
      if (a.type === "topic" && s.phase === "reveal" && typeof a.payload === "string") {
        const topic = a.payload as ChorTopicChoice;
        return { ...s, options: { ...s.options, topic } };
      }
      if (a.type === "end" && s.phase === "playing") return finish(s, "host");
      if (a.type === "next" && s.phase === "reveal") return deal(s.options, activeIds(players, s.participants), now, s.scores, s.round + 1, s.usedMajorityWords);
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
    const pack = topicById(s.topicId) ?? s.options.extraTopics?.find((t) => t.id === s.topicId);
    const words = pack ? [...pack.words] : [];
    const roundTopic =
      s.options.topic === CHOR_TOPIC_ALL ? `${topicLabel(CHOR_TOPIC_ALL)} · ${s.topicLabel}` : s.topicLabel;
    return {
      round: s.round,
      phase: s.phase,
      participants: s.participants,
      firstAsker: s.firstAsker,
      deadline: s.deadline,
      roundMs: s.options.minutes * 60_000,
      voteCounts: s.phase === "reveal" ? counts : {},
      voted: Object.keys(s.votes),
      topicId: s.topicId,
      topicLabel: roundTopic,
      topicSetting: s.options.topic,
      wordChoices: shuffle(words),
      scores: s.scores,
      reveal:
        s.phase === "reveal" && s.result
          ? {
              topicLabel: s.topicLabel,
              majorityWord: s.majorityWord,
              chorWord: s.chorWord,
              chorId: s.chorId,
              result: s.result,
            }
          : null,
    };
  },
  privateView(s, id) {
    if (!s.participants.includes(id) || s.phase !== "playing") return undefined;
    const myVote = s.votes[id] ?? null;
    if (id === s.chorId) return { chor: true, word: s.chorWord, myVote };
    return { chor: false, word: s.majorityWord, myVote };
  },
  Screen: TvScreen,
  Controller,
  Phone,
};

export default chorKaun;
