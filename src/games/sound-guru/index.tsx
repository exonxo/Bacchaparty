"use client";
import { Button, LevelPicker, NumberPicker, Panel, PhoneMessage, Scoreboard, TextAnswer } from "@/components/ui";
import { SOUNDS, type SoundPrompt } from "@/content/sound-guru";
import { HOST_ID, type ControllerProps, type GameModule, type Level, type Player, type ScreenProps } from "@/lib/types";
import { answerMatches, shuffle } from "@/lib/util";

interface Options {
  level: Level;
  roundsPerPlayer: number;
}

type Phase = "ready" | "making" | "reveal" | "over";

interface State {
  level: Level;
  deck: SoundPrompt[];
  makers: string[];
  turn: number;
  totalTurns: number;
  phase: Phase;
  prompt: SoundPrompt | null;
  roundStart: number | null;
  correct: string[];
  wrong: { playerId: string; text: string; at: number }[];
  scores: Record<string, number>;
}

interface Pub {
  makerId: string | null;
  turn: number;
  totalTurns: number;
  phase: Phase;
  roundStart: number | null;
  correct: string[];
  wrong: State["wrong"];
  scores: Record<string, number>;
  /** Only revealed after the round. */
  answer: string | null;
}

interface Priv {
  sound: string;
  tip: string;
}

const POINTS = [3, 2];

function deckFor(level: Level): SoundPrompt[] {
  const levels: Level[] = level === "kids" ? ["kids"] : level === "family" ? ["kids", "family"] : ["family", "adults"];
  return shuffle(SOUNDS.filter((s) => levels.includes(s.level)));
}

function makerOf(s: State): string | null {
  return s.makers.length ? s.makers[s.turn % s.makers.length] : null;
}

function startTurn(s: State, turn: number): State {
  if (turn >= s.totalTurns) return { ...s, turn, phase: "over", prompt: null };
  const deck = s.deck.length ? s.deck : deckFor(s.level);
  return { ...s, turn, deck: deck.slice(1), prompt: deck[0], phase: "ready", roundStart: null, correct: [], wrong: [] };
}

function guessersLeft(s: State, players: Player[]): number {
  const maker = makerOf(s);
  return players.filter((p) => p.connected && p.id !== maker && !s.correct.includes(p.id)).length;
}

function Screen({ view, players, act }: ScreenProps<Pub>) {
  const maker = players.find((p) => p.id === view.makerId);
  if (view.phase === "over") {
    return (
      <div className="mx-auto max-w-xl space-y-6 text-center">
        <div className="text-5xl font-extrabold">🏆 Sound Guru results</div>
        <Scoreboard players={players} scores={view.scores} big title="Final scores" />
      </div>
    );
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Panel className="flex min-h-[26rem] flex-col items-center justify-center gap-4 text-center">
        <div className="text-muted">
          Round {view.turn + 1} of {view.totalTurns}
        </div>
        {maker && <div className="text-8xl">{maker.avatar}</div>}
        <div className="text-4xl font-extrabold">{maker?.name ?? "…"}</div>
        {view.phase === "ready" && <div className="text-2xl text-muted">is the Sound Maker — check your phone!</div>}
        {view.phase === "making" && (
          <>
            <div className="wiggle text-3xl font-bold text-gold">🔊 is making a sound… guess on your phones!</div>
            <div className="flex flex-wrap justify-center gap-2">
              {view.correct.map((id) => {
                const p = players.find((x) => x.id === id);
                return p ? (
                  <span key={id} className="pop-in rounded-full bg-green px-3 py-1 font-bold text-bg">
                    ✅ {p.name}
                  </span>
                ) : null;
              })}
            </div>
            {view.wrong.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 text-lg text-muted">
                {view.wrong.slice(-6).map((w, i) => (
                  <span key={i} className="rounded-full bg-white/10 px-3 py-1 line-through">
                    {w.text}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
        {view.phase === "reveal" && (
          <>
            <div className="text-xl text-muted">The sound was</div>
            <div className="pop-in text-5xl font-extrabold text-gold">{view.answer}</div>
            <div className="text-lg">{view.correct.length} guessed it!</div>
          </>
        )}
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {view.phase === "ready" && (
            <Button tone="ghost" onClick={() => act("skip")}>
              🔁 Different sound
            </Button>
          )}
          {view.phase === "making" && (
            <Button tone="ghost" onClick={() => act("reveal")}>
              👀 Reveal
            </Button>
          )}
          {view.phase === "reveal" && (
            <Button size="lg" onClick={() => act("next")}>
              Next round ▶
            </Button>
          )}
          {view.phase !== "reveal" && (
            <Button tone="ghost" onClick={() => act("skipMaker")}>
              ⏭ Skip this player
            </Button>
          )}
        </div>
      </Panel>
      <Scoreboard players={players} scores={view.scores} />
    </div>
  );
}

function Controller({ view, priv, me, players, send }: ControllerProps<Pub, Priv>) {
  const isMaker = view.makerId === me.id;
  const makerName = players.find((p) => p.id === view.makerId)?.name ?? "The Sound Maker";
  const myScore = view.scores[me.id] ?? 0;
  if (view.phase === "over") return <PhoneMessage emoji="🏆" title="Game over!">You scored {myScore} points. Look at the big screen.</PhoneMessage>;
  if (view.phase === "reveal") {
    const got = view.correct.includes(me.id);
    return (
      <div className="space-y-4">
        <PhoneMessage emoji={isMaker ? "🎙️" : got ? "🎉" : "🙈"} title={`It was: ${view.answer}`}>
          {isMaker ? `${view.correct.length} people guessed your sound!` : got ? "You got it!" : "Better luck next round."} · Your score: {myScore}
        </PhoneMessage>
        {isMaker && (
          <Button size="lg" className="w-full" onClick={() => send("next")}>
            Next round ▶
          </Button>
        )}
      </div>
    );
  }
  if (isMaker) {
    if (view.phase === "ready" || !priv) {
      return (
        <div className="space-y-4">
          <PhoneMessage emoji="🎙️" title="You're the Sound Maker!">
            Hide your screen, then tap to see your secret sound.
          </PhoneMessage>
          <Button size="xl" className="w-full" onClick={() => send("start")}>
            👀 Show my sound
          </Button>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <Panel className="py-8 text-center">
          <div className="text-sm font-bold uppercase tracking-widest text-muted">Make this sound</div>
          <div className="mt-2 text-4xl font-extrabold text-gold">{priv.sound}</div>
          <div className="mt-3 text-lg text-muted">💡 {priv.tip}</div>
          <div className="mt-3 text-sm text-muted">No words that give it away!</div>
        </Panel>
        <div className="text-center text-lg">{view.correct.length} guessed so far</div>
        <Button tone="ghost" size="lg" className="w-full" onClick={() => send("reveal")}>
          Reveal the answer
        </Button>
      </div>
    );
  }
  if (view.phase === "ready") return <PhoneMessage emoji="👂" title={`${makerName} is getting ready…`}>Listen carefully!</PhoneMessage>;
  if (view.correct.includes(me.id)) return <PhoneMessage emoji="✅" title="You got it!">Shh — don&apos;t tell the others. Score: {myScore}</PhoneMessage>;
  const myWrong = view.wrong.filter((w) => w.playerId === me.id).slice(-3);
  return (
    <div className="space-y-4">
      <PhoneMessage emoji="👂" title={`What sound is ${makerName} making?`} />
      <TextAnswer onSubmit={(t) => send("guess", t)} placeholder="e.g. pressure cooker" buttonLabel="Guess" />
      {myWrong.length > 0 && <div className="text-center text-muted">Not quite: {myWrong.map((w) => w.text).join(", ")}</div>}
    </div>
  );
}

function OptionsForm({ value, onChange }: { value: Options; onChange: (o: Options) => void }) {
  return (
    <div className="space-y-4">
      <LevelPicker value={value.level} onChange={(level) => onChange({ ...value, level })} />
      <NumberPicker
        label="Turns as Sound Maker"
        value={value.roundsPerPlayer}
        onChange={(roundsPerPlayer) => onChange({ ...value, roundsPerPlayer })}
        options={[1, 2, 3]}
        format={(n) => `${n} each`}
      />
    </div>
  );
}

const soundGuru: GameModule<State, Pub, Priv, Options> = {
  id: "sound-guru",
  defaultOptions: { level: "family", roundsPerPlayer: 1 },
  OptionsForm,
  init({ players, options }) {
    const makers = shuffle(players.map((p) => p.id));
    const base: State = {
      level: options.level,
      deck: deckFor(options.level),
      makers,
      turn: 0,
      totalTurns: Math.max(1, makers.length * options.roundsPerPlayer),
      phase: "ready",
      prompt: null,
      roundStart: null,
      correct: [],
      wrong: [],
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    };
    return startTurn(base, 0);
  },
  onPlayerJoin(s, p) {
    if (p.id in s.scores) return s;
    return { ...s, scores: { ...s.scores, [p.id]: 0 } };
  },
  reduce(s, a, { now, players }) {
    const maker = makerOf(s);
    const isHost = a.playerId === HOST_ID;
    const isMaker = a.playerId === maker;
    switch (a.type) {
      case "start":
        if ((!isHost && !isMaker) || s.phase !== "ready") return s;
        return { ...s, phase: "making", roundStart: now };
      case "skip":
        if (!isHost || s.phase !== "ready") return s;
        return startTurn(s, s.turn);
      case "skipMaker":
        if (!isHost || s.phase === "over") return s;
        return startTurn(s, s.turn + 1);
      case "reveal":
        if ((!isHost && !isMaker) || s.phase !== "making") return s;
        return { ...s, phase: "reveal" };
      case "next":
        if ((!isHost && !isMaker) || s.phase !== "reveal") return s;
        return startTurn(s, s.turn + 1);
      case "guess": {
        if (s.phase !== "making" || isHost || isMaker || !s.prompt || s.correct.includes(a.playerId)) return s;
        const text = String(a.payload ?? "").slice(0, 40).trim();
        if (!text) return s;
        if (answerMatches(text, [s.prompt.sound, ...s.prompt.answers])) {
          const pts = POINTS[s.correct.length] ?? 1;
          const scores = { ...s.scores, [a.playerId]: (s.scores[a.playerId] ?? 0) + pts };
          if (maker) scores[maker] = (scores[maker] ?? 0) + 1;
          const next: State = { ...s, correct: [...s.correct, a.playerId], scores };
          return guessersLeft(next, players) === 0 ? { ...next, phase: "reveal" } : next;
        }
        return { ...s, wrong: [...s.wrong, { playerId: a.playerId, text, at: now }].slice(-20) };
      }
    }
    return s;
  },
  tick(s, { players }) {
    if (s.phase === "over" || s.phase === "reveal") return s;
    const maker = makerOf(s);
    // Sound Maker left the room: move on.
    if (maker && !players.some((p) => p.id === maker)) return startTurn(s, s.turn + 1);
    return s;
  },
  publicView(s) {
    return {
      makerId: makerOf(s),
      turn: s.turn,
      totalTurns: s.totalTurns,
      phase: s.phase,
      roundStart: s.roundStart,
      correct: s.correct,
      wrong: s.wrong,
      scores: s.scores,
      answer: s.phase === "reveal" ? (s.prompt?.sound ?? null) : null,
    };
  },
  privateView(s, id) {
    if (id !== makerOf(s) || s.phase !== "making" || !s.prompt) return undefined;
    return { sound: s.prompt.sound, tip: s.prompt.tip };
  },
  Screen,
  Controller,
};

export default soundGuru;
