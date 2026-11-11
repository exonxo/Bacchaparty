"use client";
import {
  CircleCheck, Crown, Eye, Film, Lightbulb, ListOrdered, MapPin, Music, Quote, Send, SkipForward, Sparkles, Timer, Trophy, Tv, UtensilsCrossed, X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Button, Countdown, LevelPicker, NumberPicker, Panel, PhoneMessage, Scoreboard, Sheet, TextAnswer } from "@/components/ui";
import { EMOJI_PUZZLES, type EmojiPuzzle } from "@/content/emoji-picture";
import { celebrate } from "@/lib/celebrate";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import { HOST_ID, type ControllerProps, type GameModule, type Level, type Player, type PhoneProps, type ScreenProps } from "@/lib/types";
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
  seconds: number;
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

const CATEGORY_ICON: Record<string, LucideIcon> = {
  Movie: Film,
  Food: UtensilsCrossed,
  Place: MapPin,
  Festival: Sparkles,
  Phrase: Quote,
  Cartoon: Tv,
  Sport: Trophy,
  Song: Music,
};

function CategoryChip({ category }: { category: string }) {
  const Icon = CATEGORY_ICON[category] ?? Sparkles;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-saffron">
      <Icon className="h-3.5 w-3.5" /> {category}
    </span>
  );
}

function ranked(players: Player[], scores: Record<string, number>) {
  return players
    .filter((p) => p.id in scores)
    .map((p) => ({ p, s: scores[p.id] ?? 0 }))
    .sort((a, b) => b.s - a.s);
}

function Podium({ players, scores, meId }: { players: Player[]; scores: Record<string, number>; meId?: string }) {
  const rows = ranked(players, scores);
  const top = rows.slice(0, 3);
  const order = [top[1], top[0], top[2]];
  const heights = ["h-20", "h-28", "h-14"];
  return (
    <div>
      <div className="flex items-end justify-center gap-3">
        {order.map((r, i) =>
          r ? (
            <div key={r.p.id} className="rise-in flex w-24 flex-col items-center" style={{ animationDelay: `${i * 120}ms` }}>
              {i === 1 && <Crown className="mb-1 h-6 w-6 text-gold" />}
              <Avatar id={r.p.avatar} className="text-3xl" />
              <div className={`mt-1 max-w-full truncate text-sm font-bold ${r.p.id === meId ? "text-me" : ""}`}>{r.p.name}</div>
              <div
                className={`mt-2 flex w-full items-start justify-center rounded-t-xl pt-2 font-display text-xl font-black ${heights[i]} ${
                  i === 1 ? "bg-saffron text-black" : "bg-white/[0.08]"
                }`}
              >
                {r.s}
              </div>
            </div>
          ) : (
            <div key={i} className="w-24" />
          ),
        )}
      </div>
      {rows.length > 3 && (
        <ol className="mt-4 space-y-1.5">
          {rows.slice(3).map((r, i) => (
            <li key={r.p.id} className={`flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 ${r.p.id === meId ? "ring-1 ring-me" : ""}`}>
              <span className="flex items-center gap-2">
                <span className="w-5 text-sm text-muted">{i + 4}</span>
                <Avatar id={r.p.avatar} /> <span className="font-semibold">{r.p.name}</span>
              </span>
              <span className="font-display font-black text-saffron">{r.s}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function TimeBar({ deadline, seconds, now }: { deadline: number; seconds: number; now: number }) {
  const left = Math.max(0, deadline - now);
  const pct = Math.max(0, Math.min(100, (left / (seconds * 1000)) * 100));
  const secs = Math.ceil(left / 1000);
  const low = secs <= 5;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full transition-[width] duration-300 ease-linear ${low ? "bg-red" : "bg-saffron"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`flex w-12 items-center justify-end gap-1 font-display text-lg font-black tabular-nums ${low ? "text-red" : "text-ink"}`}>
        <Timer className="h-4 w-4" />
        {secs}
      </span>
    </div>
  );
}

function Screen({ view, players, act, now, spectator }: ScreenProps<Pub>) {
  if (view.phase === "over") {
    return (
      <div className="mx-auto max-w-2xl space-y-6 text-center">
        <div className="flex items-center justify-center gap-3 font-display text-5xl font-black">
          <Trophy className="h-12 w-12 text-gold" /> Final results
        </div>
        <Panel>
          <Podium players={players} scores={view.scores} />
        </Panel>
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
          <CategoryChip category={view.category} />
          {view.phase === "question" ? <Countdown deadline={view.deadline} now={now} /> : <span className="w-12" />}
        </div>
        <div key={view.idx} className="pop-in text-[7rem] leading-none tracking-widest">
          {view.emojis}
        </div>
        {view.phase === "question" && (
          <>
            {showHint ? (
              <div className="pop-in flex items-center gap-2 text-2xl text-teal">
                <Lightbulb className="h-6 w-6" /> {view.hint}
              </div>
            ) : (
              <div className="text-xl text-muted">Type your answer on your phone!</div>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              {view.correct.map((id, i) => {
                const p = players.find((x) => x.id === id);
                return p ? (
                  <span key={id} className="pop-in flex items-center gap-2 rounded-full bg-green/15 py-1 pl-1 pr-3 font-bold text-green">
                    <Avatar id={p.avatar} /> {p.name} <span className="text-sm opacity-80">+{POINTS[i] ?? 1}</span>
                  </span>
                ) : null;
              })}
            </div>
            {!spectator && (
              <Button tone="ghost" onClick={() => act("reveal")} className="flex items-center gap-2">
                <Eye className="h-4 w-4" /> Reveal answer
              </Button>
            )}
          </>
        )}
        {view.phase === "reveal" && (
          <>
            <div className="pop-in font-display text-5xl font-black text-saffron">{view.answer}</div>
            <div className="text-lg text-muted">{view.correct.length ? `${view.correct.length} got it!` : "Nobody got this one"}</div>
            {!spectator && (
              <Button onClick={() => act("next")} className="flex items-center gap-2">
                Next <SkipForward className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </Panel>
      <Scoreboard players={players} scores={view.scores} />
    </div>
  );
}

function AnswerBox({ onSubmit, placeholder, shakeKey }: { onSubmit: (t: string) => void; placeholder: string; shakeKey: number }) {
  const [value, setValue] = useState("");
  return (
    <form
      key={shakeKey}
      className={`flex gap-2 ${shakeKey > 0 ? "shake" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (!v) return;
        onSubmit(v);
        setValue("");
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        enterKeyHint="send"
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-4 text-lg outline-none placeholder:text-muted/70 focus:border-me"
      />
      <Button type="submit" tone="me" aria-label="Send answer" className="px-5">
        <Send className="h-5 w-5" />
      </Button>
    </form>
  );
}

function Phone({ view, me, players, send, now, isHost, hostAct }: PhoneProps<Pub, undefined>) {
  const { shared, mine } = useSfx();
  const [showScores, setShowScores] = useState(false);
  const score = view.scores[me.id] ?? 0;
  const myRank = view.correct.indexOf(me.id);
  const got = myRank >= 0;
  const tries = view.tries[me.id] ?? 0;
  const secsLeft = view.phase === "question" ? Math.ceil(Math.max(0, view.deadline - now) / 1000) : -1;

  useOnChange(view.idx, () => {
    if (view.phase === "question") shared("whoosh");
  });
  useOnChange(secsLeft, (n) => {
    if (n > 0 && n <= 5) shared("tick");
  });
  useOnChange(got, (n) => {
    if (n) {
      mine("ding", [40]);
      celebrate();
    }
  });
  useOnChange(tries, (n, p) => {
    if (n > p && !got) mine("buzz", [120]);
  });
  useOnChange(view.phase, (n) => {
    if (n === "reveal") shared("reveal");
    if (n === "over") {
      const top = ranked(players, view.scores)[0];
      if (top?.p.id === me.id) {
        mine("fanfare", [60, 40, 120]);
        celebrate();
      } else shared("fanfare");
    }
  });

  const scoresButton = (
    <button onClick={() => setShowScores(true)} className="flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-sm font-bold">
      <ListOrdered className="h-4 w-4 text-muted" /> <span className="tabular-nums text-saffron">{score}</span>
    </button>
  );

  if (view.phase === "over") {
    const rows = ranked(players, view.scores);
    const myPlace = rows.findIndex((r) => r.p.id === me.id) + 1;
    return (
      <div className="rise-in space-y-6 pt-4 text-center">
        <Trophy className="mx-auto h-12 w-12 text-gold" />
        <div>
          <div className="font-display text-3xl font-black">That’s a wrap!</div>
          <div className="mt-1 text-muted">
            {myPlace === 1 ? "You won Emoji Picture!" : myPlace > 0 ? `You came #${myPlace} with ${score} points` : "Thanks for watching"}
          </div>
        </div>
        <Podium players={players} scores={view.scores} meId={me.id} />
        {isHost && <div className="text-sm text-muted">Tap “Lobby” at the top to pick the next game.</div>}
      </div>
    );
  }

  const showHint = view.phase === "question" && now >= view.hintAt;
  const solvers = view.correct.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => !!p);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CategoryChip category={view.category} />
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            {view.idx + 1} / {view.total}
          </span>
        </div>
        {scoresButton}
      </div>

      {view.phase === "question" && <TimeBar deadline={view.deadline} seconds={view.seconds} now={now} />}

      <div
        key={view.idx}
        className={`pop-in flex min-h-44 items-center justify-center rounded-3xl border bg-card px-4 py-8 text-center text-7xl leading-tight tracking-widest ${
          got ? "glow-me border-me/40" : "border-white/[0.08]"
        }`}
      >
        {view.emojis}
      </div>

      {view.phase === "question" && (
        <>
          {showHint && (
            <div className="rise-in flex items-center gap-2 rounded-xl bg-teal/10 px-4 py-3 text-teal">
              <Lightbulb className="h-5 w-5 shrink-0" />
              <span className="font-semibold">{view.hint}</span>
            </div>
          )}
          {got ? (
            <div className="pop-in flex items-center gap-3 rounded-2xl bg-me px-4 py-4 text-black">
              <CircleCheck className="h-7 w-7 shrink-0" />
              <div>
                <div className="font-display text-xl font-black">You got it · +{POINTS[myRank] ?? 1}</div>
                <div className="text-sm font-semibold opacity-80">Shh — waiting for the others…</div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <AnswerBox onSubmit={(t) => send("answer", t)} placeholder={`Which ${view.category.toLowerCase()}?`} shakeKey={tries} />
              {tries > 0 && (
                <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-red">
                  <X className="h-4 w-4" /> Not quite — try again
                </div>
              )}
            </div>
          )}
        </>
      )}

      {view.phase === "reveal" && (
        <div className="rise-in rounded-2xl border border-white/[0.08] bg-card p-5 text-center">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">The answer</div>
          <div className="mt-1 font-display text-3xl font-black text-saffron">{view.answer}</div>
          <div className="mt-2 text-sm text-muted">
            {got ? `You got it · +${POINTS[myRank] ?? 1}` : view.correct.length ? `${view.correct.length} got it` : "Nobody got this one"}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Solved · {solvers.length}</div>
        <div className="flex min-h-9 flex-wrap gap-2">
          {solvers.length === 0 && <span className="text-sm text-muted">Nobody yet — be first for 3 points.</span>}
          {solvers.map((p, i) => (
            <span
              key={p.id}
              className={`pop-in flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm font-semibold ${p.id === me.id ? "bg-me text-black" : "bg-white/[0.07]"}`}
            >
              <span className={p.id === me.id ? "rounded-full bg-black/80" : ""}>
                <Avatar id={p.avatar} />
              </span>{" "}
              {p.name}
              <span className="opacity-70">+{POINTS[i] ?? 1}</span>
            </span>
          ))}
        </div>
      </div>

      {isHost && (
        <div className="grid gap-2 border-t border-white/[0.06] pt-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Host controls</div>
          {view.phase === "question" ? (
            <Button tone="ghost" onClick={() => hostAct("reveal")} className="flex items-center justify-center gap-2">
              <Eye className="h-4 w-4" /> Reveal answer
            </Button>
          ) : (
            <Button onClick={() => hostAct("next")} className="flex items-center justify-center gap-2">
              Next puzzle <SkipForward className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      <Sheet open={showScores} onClose={() => setShowScores(false)} title="Scores">
        <Podium players={players} scores={view.scores} meId={me.id} />
      </Sheet>
    </div>
  );
}

function Controller({ view, me, send, now }: ControllerProps<Pub, undefined>) {
  const score = view.scores[me.id] ?? 0;
  if (view.phase === "over") return <PhoneMessage title="That's all!">You scored {score} points.</PhoneMessage>;
  const got = view.correct.includes(me.id);
  if (view.phase === "reveal") {
    return (
      <PhoneMessage title={view.answer ?? ""}>
        {got ? "You got it!" : "Next one's yours!"} · Score: {score}
      </PhoneMessage>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <CategoryChip category={view.category} />
        <Countdown deadline={view.deadline} now={now} />
      </div>
      <div className="text-center text-7xl leading-tight">{view.emojis}</div>
      {now >= view.hintAt && <div className="text-center text-lg text-teal">{view.hint}</div>}
      {got ? (
        <PhoneMessage title="Correct!">Waiting for the others… Score: {score}</PhoneMessage>
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
      seconds: s.seconds,
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
  Phone,
};

export default emojiPicture;
