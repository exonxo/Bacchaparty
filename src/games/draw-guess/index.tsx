"use client";
import { Avatar } from "@/components/Avatar";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button, Countdown, LevelPicker, NumberPicker, Panel, PhoneMessage, Scoreboard, TextAnswer } from "@/components/ui";
import { DRAW_WORDS } from "@/content/draw-guess";
import { HOST_ID, type ControllerProps, type GameModule, type Level, type Player, type ScreenProps } from "@/lib/types";
import { answerMatches, shuffle } from "@/lib/util";

interface Options {
  level: Level;
  roundsPerPlayer: number;
  seconds: number;
}

type Phase = "choosing" | "drawing" | "reveal" | "over";

/** A stroke: colour, width and flat [x0,y0,x1,y1,…] in 0–1000 units. */
interface Stroke {
  c: string;
  w: number;
  p: number[];
}

interface State {
  level: Level;
  seconds: number;
  deck: string[];
  drawers: string[];
  turn: number;
  totalTurns: number;
  phase: Phase;
  choices: string[];
  word: string | null;
  startedAt: number;
  deadline: number;
  revealUntil: number | null;
  strokes: Stroke[];
  correct: string[];
  feed: { playerId: string; text: string | null }[];
  scores: Record<string, number>;
}

interface Pub {
  drawerId: string | null;
  turn: number;
  totalTurns: number;
  phase: Phase;
  deadline: number;
  hintAt: number;
  mask: string;
  firstLetter: string;
  strokes: Stroke[];
  correct: string[];
  feed: State["feed"];
  scores: Record<string, number>;
  answer: string | null;
}

interface Priv {
  choices?: string[];
  word?: string;
}

const CHOOSE_FOR = 20_000;
const REVEAL_FOR = 6_000;
const MAX_POINTS = 30_000; // total coordinates kept per drawing
const COLORS = ["#1a0b2e", "#ff5a5f", "#4f9dff", "#36c96a", "#ff9933", "#8b5a2b", "#ff4fa3", "#ffd23f"];
const WIDTHS = [6, 14, 28];

const display = (entry: string) => entry.split("|")[0];
const accepted = (entry: string) => entry.split("|");
const maskOf = (word: string) => word.replace(/[A-Za-z0-9]/g, "_");

function deckFor(level: Level): string[] {
  const lists = level === "kids" ? [DRAW_WORDS.kids] : level === "family" ? [DRAW_WORDS.kids, DRAW_WORDS.family] : [DRAW_WORDS.family, DRAW_WORDS.adults];
  return shuffle(lists.flat());
}

function drawerOf(s: State): string | null {
  return s.drawers.length ? s.drawers[s.turn % s.drawers.length] : null;
}

function startTurn(s: State, turn: number, now: number): State {
  if (turn >= s.totalTurns) return { ...s, turn, phase: "over", revealUntil: null };
  let deck = s.deck;
  if (deck.length < 3) deck = deckFor(s.level);
  return {
    ...s,
    turn,
    deck: deck.slice(3),
    choices: deck.slice(0, 3),
    word: null,
    phase: "choosing",
    startedAt: now,
    deadline: now + CHOOSE_FOR,
    revealUntil: null,
    strokes: [],
    correct: [],
    feed: [],
  };
}

function choose(s: State, i: number, now: number): State {
  const word = s.choices[i] ?? s.choices[0];
  return { ...s, word, phase: "drawing", startedAt: now, deadline: now + s.seconds * 1000 };
}

function reveal(s: State, now: number): State {
  return { ...s, phase: "reveal", revealUntil: now + REVEAL_FOR };
}

function isPointList(v: unknown): v is number[] {
  return Array.isArray(v) && v.length % 2 === 0 && v.length <= 400 && v.every((n) => Number.isInteger(n) && n >= 0 && n <= 1000);
}

function Drawing({ strokes, className = "" }: { strokes: Stroke[]; className?: string }) {
  return (
    <svg viewBox="0 0 1000 1000" className={`aspect-square w-full rounded-3xl bg-white ${className}`}>
      {strokes.map((s, i) =>
        s.p.length === 2 ? (
          <circle key={i} cx={s.p[0]} cy={s.p[1]} r={s.w / 2} fill={s.c} />
        ) : (
          <polyline key={i} points={s.p.join(" ")} fill="none" stroke={s.c} strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" />
        ),
      )}
    </svg>
  );
}

function WordHint({ view, now }: { view: Pub; now: number }) {
  if (view.phase !== "drawing") return null;
  const mask = now >= view.hintAt && view.firstLetter ? view.firstLetter + view.mask.slice(1) : view.mask;
  return <div className="font-mono text-3xl font-bold tracking-[0.3em] whitespace-pre">{mask}</div>;
}

function Feed({ view, players }: { view: Pub; players: Player[] }) {
  return (
    <div className="flex max-h-64 flex-col-reverse gap-1 overflow-hidden">
      {[...view.feed].reverse().slice(0, 10).map((f, i) => {
        const p = players.find((x) => x.id === f.playerId);
        return (
          <div key={view.feed.length - i} className={`rounded-xl px-3 py-1 ${f.text === null ? "bg-green font-bold text-bg" : "bg-white/5"}`}>
            <Avatar id={p?.avatar} /> {p?.name ?? "?"}: {f.text === null ? "guessed it! ✅" : f.text}
          </div>
        );
      })}
    </div>
  );
}

function Screen({ view, players, act, now }: ScreenProps<Pub>) {
  const drawer = players.find((p) => p.id === view.drawerId);
  if (view.phase === "over") {
    return (
      <div className="mx-auto max-w-xl space-y-6 text-center">
        <div className="text-5xl font-extrabold">🏆 Draw & Guess results</div>
        <Scoreboard players={players} scores={view.scores} big title="Final scores" />
      </div>
    );
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-2xl font-bold">
            <Avatar id={drawer?.avatar} /> {drawer?.name ?? "…"} {view.phase === "choosing" ? "is choosing a word…" : view.phase === "drawing" ? "is drawing" : ""}
          </div>
          <WordHint view={view} now={now} />
          {view.phase !== "reveal" && <Countdown deadline={view.deadline} now={now} big />}
        </div>
        <div className="mx-auto max-w-[min(100%,56vh)]">
          <Drawing strokes={view.strokes} />
        </div>
        {view.phase === "reveal" && (
          <div className="pop-in text-center text-4xl font-extrabold">
            It was <span className="text-gold">{view.answer}</span>!
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          {view.phase === "drawing" && (
            <Button tone="ghost" onClick={() => act("reveal")}>
              👀 Reveal word
            </Button>
          )}
          {view.phase === "reveal" ? (
            <Button onClick={() => act("next")}>Next turn ▶</Button>
          ) : (
            <Button tone="ghost" onClick={() => act("skip")}>
              ⏭ Skip this drawer
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <Panel>
          <div className="mb-2 text-sm font-bold uppercase tracking-widest text-muted">
            Turn {view.turn + 1} of {view.totalTurns} · Guesses
          </div>
          <Feed view={view} players={players} />
        </Panel>
        <Scoreboard players={players} scores={view.scores} />
      </div>
    </div>
  );
}

function DrawPad({ turn, send }: { turn: number; send: (t: string, p?: unknown) => void }) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const svgRef = useRef<SVGSVGElement>(null);
  const drawing = useRef(false);
  const buffer = useRef<number[]>([]);
  const current = useRef<{ index: number; c: string; w: number } | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const update = (next: Stroke[]) => {
    strokesRef.current = next;
    setStrokes(next);
  };

  useEffect(() => {
    strokesRef.current = [];
    setStrokes([]);
    buffer.current = [];
    current.current = null;
  }, [turn]);

  useEffect(() => {
    const flush = () => {
      const cur = current.current;
      if (!cur || buffer.current.length === 0) return;
      const pts = buffer.current.splice(0, 400);
      send("stroke", { s: cur.index, c: cur.c, w: cur.w, p: pts });
    };
    const t = setInterval(flush, 120);
    return () => clearInterval(t);
  }, [send]);

  const point = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = svgRef.current!.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000);
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000);
    return [Math.min(1000, Math.max(0, x)), Math.min(1000, Math.max(0, y))];
  };

  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    svgRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    // Finish sending the previous stroke before starting a new one.
    if (current.current && buffer.current.length) {
      send("stroke", { s: current.current.index, c: current.current.c, w: current.current.w, p: buffer.current.splice(0) });
    }
    const [x, y] = point(e);
    const prev = strokesRef.current;
    current.current = { index: prev.length, c: color, w: width };
    update([...prev, { c: color, w: width, p: [x, y] }]);
    buffer.current = [x, y];
  };
  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return;
    const [x, y] = point(e);
    const prev = strokesRef.current;
    if (!prev.length) return;
    const last = prev[prev.length - 1];
    const lx = last.p[last.p.length - 2];
    const ly = last.p[last.p.length - 1];
    if (Math.abs(lx - x) + Math.abs(ly - y) < 6) return;
    buffer.current.push(x, y);
    update([...prev.slice(0, -1), { ...last, p: [...last.p, x, y] }]);
  };
  const up = () => {
    drawing.current = false;
  };

  return (
    <div className="space-y-3">
      <svg
        ref={svgRef}
        viewBox="0 0 1000 1000"
        className="aspect-square w-full touch-none rounded-3xl bg-white select-none"
        style={{ touchAction: "none" }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
      >
        {strokes.map((s, i) =>
          s.p.length === 2 ? (
            <circle key={i} cx={s.p[0]} cy={s.p[1]} r={s.w / 2} fill={s.c} />
          ) : (
            <polyline key={i} points={s.p.join(" ")} fill="none" stroke={s.c} strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" />
          ),
        )}
      </svg>
      <div className="flex flex-wrap items-center gap-2">
        {COLORS.map((c) => (
          <button
            key={c}
            aria-label={`Colour ${c}`}
            onClick={() => setColor(c)}
            className={`h-9 w-9 rounded-full border-2 ${color === c ? "border-gold ring-2 ring-gold" : "border-white/30"}`}
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        {WIDTHS.map((w) => (
          <button key={w} onClick={() => setWidth(w)} className={`flex h-10 w-10 items-center justify-center rounded-xl ${width === w ? "bg-gold" : "bg-white/10"}`}>
            <span className="rounded-full bg-ink" style={{ width: w / 2 + 2, height: w / 2 + 2, background: width === w ? "#1a0b2e" : undefined }} />
          </button>
        ))}
        <div className="flex-1" />
        <Button
          tone="ghost"
          size="sm"
          onClick={() => {
            buffer.current = [];
            current.current = null;
            update(strokesRef.current.slice(0, -1));
            send("undo");
          }}
        >
          ↩ Undo
        </Button>
        <Button
          tone="red"
          size="sm"
          onClick={() => {
            buffer.current = [];
            current.current = null;
            update([]);
            send("clear");
          }}
        >
          🗑 Clear
        </Button>
      </div>
    </div>
  );
}

function Controller({ view, priv, me, players, send, now }: ControllerProps<Pub, Priv>) {
  const isDrawer = view.drawerId === me.id;
  const drawerName = players.find((p) => p.id === view.drawerId)?.name ?? "The drawer";
  const score = view.scores[me.id] ?? 0;
  if (view.phase === "over") return <PhoneMessage emoji="🏆" title="Game over!">You scored {score} points.</PhoneMessage>;
  if (view.phase === "reveal") {
    return (
      <PhoneMessage emoji={view.correct.includes(me.id) || isDrawer ? "🎉" : "🙈"} title={`It was: ${view.answer}`}>
        Score: {score}
      </PhoneMessage>
    );
  }
  if (isDrawer) {
    if (view.phase === "choosing") {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-extrabold">Pick a word to draw</div>
            <Countdown deadline={view.deadline} now={now} />
          </div>
          {(priv?.choices ?? []).map((c, i) => (
            <Button key={i} size="lg" tone="teal" className="w-full" onClick={() => send("choose", i)}>
              {c}
            </Button>
          ))}
          <p className="text-center text-muted">No letters or numbers in your drawing!</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted">Draw</div>
            <div className="text-2xl font-extrabold text-gold">{priv?.word ?? "…"}</div>
          </div>
          <div className="text-right text-sm text-muted">{view.correct.length} guessed</div>
          <Countdown deadline={view.deadline} now={now} />
        </div>
        <DrawPad turn={view.turn} send={send} />
      </div>
    );
  }
  if (view.phase === "choosing") return <PhoneMessage emoji="✏️" title={`${drawerName} is choosing a word…`} />;
  const got = view.correct.includes(me.id);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <WordHint view={view} now={now} />
        <Countdown deadline={view.deadline} now={now} />
      </div>
      <Drawing strokes={view.strokes} />
      {got ? (
        <div className="rounded-2xl bg-green px-4 py-3 text-center text-xl font-bold text-bg">✅ You got it! Score: {score}</div>
      ) : (
        <TextAnswer onSubmit={(t) => send("guess", t)} placeholder="What is it?" buttonLabel="Guess" />
      )}
    </div>
  );
}

function OptionsForm({ value, onChange }: { value: Options; onChange: (o: Options) => void }) {
  return (
    <div className="space-y-4">
      <LevelPicker value={value.level} onChange={(level) => onChange({ ...value, level })} />
      <NumberPicker label="Turns to draw" value={value.roundsPerPlayer} onChange={(roundsPerPlayer) => onChange({ ...value, roundsPerPlayer })} options={[1, 2, 3]} format={(n) => `${n} each`} />
      <NumberPicker label="Time per drawing" value={value.seconds} onChange={(seconds) => onChange({ ...value, seconds })} options={[60, 80, 100, 120]} format={(n) => `${n}s`} />
    </div>
  );
}

const drawGuess: GameModule<State, Pub, Priv, Options> = {
  id: "draw-guess",
  defaultOptions: { level: "family", roundsPerPlayer: 1, seconds: 80 },
  OptionsForm,
  init({ players, options, now }) {
    const drawers = shuffle(players.map((p) => p.id));
    const base: State = {
      level: options.level,
      seconds: options.seconds,
      deck: deckFor(options.level),
      drawers,
      turn: 0,
      totalTurns: Math.max(1, drawers.length * options.roundsPerPlayer),
      phase: "choosing",
      choices: [],
      word: null,
      startedAt: now,
      deadline: now,
      revealUntil: null,
      strokes: [],
      correct: [],
      feed: [],
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    };
    return startTurn(base, 0, now);
  },
  onPlayerJoin(s, p) {
    if (p.id in s.scores) return s;
    return { ...s, scores: { ...s.scores, [p.id]: 0 } };
  },
  reduce(s, a, { now, players }) {
    const drawer = drawerOf(s);
    const isHost = a.playerId === HOST_ID;
    const isDrawer = a.playerId === drawer;
    switch (a.type) {
      case "choose":
        if (!isDrawer || s.phase !== "choosing") return s;
        return choose(s, Number(a.payload) || 0, now);
      case "stroke": {
        if (!isDrawer || s.phase !== "drawing") return s;
        const m = a.payload as { s?: unknown; c?: unknown; w?: unknown; p?: unknown };
        if (!m || typeof m.s !== "number" || !isPointList(m.p) || m.p.length === 0) return s;
        const total = s.strokes.reduce((n, st) => n + st.p.length, 0);
        if (total + m.p.length > MAX_POINTS) return s;
        const c = typeof m.c === "string" && COLORS.includes(m.c) ? m.c : COLORS[0];
        const w = typeof m.w === "number" && WIDTHS.includes(m.w) ? m.w : WIDTHS[1];
        if (m.s === s.strokes.length) return { ...s, strokes: [...s.strokes, { c, w, p: m.p }] };
        if (m.s === s.strokes.length - 1) {
          const last = s.strokes[s.strokes.length - 1];
          return { ...s, strokes: [...s.strokes.slice(0, -1), { ...last, p: [...last.p, ...m.p] }] };
        }
        return s;
      }
      case "undo":
        if (!isDrawer || !s.strokes.length) return s;
        return { ...s, strokes: s.strokes.slice(0, -1) };
      case "clear":
        if (!isDrawer || !s.strokes.length) return s;
        return { ...s, strokes: [] };
      case "reveal":
        if (!isHost || s.phase !== "drawing") return s;
        return reveal(s, now);
      case "next":
        if (!isHost || s.phase !== "reveal") return s;
        return startTurn(s, s.turn + 1, now);
      case "skip":
        if (!isHost || s.phase === "over") return s;
        return startTurn(s, s.turn + 1, now);
      case "guess": {
        if (s.phase !== "drawing" || isHost || isDrawer || !s.word || s.correct.includes(a.playerId)) return s;
        const text = String(a.payload ?? "").slice(0, 40).trim();
        if (!text) return s;
        if (answerMatches(text, accepted(s.word))) {
          const total = s.seconds * 1000;
          const left = Math.max(0, s.deadline - now);
          const pts = Math.max(2, Math.round((10 * left) / total));
          const scores = { ...s.scores, [a.playerId]: (s.scores[a.playerId] ?? 0) + pts };
          if (drawer) scores[drawer] = (scores[drawer] ?? 0) + 2;
          const next: State = { ...s, scores, correct: [...s.correct, a.playerId], feed: [...s.feed, { playerId: a.playerId, text: null }].slice(-30) };
          const left2 = players.filter((p) => p.connected && p.id !== drawer && !next.correct.includes(p.id)).length;
          return left2 === 0 ? reveal(next, now) : next;
        }
        return { ...s, feed: [...s.feed, { playerId: a.playerId, text }].slice(-30) };
      }
    }
    return s;
  },
  tick(s, { now, players }) {
    if (s.phase === "over") return s;
    const drawer = drawerOf(s);
    if (s.phase !== "reveal" && drawer && !players.some((p) => p.id === drawer)) return startTurn(s, s.turn + 1, now);
    if (s.phase === "choosing" && now >= s.deadline) return choose(s, 0, now);
    if (s.phase === "drawing" && now >= s.deadline) return reveal(s, now);
    if (s.phase === "reveal" && s.revealUntil && now >= s.revealUntil) return startTurn(s, s.turn + 1, now);
    return s;
  },
  publicView(s) {
    const word = s.word ? display(s.word) : "";
    return {
      drawerId: drawerOf(s),
      turn: s.turn,
      totalTurns: s.totalTurns,
      phase: s.phase,
      deadline: s.deadline,
      hintAt: s.startedAt + (s.seconds * 1000) / 2,
      mask: maskOf(word),
      // Revealed by the clients only after hintAt.
      firstLetter: s.phase === "drawing" ? word.charAt(0) : "",
      strokes: s.strokes,
      correct: s.correct,
      feed: s.feed,
      scores: s.scores,
      answer: s.phase === "reveal" ? word : null,
    };
  },
  privateView(s, id) {
    if (id !== drawerOf(s)) return undefined;
    if (s.phase === "choosing") return { choices: s.choices.map(display) };
    if (s.phase === "drawing" && s.word) return { word: display(s.word) };
    return undefined;
  },
  Screen,
  Controller,
};

export default drawGuess;
