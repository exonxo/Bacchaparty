"use client";
import { Button, LevelPicker, Panel, PhoneMessage, PlayerChip, Scoreboard } from "@/components/ui";
import { KBC_QUESTIONS, type KbcQuestion } from "@/content/kbc";
import { HOST_ID, type GameModule, type Level, type Player } from "@/lib/types";
import { shuffle } from "@/lib/util";

const LADDER = 10;
const SAFE = 5;
const LETTERS = ["A", "B", "C", "D"];
const LEVEL_LABEL: Record<Level, string> = { kids: "Kids", family: "Family", adults: "Grown-ups" };

type Phase = "pick" | "level" | "question" | "locked" | "reveal" | "over";

interface Question {
  q: string;
  options: string[];
  answer: number;
}

interface State {
  phase: Phase;
  hotSeat: string | null;
  level: Level | null;
  rung: number; // index of the current question, 0..9
  question: Question | null;
  used: string[];
  removed: number[];
  lifelines: { fifty: boolean; family: boolean };
  familyShown: boolean;
  hotAnswer: number | null;
  audience: Record<string, number>;
  /** Best hot-seat level reached per player. */
  best: Record<string, number>;
  bonus: Record<string, number>;
  played: string[];
  result: { playerId: string; won: number; how: "wrong" | "quit" | "champion" } | null;
}

interface Pub {
  phase: Phase;
  hotSeat: string | null;
  level: Level | null;
  rung: number;
  question: { q: string; options: string[] } | null;
  removed: number[];
  lifelines: { fifty: boolean; family: boolean };
  family: number[] | null;
  audienceCount: number;
  hotAnswer: number | null;
  answer: number | null;
  /** Ids of audience players who have answered (not what they answered). */
  answered: string[];
  scores: Record<string, number>;
  played: string[];
  result: State["result"];
}

interface Priv {
  myAnswer: number | null;
}

function pickQuestion(level: Level, step: number, used: string[]): Question {
  const bank = KBC_QUESTIONS[level].filter((q) => !used.includes(q.q));
  const pool = bank.length ? bank : KBC_QUESTIONS[level];
  // Closest difficulty step available, random among ties.
  let bestDist = Infinity;
  let cands: KbcQuestion[] = [];
  for (const q of pool) {
    const d = Math.abs(q.step - step);
    if (d < bestDist) {
      bestDist = d;
      cands = [q];
    } else if (d === bestDist) cands.push(q);
  }
  const chosen = cands[Math.floor(Math.random() * cands.length)];
  const options = shuffle([chosen.a, ...chosen.w]);
  return { q: chosen.q, options, answer: options.indexOf(chosen.a) };
}

function newQuestion(s: State, rung: number): State {
  const question = pickQuestion(s.level!, rung + 1, s.used);
  return {
    ...s,
    phase: "question",
    rung,
    question,
    used: [...s.used, question.q],
    removed: [],
    familyShown: false,
    hotAnswer: null,
    audience: {},
  };
}

function finishRun(s: State, won: number, how: "wrong" | "quit" | "champion"): State {
  const id = s.hotSeat!;
  return {
    ...s,
    phase: how === "quit" ? "over" : s.phase,
    best: { ...s.best, [id]: Math.max(s.best[id] ?? 0, won) },
    played: s.played.includes(id) ? s.played : [...s.played, id],
    result: { playerId: id, won, how },
  };
}

function scoresOf(s: State): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of new Set([...Object.keys(s.best), ...Object.keys(s.bonus)])) out[id] = (s.best[id] ?? 0) + (s.bonus[id] ?? 0);
  return out;
}

function Ladder({ rung, phase }: { rung: number; phase: Phase }) {
  return (
    <Panel className="space-y-1">
      {Array.from({ length: LADDER }, (_, i) => LADDER - 1 - i).map((i) => {
        const done = i < rung || (i === rung && phase === "reveal");
        const current = i === rung && phase !== "pick" && phase !== "level";
        return (
          <div
            key={i}
            className={`flex items-center justify-between rounded-xl px-3 py-1.5 text-lg font-bold ${
              current ? "bg-saffron text-bg" : done ? "bg-green/25 text-green" : "text-muted"
            }`}
          >
            <span>Level {i + 1}</span>
            <span>{i + 1 === LADDER ? "🏆" : i + 1 === SAFE ? "🛡️ safe" : ""}</span>
          </div>
        );
      })}
    </Panel>
  );
}

function OptionGrid({
  options,
  removed,
  highlight,
  correct,
  onPick,
  big,
}: {
  options: string[];
  removed: number[];
  highlight: number | null;
  correct: number | null;
  onPick?: (i: number) => void;
  big?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((opt, i) => {
        const gone = removed.includes(i);
        const isCorrect = correct === i;
        const isWrongPick = correct !== null && highlight === i && !isCorrect;
        const cls = isCorrect
          ? "bg-green text-bg border-green"
          : isWrongPick
            ? "bg-red text-white border-red"
            : highlight === i
              ? "bg-saffron text-bg border-saffron"
              : "bg-white/5 border-white/15";
        return (
          <button
            key={i}
            disabled={!onPick || gone}
            onClick={() => onPick?.(i)}
            className={`flex items-center gap-3 rounded-2xl border-2 px-4 text-left font-bold transition ${cls} ${gone ? "opacity-20" : ""} ${
              big ? "py-5 text-2xl" : "py-4 text-lg"
            }`}
          >
            <span className="text-gold">{LETTERS[i]}.</span>
            <span>{gone ? "" : opt}</span>
          </button>
        );
      })}
    </div>
  );
}

function FamilyBars({ counts }: { counts: number[] }) {
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="grid grid-cols-4 gap-3">
      {counts.map((c, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className="flex h-28 w-full items-end overflow-hidden rounded-xl bg-white/5">
            <div className="w-full bg-teal transition-all" style={{ height: `${(c / total) * 100}%` }} />
          </div>
          <div className="font-bold">
            {LETTERS[i]} · {Math.round((c / total) * 100)}%
          </div>
        </div>
      ))}
    </div>
  );
}

function nameOf(players: Player[], id: string | null) {
  return players.find((p) => p.id === id)?.name ?? "Player";
}

function Screen({ view, players, act }: { view: Pub; players: Player[]; act: (t: string, p?: unknown) => void; now: number }) {
  const hot = players.find((p) => p.id === view.hotSeat);
  if (view.phase === "pick") {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Panel>
          <div className="text-3xl font-extrabold">Who’s in the hot seat? 🔥</div>
          <p className="mt-1 text-muted">Tap a player. Everyone else plays along on their phones for bonus points.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {players
              .filter((p) => p.connected)
              .map((p) => (
                <button key={p.id} onClick={() => act("hotseat", p.id)} className="rounded-2xl bg-white/10 px-5 py-3 text-xl font-bold hover:bg-saffron hover:text-bg">
                  {p.avatar} {p.name} {view.played.includes(p.id) && <span className="text-sm opacity-70">✓ played</span>}
                </button>
              ))}
          </div>
        </Panel>
        <Scoreboard players={players} scores={view.scores} />
      </div>
    );
  }
  if (view.phase === "level") {
    return (
      <Panel className="py-16 text-center">
        <div className="text-6xl">{hot?.avatar}</div>
        <div className="mt-3 text-4xl font-extrabold">{hot?.name} is in the hot seat!</div>
        <div className="mt-2 text-xl text-muted">Choose your level on your phone: Kids, Family or Grown-ups.</div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="text-muted">Wrong person?</span>
          {players
            .filter((p) => p.connected && p.id !== view.hotSeat)
            .map((p) => (
              <button key={p.id} onClick={() => act("hotseat", p.id)} className="rounded-full bg-white/10 px-3 py-1 font-semibold hover:bg-white/20">
                {p.avatar} {p.name}
              </button>
            ))}
        </div>
      </Panel>
    );
  }
  if (view.phase === "over" && view.result) {
    const r = view.result;
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Panel className="py-12 text-center">
          <div className="text-7xl">{r.how === "champion" ? "🏆" : r.how === "quit" ? "🙏" : "💫"}</div>
          <div className="mt-4 text-4xl font-extrabold">
            {r.how === "champion" ? `${nameOf(players, r.playerId)} is the Champion!` : `${nameOf(players, r.playerId)} finishes at Level ${r.won}`}
          </div>
          <div className="mt-2 text-xl text-muted">
            {r.how === "quit" ? "Walked away safely." : r.how === "wrong" ? (r.won ? "Saved by the safe level!" : "Better luck next time!") : "All 10 levels cleared!"}
          </div>
          <Button size="xl" className="mt-8" onClick={() => act("nextSeat")}>
            Next hot seat ▶
          </Button>
        </Panel>
        <Scoreboard players={players} scores={view.scores} />
      </div>
    );
  }
  const q = view.question!;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          {hot && <PlayerChip player={hot} highlight />}
          <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">{view.level && LEVEL_LABEL[view.level]} questions</span>
          <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">
            Audience answered: {view.answered.length}/{view.audienceCount}
          </span>
          <span className={`rounded-full px-3 py-1 font-semibold ${view.lifelines.fifty ? "bg-white/5 text-muted line-through" : "bg-teal/20 text-teal"}`}>50:50</span>
          <span className={`rounded-full px-3 py-1 font-semibold ${view.lifelines.family ? "bg-white/5 text-muted line-through" : "bg-teal/20 text-teal"}`}>
            Ask the Family
          </span>
        </div>
        <Panel className="py-8 text-center">
          <div className="text-sm font-bold uppercase tracking-widest text-gold">Level {view.rung + 1}</div>
          <div className="mt-2 text-4xl font-extrabold leading-tight">{q.q}</div>
        </Panel>
        <OptionGrid options={q.options} removed={view.removed} highlight={view.hotAnswer} correct={view.phase === "reveal" ? view.answer : null} big />
        {view.family && (
          <Panel>
            <div className="mb-2 font-bold text-teal">Ask the Family — how the audience voted</div>
            <FamilyBars counts={view.family} />
          </Panel>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {view.phase === "question" && <div className="text-xl text-muted">Waiting for {hot?.name} to lock an answer…</div>}
          {view.phase === "locked" && (
            <Button size="xl" onClick={() => act("reveal")}>
              Reveal answer 🥁
            </Button>
          )}
          {view.phase === "reveal" && view.hotAnswer === view.answer && view.rung < LADDER - 1 && (
            <>
              <div className="text-2xl font-extrabold text-green">Correct! 🎉</div>
              <Button size="xl" onClick={() => act("next")}>
                Next question ▶
              </Button>
            </>
          )}
          {view.phase === "reveal" && (view.hotAnswer !== view.answer || view.rung === LADDER - 1) && (
            <>
              <div className={`text-2xl font-extrabold ${view.hotAnswer === view.answer ? "text-gold" : "text-red"}`}>
                {view.hotAnswer === view.answer ? "Champion! 🏆" : "Oh no, wrong answer!"}
              </div>
              <Button size="xl" onClick={() => act("finish")}>
                See result ▶
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <Ladder rung={view.rung} phase={view.phase} />
      </div>
    </div>
  );
}

function Controller({ view, priv, me, players, send }: { view: Pub; priv: Priv | undefined; me: Player; players: Player[]; send: (t: string, p?: unknown) => void; now: number }) {
  const isHot = view.hotSeat === me.id;
  const hotName = nameOf(players, view.hotSeat);
  if (view.phase === "pick") return <PhoneMessage emoji="🔥" title="Who’s next in the hot seat?">The host is picking on the big screen.</PhoneMessage>;
  if (view.phase === "over") {
    return (
      <PhoneMessage emoji="🏆" title={`${hotName} reached Level ${view.result?.won ?? 0}`}>
        Your total: <b className="text-gold">{view.scores[me.id] ?? 0}</b>
      </PhoneMessage>
    );
  }
  if (view.phase === "level") {
    if (!isHot) return <PhoneMessage emoji="⏳" title={`${hotName} is choosing a level`} />;
    return (
      <div className="space-y-4">
        <div className="text-2xl font-extrabold">You’re in the hot seat! 🔥</div>
        <div className="text-muted">Pick your question level:</div>
        <LevelPicker value={"family"} onChange={(l) => send("level", l)} />
      </div>
    );
  }
  const q = view.question!;
  const reveal = view.phase === "reveal" ? view.answer : null;
  if (isHot) {
    const canAct = view.phase === "question";
    return (
      <div className="space-y-4">
        <div className="text-sm font-bold uppercase tracking-widest text-gold">Level {view.rung + 1} · You’re in the hot seat</div>
        <div className="text-xl font-bold">{q.q}</div>
        <OptionGrid options={q.options} removed={view.removed} highlight={view.hotAnswer} correct={reveal} onPick={canAct ? (i) => send("answer", i) : undefined} />
        {view.phase === "locked" && <div className="text-center text-lg text-muted">Locked! Look at the big screen…</div>}
        {canAct && (
          <div className="grid grid-cols-2 gap-2">
            <Button tone="teal" disabled={view.lifelines.fifty} onClick={() => send("fifty")}>
              50:50
            </Button>
            <Button tone="teal" disabled={view.lifelines.family} onClick={() => send("family")}>
              Ask the Family
            </Button>
            <Button tone="ghost" className="col-span-2" onClick={() => confirm(`Quit and keep Level ${view.rung}?`) && send("quit")}>
              🙏 Quit and keep Level {view.rung}
            </Button>
          </div>
        )}
        {view.family && <FamilyBars counts={view.family} />}
      </div>
    );
  }
  const mine = priv?.myAnswer ?? null;
  return (
    <div className="space-y-4">
      <div className="text-sm font-bold uppercase tracking-widest text-teal">Audience · play along for a bonus point</div>
      <div className="text-xl font-bold">{q.q}</div>
      <OptionGrid
        options={q.options}
        removed={view.removed}
        highlight={mine}
        correct={reveal}
        onPick={view.phase !== "reveal" && mine === null ? (i) => send("audience", i) : undefined}
      />
      <div className="text-center text-muted">
        {reveal !== null ? (mine === reveal ? "You got it! +1 🎉" : "Not this time.") : mine === null ? "Pick your answer — you only get one try." : "Locked in!"}
      </div>
    </div>
  );
}

const game: GameModule<State, Pub, Priv, Record<string, never>> = {
  id: "kaun-banega-champion",
  defaultOptions: {},
  init({ players }) {
    return {
      phase: "pick",
      hotSeat: null,
      level: null,
      rung: 0,
      question: null,
      used: [],
      removed: [],
      lifelines: { fifty: false, family: false },
      familyShown: false,
      hotAnswer: null,
      audience: {},
      best: Object.fromEntries(players.map((p) => [p.id, 0])),
      bonus: {},
      played: [],
      result: null,
    };
  },
  reduce(s, a, { players }) {
    if (a.playerId === HOST_ID) {
      if (a.type === "hotseat" && (s.phase === "pick" || s.phase === "level")) {
        const id = String(a.payload);
        if (!players.some((p) => p.id === id)) return s;
        return { ...s, phase: "level", hotSeat: id, level: null, rung: 0, question: null, lifelines: { fifty: false, family: false }, result: null };
      }
      if (a.type === "reveal" && s.phase === "locked" && s.question) {
        const bonus = { ...s.bonus };
        for (const [pid, ans] of Object.entries(s.audience)) if (ans === s.question.answer) bonus[pid] = (bonus[pid] ?? 0) + 1;
        return { ...s, phase: "reveal", bonus };
      }
      if (a.type === "next" && s.phase === "reveal" && s.question && s.hotAnswer === s.question.answer && s.rung < LADDER - 1) {
        return newQuestion(s, s.rung + 1);
      }
      if (a.type === "finish" && s.phase === "reveal" && s.question) {
        const right = s.hotAnswer === s.question.answer;
        if (right && s.rung === LADDER - 1) return { ...finishRun(s, LADDER, "champion"), phase: "over" };
        if (!right) return { ...finishRun(s, s.rung >= SAFE ? SAFE : 0, "wrong"), phase: "over" };
        return s;
      }
      if (a.type === "nextSeat" && s.phase === "over") return { ...s, phase: "pick", hotSeat: null, question: null, result: null };
      return s;
    }
    const isHot = a.playerId === s.hotSeat;
    if (isHot) {
      if (a.type === "level" && s.phase === "level") {
        const level = a.payload as Level;
        if (!(level in KBC_QUESTIONS)) return s;
        return newQuestion({ ...s, level }, 0);
      }
      if (s.phase !== "question" || !s.question) return s;
      if (a.type === "answer") {
        const i = Number(a.payload);
        if (!(i >= 0 && i < 4) || s.removed.includes(i)) return s;
        return { ...s, hotAnswer: i, phase: "locked" };
      }
      if (a.type === "fifty" && !s.lifelines.fifty) {
        const wrong = shuffle([0, 1, 2, 3].filter((i) => i !== s.question!.answer)).slice(0, 2);
        return { ...s, removed: wrong, lifelines: { ...s.lifelines, fifty: true } };
      }
      if (a.type === "family" && !s.lifelines.family) return { ...s, familyShown: true, lifelines: { ...s.lifelines, family: true } };
      if (a.type === "quit") return finishRun(s, s.rung, "quit");
      return s;
    }
    if (a.type === "audience" && (s.phase === "question" || s.phase === "locked") && s.audience[a.playerId] === undefined) {
      const i = Number(a.payload);
      if (!(i >= 0 && i < 4)) return s;
      return { ...s, audience: { ...s.audience, [a.playerId]: i } };
    }
    return s;
  },
  tick(s, { players }) {
    // Hot-seat player left during the level choice: go back to picking.
    if ((s.phase === "level" || s.phase === "question") && s.hotSeat && !players.some((p) => p.id === s.hotSeat)) {
      return { ...s, phase: "pick", hotSeat: null, question: null };
    }
    return s;
  },
  publicView(s) {
    const counts = [0, 0, 0, 0];
    Object.values(s.audience).forEach((i) => counts[i]++);
    return {
      phase: s.phase,
      hotSeat: s.hotSeat,
      level: s.level,
      rung: s.rung,
      question: s.question ? { q: s.question.q, options: s.question.options } : null,
      removed: s.removed,
      lifelines: s.lifelines,
      family: s.familyShown ? counts : null,
      audienceCount: 0,
      hotAnswer: s.hotAnswer,
      answer: s.phase === "reveal" && s.question ? s.question.answer : null,
      answered: Object.keys(s.audience),
      scores: scoresOf(s),
      played: s.played,
      result: s.result,
    };
  },
  privateView(s, id) {
    return { myAnswer: s.audience[id] ?? null };
  },
  Screen: (props) => <Screen {...props} view={{ ...props.view, audienceCount: props.players.filter((p) => p.connected && p.id !== props.view.hotSeat).length }} />,
  Controller,
};

export default game;
