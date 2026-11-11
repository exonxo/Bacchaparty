"use client";
import { Button, Countdown, LevelPicker, NumberPicker, Panel, PhoneMessage, Scoreboard, TextAnswer } from "@/components/ui";
import { EMOJI_PUZZLES, type EmojiPuzzle } from "@/content/emoji-picture";
import { HOST_ID, type ControllerProps, type GameModule, type Level, type ScreenProps } from "@/lib/types";
import { answerMatches, shuffle } from "@/lib/util";

interface Options {
  level: Level;
  count: number;
  seconds: number;
}

type Phase = "question" | "reveal" | "over";

const HINT_AFTER = 20_000;
const REVEAL_FOR = 7_000;
const POINTS = [3, 2];

interface State {
  puzzles: EmojiPuzzle[];
  idx: number;
  seconds: number;
  phase: Phase;
  startedAt: number;
  deadline: number;
  revealUntil: number | null;
  correct: string[];
  tries: Record<string, number>;
  scores: Record<string, number>;
}

interface Pub {
  idx: number;
  total: number;
  phase: Phase;
  emojis: string;
  category: string;
  hint: string;
  hintAt: number;
  deadline: number;
  revealUntil: number | null;
  correct: string[];
  tries: Record<string, number>;
  scores: Record<string, number>;
  answer: string | null;
}

function pickPuzzles(level: Level, count: number): EmojiPuzzle[] {
  const levels: Level[] = level === "kids" ? ["kids"] : level === "family" ? ["kids", "family"] : ["family", "adults"];
  return shuffle(EMOJI_PUZZLES.filter((p) => levels.includes(p.level))).slice(0, count);
}

function startQuestion(s: State, idx: number, now: number): State {
  if (idx >= s.puzzles.length) return { ...s, idx, phase: "over", revealUntil: null };
  return { ...s, idx, phase: "question", startedAt: now, deadline: now + s.seconds * 1000, revealUntil: null, correct: [], tries: {} };
}

function Screen({ view, players, act, now }: ScreenProps<Pub>) {
  if (view.phase === "over") {
    return (
      <div className="mx-auto max-w-xl space-y-6 text-center">
        <div className="text-5xl font-extrabold">🏆 Emoji Picture results</div>
        <Scoreboard players={players} scores={view.scores} big title="Final scores" />
      </div>
    );
  }
  const showHint = view.phase === "question" && now >= view.hintAt;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Panel className="flex min-h-[26rem] flex-col items-center justify-center gap-5 text-center">
        <div className="flex w-full items-center justify-between">
          <span className="text-muted">
            Puzzle {view.idx + 1} of {view.total}
          </span>
          <span className="rounded-full bg-gold px-4 py-1 font-bold text-bg">{view.category}</span>
          {view.phase === "question" ? <Countdown deadline={view.deadline} now={now} /> : <span className="w-12" />}
        </div>
        <div key={view.idx} className="pop-in text-[7rem] leading-none tracking-widest">
          {view.emojis}
        </div>
        {view.phase === "question" && (
          <>
            {showHint ? <div className="pop-in text-2xl text-teal">💡 Hint: {view.hint}</div> : <div className="text-xl text-muted">Type your answer on your phone!</div>}
            <div className="flex flex-wrap justify-center gap-2">
              {view.correct.map((id, i) => {
                const p = players.find((x) => x.id === id);
                return p ? (
                  <span key={id} className="pop-in rounded-full bg-green px-3 py-1 font-bold text-bg">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : "✅"} {p.name}
                  </span>
                ) : null;
              })}
            </div>
            <Button tone="ghost" onClick={() => act("reveal")}>
              👀 Reveal answer
            </Button>
          </>
        )}
        {view.phase === "reveal" && (
          <>
            <div className="pop-in text-5xl font-extrabold text-gold">{view.answer}</div>
            <div className="text-lg">{view.correct.length ? `${view.correct.length} got it!` : "Nobody got this one 😅"}</div>
            <Button onClick={() => act("next")}>Next ▶</Button>
          </>
        )}
      </Panel>
      <Scoreboard players={players} scores={view.scores} />
    </div>
  );
}

function Controller({ view, me, send, now }: ControllerProps<Pub, undefined>) {
  const score = view.scores[me.id] ?? 0;
  if (view.phase === "over") return <PhoneMessage emoji="🏆" title="That's all!">You scored {score} points.</PhoneMessage>;
  const got = view.correct.includes(me.id);
  if (view.phase === "reveal") {
    return (
      <PhoneMessage emoji={got ? "🎉" : "🙈"} title={view.answer ?? ""}>
        {got ? "You got it!" : "Next one's yours!"} · Score: {score}
      </PhoneMessage>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-gold px-3 py-1 text-sm font-bold text-bg">{view.category}</span>
        <Countdown deadline={view.deadline} now={now} />
      </div>
      <div className="text-center text-7xl leading-tight">{view.emojis}</div>
      {now >= view.hintAt && <div className="text-center text-lg text-teal">💡 {view.hint}</div>}
      {got ? (
        <PhoneMessage emoji="✅" title="Correct!">Waiting for the others… Score: {score}</PhoneMessage>
      ) : (
        <>
          <TextAnswer onSubmit={(t) => send("answer", t)} placeholder={`Which ${view.category.toLowerCase()}?`} />
          {(view.tries[me.id] ?? 0) > 0 && <div className="text-center text-muted">Not quite — try again! ({view.tries[me.id]} tries)</div>}
        </>
      )}
    </div>
  );
}

function OptionsForm({ value, onChange }: { value: Options; onChange: (o: Options) => void }) {
  return (
    <div className="space-y-4">
      <LevelPicker value={value.level} onChange={(level) => onChange({ ...value, level })} />
      <NumberPicker label="Puzzles" value={value.count} onChange={(count) => onChange({ ...value, count })} options={[5, 10, 15]} />
      <NumberPicker label="Time per puzzle" value={value.seconds} onChange={(seconds) => onChange({ ...value, seconds })} options={[30, 45, 60, 90]} format={(n) => `${n}s`} />
    </div>
  );
}

const emojiPicture: GameModule<State, Pub, undefined, Options> = {
  id: "emoji-picture",
  defaultOptions: { level: "family", count: 10, seconds: 45 },
  OptionsForm,
  init({ players, options, now }) {
    const base: State = {
      puzzles: pickPuzzles(options.level, options.count),
      idx: 0,
      seconds: options.seconds,
      phase: "question",
      startedAt: now,
      deadline: now,
      revealUntil: null,
      correct: [],
      tries: {},
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    };
    return startQuestion(base, 0, now);
  },
  onPlayerJoin(s, p) {
    if (p.id in s.scores) return s;
    return { ...s, scores: { ...s.scores, [p.id]: 0 } };
  },
  reduce(s, a, { now, players }) {
    if (a.playerId === HOST_ID) {
      if (a.type === "reveal" && s.phase === "question") return { ...s, phase: "reveal", revealUntil: now + REVEAL_FOR };
      if (a.type === "next" && s.phase === "reveal") return startQuestion(s, s.idx + 1, now);
      return s;
    }
    if (a.type !== "answer" || s.phase !== "question" || s.correct.includes(a.playerId)) return s;
    const puzzle = s.puzzles[s.idx];
    const text = String(a.payload ?? "").slice(0, 60);
    const tries = { ...s.tries, [a.playerId]: (s.tries[a.playerId] ?? 0) + 1 };
    if (!answerMatches(text, [puzzle.answer, ...(puzzle.alt ?? [])])) return { ...s, tries };
    const pts = POINTS[s.correct.length] ?? 1;
    const next: State = { ...s, tries, correct: [...s.correct, a.playerId], scores: { ...s.scores, [a.playerId]: (s.scores[a.playerId] ?? 0) + pts } };
    const remaining = players.filter((p) => p.connected && !next.correct.includes(p.id)).length;
    return remaining === 0 ? { ...next, phase: "reveal", revealUntil: now + REVEAL_FOR } : next;
  },
  tick(s, { now }) {
    if (s.phase === "question" && now >= s.deadline) return { ...s, phase: "reveal", revealUntil: now + REVEAL_FOR };
    if (s.phase === "reveal" && s.revealUntil && now >= s.revealUntil) return startQuestion(s, s.idx + 1, now);
    return s;
  },
  publicView(s) {
    const p = s.puzzles[s.idx];
    return {
      idx: s.idx,
      total: s.puzzles.length,
      phase: s.phase,
      emojis: p?.emojis ?? "",
      category: p?.category ?? "",
      hint: p?.hint ?? "",
      hintAt: s.startedAt + Math.min(HINT_AFTER, s.seconds * 500),
      deadline: s.deadline,
      revealUntil: s.revealUntil,
      correct: s.correct,
      tries: s.tries,
      scores: s.scores,
      answer: s.phase === "reveal" ? (p?.answer ?? null) : null,
    };
  },
  Screen,
  Controller,
};

export default emojiPicture;
