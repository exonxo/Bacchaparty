"use client";
import { Button, Panel, PhoneMessage, PlayerChip, Toggle } from "@/components/ui";
import { START_LETTERS, songsFor } from "@/content/antakshari";
import { HOST_ID, type GameModule, type Player } from "@/lib/types";
import { pick, shuffle } from "@/lib/util";

interface Options {
  hints: boolean;
}

type Team = 0 | 1;
type Phase = "singing" | "judging" | "challenged" | "next-letter";

const TEAM_NAMES = ["Team Laddoo 🟠", "Team Jalebi 🟡"];
const TEAM_COLORS = ["text-saffron", "text-gold"];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface State {
  options: Options;
  teams: [string[], string[]];
  turn: Team;
  letter: string;
  phase: Phase;
  votes: Record<string, "valid" | "challenge">;
  scores: [number, number];
  songsSung: number;
  hintSeed: number;
  lastEvent: { text: string; at: number } | null;
}

interface Pub {
  teams: [string[], string[]];
  teamNames: string[];
  turn: Team;
  letter: string;
  phase: Phase;
  votes: Record<string, "valid" | "challenge">;
  scores: [number, number];
  songsSung: number;
  hint: { title: string; source: string } | null;
  hintsOn: boolean;
  lastEvent: State["lastEvent"];
}

const other = (t: Team): Team => (t === 0 ? 1 : 0);
const teamOf = (s: { teams: [string[], string[]] }, id: string): Team | null => (s.teams[0].includes(id) ? 0 : s.teams[1].includes(id) ? 1 : null);

function accept(s: State, now: number): State {
  const scores: [number, number] = [...s.scores];
  scores[s.turn] += 1;
  return { ...s, scores, phase: "next-letter", votes: {}, songsSung: s.songsSung + 1, lastEvent: { text: `✅ Valid song! +1 ${TEAM_NAMES[s.turn]}`, at: now } };
}

function Screen({ view, players, act, now }: { view: Pub; players: Player[]; act: (t: string, p?: unknown) => void; now: number }) {
  const singing = view.turn;
  const judging = other(singing);
  const find = (id: string) => players.find((p) => p.id === id);
  const judges = view.teams[judging].map(find).filter(Boolean) as Player[];
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {([0, 1] as Team[]).map((t) => (
          <Panel key={t} className={t === singing ? "border-gold/70" : ""}>
            <div className="flex items-center justify-between">
              <div className={`text-2xl font-extrabold ${TEAM_COLORS[t]}`}>{view.teamNames[t]}</div>
              <div className="text-5xl font-extrabold text-gold">{view.scores[t]}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {view.teams[t].map((id) => {
                const p = find(id);
                return p ? <PlayerChip key={id} player={p} extra={view.votes[id] ? <span>{view.votes[id] === "valid" ? "👍" : "✋"}</span> : null} /> : null;
              })}
            </div>
          </Panel>
        ))}
      </div>
      <Panel className="space-y-5 py-8 text-center">
        <div className="text-2xl">
          <b className={TEAM_COLORS[singing]}>{view.teamNames[singing]}</b>
          {view.phase === "next-letter" ? ", tell us the last letter of your song!" : ", sing a song starting with…"}
        </div>
        <div key={view.letter} className="pop-in mx-auto flex h-44 w-44 items-center justify-center rounded-full bg-pink text-9xl font-extrabold text-white shadow-2xl">
          {view.letter}
        </div>
        {view.phase === "singing" && <div className="text-xl text-muted">🎤 Sing at least one full line, then tap “We sang!” on your phone.</div>}
        {view.phase === "judging" && (
          <div className="text-xl">
            🧑‍⚖️ <b className={TEAM_COLORS[judging]}>{view.teamNames[judging]}</b>, was it valid? Vote on your phones.
            {judges.filter((p) => p.connected).length === 0 && <div className="text-muted">(No one on that team is connected — host decides.)</div>}
          </div>
        )}
        {view.phase === "challenged" && <div className="text-2xl font-bold text-red">✋ Challenge! Host, you decide:</div>}
        {(view.phase === "judging" || view.phase === "challenged") && (
          <div className="flex justify-center gap-3">
            <Button tone="green" size="lg" onClick={() => act("accept")}>
              👍 Valid
            </Button>
            <Button tone="red" size="lg" onClick={() => act("reject")}>
              👎 Doesn’t count
            </Button>
          </div>
        )}
        {view.phase === "next-letter" && (
          <div className="mx-auto grid max-w-2xl grid-cols-9 gap-1.5">
            {LETTERS.map((l) => (
              <button key={l} onClick={() => act("letter", l)} className="rounded-lg bg-white/10 py-2 text-xl font-bold hover:bg-white/20">
                {l}
              </button>
            ))}
          </div>
        )}
        {view.lastEvent && now - view.lastEvent.at < 6000 && <div className="pop-in inline-block rounded-2xl bg-teal px-5 py-2 text-xl font-bold text-bg">{view.lastEvent.text}</div>}
        {view.hintsOn && view.phase === "singing" && (
          <div className="mx-auto max-w-xl rounded-2xl bg-white/5 p-4">
            <div className="text-sm font-bold uppercase tracking-widest text-muted">Hint</div>
            {view.hint ? (
              <div className="text-2xl font-bold">
                🎵 {view.hint.title} <span className="text-base font-normal text-muted">({view.hint.source})</span>
              </div>
            ) : (
              <div className="text-muted">No hint for this letter — you’re on your own!</div>
            )}
            <Button tone="ghost" size="sm" className="mt-2" onClick={() => act("hint")}>
              Another hint
            </Button>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <Button tone="ghost" size="sm" onClick={() => act("toggleHints")}>
            {view.hintsOn ? "Hide hints" : "Show hints"}
          </Button>
          {view.phase === "singing" && (
            <Button tone="ghost" size="sm" onClick={() => act("newLetter")}>
              🔀 Different letter
            </Button>
          )}
        </div>
      </Panel>
    </div>
  );
}

function Controller({ view, me, send }: { view: Pub; me: Player; send: (t: string, p?: unknown) => void }) {
  const myTeam = teamOf(view, me.id);
  if (myTeam === null) return <PhoneMessage emoji="👀" title="Joining a team…" />;
  const singing = myTeam === view.turn;
  const header = (
    <div className="mb-4 flex items-center justify-between">
      <div className={`text-xl font-extrabold ${TEAM_COLORS[myTeam]}`}>{view.teamNames[myTeam]}</div>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pink text-3xl font-extrabold">{view.letter}</div>
    </div>
  );
  if (singing) {
    if (view.phase === "singing")
      return (
        <div className="space-y-4">
          {header}
          <PhoneMessage emoji="🎤" title={`Your team's turn — sing “${view.letter}”!`} />
          <Button size="xl" tone="green" className="w-full" onClick={() => send("sang")}>
            🎶 We sang!
          </Button>
          <Button tone="ghost" className="w-full" onClick={() => confirm("Give up? The other team gets a point.") && send("giveup")}>
            🏳️ Give up
          </Button>
        </div>
      );
    if (view.phase === "next-letter")
      return (
        <div className="space-y-4">
          {header}
          <div className="text-center text-xl font-bold">What was the last letter of your song?</div>
          <div className="grid grid-cols-6 gap-2">
            {LETTERS.map((l) => (
              <button key={l} onClick={() => send("letter", l)} className="aspect-square rounded-xl bg-white/10 text-2xl font-extrabold active:bg-gold active:text-bg">
                {l}
              </button>
            ))}
          </div>
        </div>
      );
    return (
      <div>
        {header}
        <PhoneMessage emoji="🧑‍⚖️" title="The other team is judging…" />
      </div>
    );
  }
  // Judging team
  if (view.phase === "judging") {
    const mine = view.votes[me.id];
    return (
      <div className="space-y-4">
        {header}
        <div className="text-center text-xl font-bold">Did their song count?</div>
        <Button size="xl" tone={mine === "valid" ? "green" : "ghost"} className="w-full" onClick={() => send("vote", "valid")}>
          👍 Valid
        </Button>
        <Button size="xl" tone={mine === "challenge" ? "red" : "ghost"} className="w-full" onClick={() => send("vote", "challenge")}>
          ✋ Challenge
        </Button>
      </div>
    );
  }
  return (
    <div>
      {header}
      <PhoneMessage emoji={view.phase === "challenged" ? "✋" : "👂"} title={view.phase === "challenged" ? "Challenged! Host is deciding…" : "Other team is singing"}>
        {view.phase === "singing" ? "Listen carefully — you’ll judge if it counts. Get your next song ready!" : null}
      </PhoneMessage>
    </div>
  );
}

function OptionsForm({ value, onChange }: { value: Options; onChange: (o: Options) => void }) {
  return <Toggle label="Show song hints on the big screen" value={value.hints} onChange={(hints) => onChange({ ...value, hints })} />;
}

const antakshari: GameModule<State, Pub, undefined, Options> = {
  id: "antakshari",
  defaultOptions: { hints: false },
  OptionsForm,
  init({ players, options }) {
    const ids = shuffle(players.map((p) => p.id));
    const teams: [string[], string[]] = [ids.filter((_, i) => i % 2 === 0), ids.filter((_, i) => i % 2 === 1)];
    return {
      options,
      teams,
      turn: 0,
      letter: pick(START_LETTERS),
      phase: "singing",
      votes: {},
      scores: [0, 0],
      songsSung: 0,
      hintSeed: Math.floor(Math.random() * 100),
      lastEvent: null,
    };
  },
  onPlayerJoin(s, p) {
    if (teamOf(s, p.id) !== null) return s;
    const t: Team = s.teams[0].length <= s.teams[1].length ? 0 : 1;
    const teams: [string[], string[]] = [[...s.teams[0]], [...s.teams[1]]];
    teams[t].push(p.id);
    return { ...s, teams };
  },
  reduce(s, a, { now, players }) {
    if (a.playerId === HOST_ID) {
      switch (a.type) {
        case "accept":
          return s.phase === "judging" || s.phase === "challenged" ? accept(s, now) : s;
        case "reject":
          return s.phase === "judging" || s.phase === "challenged"
            ? { ...s, phase: "singing", votes: {}, lastEvent: { text: "👎 Doesn’t count — try another song!", at: now } }
            : s;
        case "letter": {
          const l = String(a.payload ?? "").toUpperCase();
          if (s.phase !== "next-letter" || !LETTERS.includes(l)) return s;
          return { ...s, letter: l, turn: other(s.turn), phase: "singing" };
        }
        case "newLetter":
          return s.phase === "singing" ? { ...s, letter: pick(START_LETTERS.filter((l) => l !== s.letter)) } : s;
        case "hint":
          return { ...s, hintSeed: s.hintSeed + 1 };
        case "toggleHints":
          return { ...s, options: { ...s.options, hints: !s.options.hints } };
      }
      return s;
    }
    const team = teamOf(s, a.playerId);
    if (team === null) return s;
    if (team === s.turn) {
      if (a.type === "sang" && s.phase === "singing") return { ...s, phase: "judging", votes: {} };
      if (a.type === "giveup" && s.phase === "singing") {
        const scores: [number, number] = [...s.scores];
        scores[other(s.turn)] += 1;
        return { ...s, scores, turn: other(s.turn), votes: {}, lastEvent: { text: `🏳️ ${TEAM_NAMES[s.turn]} gave up — +1 ${TEAM_NAMES[other(s.turn)]}`, at: now } };
      }
      if (a.type === "letter" && s.phase === "next-letter") {
        const l = String(a.payload ?? "").toUpperCase();
        if (!LETTERS.includes(l)) return s;
        return { ...s, letter: l, turn: other(s.turn), phase: "singing" };
      }
      return s;
    }
    if (a.type === "vote" && s.phase === "judging" && (a.payload === "valid" || a.payload === "challenge")) {
      const vote: "valid" | "challenge" = a.payload;
      if (s.votes[a.playerId] === vote) return s;
      const votes: State["votes"] = { ...s.votes, [a.playerId]: vote };
      if (vote === "challenge") return { ...s, votes, phase: "challenged" };
      const connected = new Set(players.filter((p) => p.connected).map((p) => p.id));
      const judges = s.teams[team].filter((id) => connected.has(id));
      if (judges.every((id) => votes[id] === "valid")) return accept({ ...s, votes }, now);
      return { ...s, votes };
    }
    return s;
  },
  publicView(s) {
    const songs = songsFor(s.letter);
    return {
      teams: s.teams,
      teamNames: TEAM_NAMES,
      turn: s.turn,
      letter: s.letter,
      phase: s.phase,
      votes: s.votes,
      scores: s.scores,
      songsSung: s.songsSung,
      hintsOn: s.options.hints,
      hint: s.options.hints && songs.length ? songs[s.hintSeed % songs.length] : null,
      lastEvent: s.lastEvent,
    };
  },
  Screen,
  Controller,
};

export default antakshari;
