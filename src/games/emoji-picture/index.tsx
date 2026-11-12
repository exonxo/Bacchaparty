"use client";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { SuggestPaperButton } from "@/components/suggest/SuggestPaperButton";
import { requestSuggest } from "@/lib/suggest/client";
import { LevelPicker, NumberPicker } from "@/components/ui";
import { EMOJI_PUZZLES, type EmojiPuzzle } from "@/content/emoji-picture";
import { HOST_ID, type ControllerProps, type GameModule, type Level } from "@/lib/types";
import { answerMatches, shuffle } from "@/lib/util";
import { Phone } from "./PaperPhone";
import { TvScreen } from "./TvScreen";
import { POINTS, type Phase, type Pub } from "./shared";

interface Options {
  level: Level;
  count: number;
  seconds: number;
  extraPuzzles?: EmojiPuzzle[];
}

const HINT_AFTER = 20_000;
const REVEAL_FOR = 7_000;

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

function pickPuzzles(level: Level, count: number, extra?: EmojiPuzzle[]): EmojiPuzzle[] {
  if (extra && extra.length >= Math.min(3, count)) return extra.slice(0, count);
  const levels: Level[] = level === "kids" ? ["kids"] : level === "family" ? ["kids", "family"] : ["family", "adults"];
  return shuffle(EMOJI_PUZZLES.filter((p) => levels.includes(p.level))).slice(0, count);
}

function startQuestion(s: State, idx: number, now: number): State {
  if (idx >= s.puzzles.length) return { ...s, idx, phase: "over", revealUntil: null };
  return { ...s, idx, phase: "question", startedAt: now, deadline: now + s.seconds * 1000, revealUntil: null, correct: [], tries: {} };
}

const noop = () => {};

/** With a big screen, the phone is the same view without the host's controls. */
function Controller(props: ControllerProps<Pub, undefined>) {
  return <Phone {...props} isHost={false} hostAct={noop} together />;
}

function OptionsForm({ value, onChange }: { value: Options; onChange: (o: Options) => void }) {
  const params = useParams();
  const roomCode = typeof params?.code === "string" ? params.code : undefined;
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const newPuzzles = async () => {
    const snap = { level: valueRef.current.level, count: valueRef.current.count };
    setLoading(true);
    setHint(null);
    try {
      const { data, fallback } = await requestSuggest<EmojiPuzzle[]>(
        "emoji-puzzle",
        { level: snap.level, count: snap.count },
        roomCode,
      );
      const current = valueRef.current;
      if (current.level === snap.level && current.count === snap.count) {
        onChange({ ...current, extraPuzzles: data });
      }
      const label = fallback ? "built-in puzzles" : "puzzles";
      setHint(`${data.length} ${label} ready`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <SuggestPaperButton loading={loading} onClick={() => void newPuzzles()}>
          ✨ New puzzles
        </SuggestPaperButton>
      </div>
      {loading && !hint && <p className="text-p-note text-muted">Thinking…</p>}
      {hint && <p className="text-p-note text-muted">{hint}</p>}
      <LevelPicker value={value.level} onChange={(level) => onChange({ ...value, level, extraPuzzles: undefined })} />
      <NumberPicker label="Puzzles" value={value.count} onChange={(count) => onChange({ ...value, count, extraPuzzles: undefined })} options={[5, 10, 15]} />
      <NumberPicker label="Time per puzzle" value={value.seconds} onChange={(seconds) => onChange({ ...value, seconds })} options={[30, 45, 60, 90]} format={(n) => `${n}s`} />
    </div>
  );
}

const emojiPicture: GameModule<State, Pub, undefined, Options> = {
  id: "emoji-picture",
  paper: true,
  tvPaper: true,
  defaultOptions: { level: "family", count: 10, seconds: 45 },
  OptionsForm,
  init({ players, options, now }) {
    const base: State = {
      puzzles: pickPuzzles(options.level, options.count, options.extraPuzzles),
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
      seconds: s.seconds,
      deadline: s.deadline,
      revealUntil: s.revealUntil,
      correct: s.correct,
      tries: s.tries,
      scores: s.scores,
      answer: s.phase === "reveal" ? (p?.answer ?? null) : null,
    };
  },
  Screen: TvScreen,
  Controller,
  Phone,
};

export default emojiPicture;
