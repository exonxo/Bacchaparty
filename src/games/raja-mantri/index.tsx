"use client";
import { Avatar } from "@/components/Avatar";
import { Button, Panel, PhoneMessage, PlayerChip, Scoreboard } from "@/components/ui";
import { HOST_ID, type GameModule, type Player } from "@/lib/types";
import { shuffle } from "@/lib/util";

type Role = "raja" | "mantri" | "chor" | "sipahi";

const ROLE_INFO: Record<Role, { label: string; emoji: string; points: number }> = {
  raja: { label: "Raja", emoji: "👑", points: 1000 },
  mantri: { label: "Mantri", emoji: "📜", points: 800 },
  chor: { label: "Chor", emoji: "🦹", points: 0 },
  sipahi: { label: "Sipahi", emoji: "💂", points: 500 },
};

interface State {
  round: number;
  seats: string[];
  roles: Record<string, Role>;
  phase: "raja" | "mantri" | "result";
  guess: string | null;
  scores: Record<string, number>;
  lastPoints: Record<string, number>;
}

interface Pub {
  round: number;
  seats: string[];
  phase: State["phase"];
  rajaId: string | null;
  mantriId: string | null;
  suspects: string[];
  guess: string | null;
  correct: boolean | null;
  roles: Record<string, Role> | null;
  lastPoints: Record<string, number>;
  scores: Record<string, number>;
}

interface Priv {
  role: Role;
}

function deal(seats: string[], round: number, scores: Record<string, number>): State {
  const roles: Record<string, Role> = {};
  const dealt = shuffle<Role>(["raja", "mantri", "chor", "sipahi"]);
  seats.forEach((id, i) => (roles[id] = dealt[i]));
  return { round, seats, roles, phase: "raja", guess: null, scores, lastPoints: {} };
}

const whoIs = (s: State, r: Role) => s.seats.find((id) => s.roles[id] === r) ?? null;

function score(s: State, guess: string): State {
  const chor = whoIs(s, "chor")!;
  const correct = guess === chor;
  const pts: Record<string, number> = {};
  for (const id of s.seats) {
    const r = s.roles[id];
    if (r === "raja") pts[id] = 1000;
    else if (r === "sipahi") pts[id] = 500;
    else if (r === "mantri") pts[id] = correct ? 800 : 0;
    else pts[id] = correct ? 0 : 800;
  }
  const scores = { ...s.scores };
  for (const id of s.seats) scores[id] = (scores[id] ?? 0) + pts[id];
  return { ...s, phase: "result", guess, scores, lastPoints: pts };
}

const nameOf = (players: Player[], id: string | null) => players.find((p) => p.id === id)?.name ?? "?";

function Screen({ view, players, act }: { view: Pub; players: Player[]; act: (t: string, p?: unknown) => void }) {
  const seatPlayers = view.seats.map((id) => players.find((p) => p.id === id) ?? { id, name: "Left", avatar: "", connected: false });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Panel className="space-y-6 py-8 text-center">
        <div className="text-muted">Round {view.round}</div>
        {view.phase === "raja" && (
          <>
            <div className="text-5xl">🃏</div>
            <div className="text-4xl font-extrabold">Chits are dealt! Check your phone.</div>
            <div className="text-2xl text-muted">Raja, announce yourself — tap “I’m the Raja”.</div>
          </>
        )}
        {view.phase === "mantri" && (
          <>
            <div className="text-3xl">
              👑 <b className="text-gold">{nameOf(players, view.rajaId)}</b> is the Raja!
            </div>
            <div className="text-4xl font-extrabold">
              “Mantri <span className="text-teal">{nameOf(players, view.mantriId)}</span>, find the Chor!”
            </div>
            <div className="text-2xl text-muted">
              Is it {view.suspects.map((id) => nameOf(players, id)).join(" or ")}?
            </div>
          </>
        )}
        {view.phase === "result" && view.roles && (
          <>
            <div className="pop-in text-5xl font-extrabold">{view.correct ? "✅ Chor pakda gaya!" : "❌ Wrong guess! The Chor takes the Mantri’s points!"}</div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {seatPlayers.map((p) => {
                const r = ROLE_INFO[view.roles![p.id]];
                return (
                  <div key={p.id} className="rounded-3xl bg-white/5 p-4">
                    <div className="text-5xl">{r.emoji}</div>
                    <div className="text-xl font-bold">{r.label}</div>
                    <div className="text-muted">
                      <Avatar id={p.avatar} /> {p.name}
                    </div>
                    <div className="text-2xl font-extrabold text-gold">+{view.lastPoints[p.id] ?? 0}</div>
                  </div>
                );
              })}
            </div>
            <Button size="lg" onClick={() => act("next")}>
              Deal again ▶
            </Button>
          </>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          {seatPlayers.map((p) => (
            <PlayerChip key={p.id} player={p} highlight={p.id === view.rajaId} />
          ))}
        </div>
      </Panel>
      <Scoreboard players={players} scores={view.scores} />
    </div>
  );
}

function Controller({ view, priv, me, players, send }: { view: Pub; priv: Priv | undefined; me: Player; players: Player[]; send: (t: string, p?: unknown) => void }) {
  if (!view.seats.includes(me.id)) return <PhoneMessage emoji="👀" title="This game is for 4 players">Watch the big screen!</PhoneMessage>;
  if (view.phase === "result") {
    return (
      <PhoneMessage emoji={view.correct ? "✅" : "❌"} title={view.correct ? "Chor caught!" : "Chor escaped!"}>
        You got <b className="text-gold">+{view.lastPoints[me.id] ?? 0}</b> this round.
        <div className="mt-3 text-3xl font-extrabold text-gold">{view.scores[me.id] ?? 0} total</div>
        <div className="mt-6">
          <Button onClick={() => send("next")}>Deal again ▶</Button>
        </div>
      </PhoneMessage>
    );
  }
  if (!priv) return <PhoneMessage emoji="🃏" title="Dealing chits…" />;
  const r = ROLE_INFO[priv.role];
  return (
    <div className="space-y-5">
      <Panel className="py-6 text-center">
        <div className="text-7xl">{r.emoji}</div>
        <div className="text-4xl font-extrabold text-gold">{r.label}</div>
        <div className="text-muted">{r.points ? `${r.points} points` : "0 points — don't get caught!"}</div>
      </Panel>
      {view.phase === "raja" &&
        (priv.role === "raja" ? (
          <Button size="xl" tone="gold" className="w-full" onClick={() => send("raja")}>
            👑 I’m the Raja!
          </Button>
        ) : (
          <div className="text-center text-lg text-muted">Waiting for the Raja to speak up…</div>
        ))}
      {view.phase === "mantri" &&
        (priv.role === "mantri" ? (
          <div className="space-y-3">
            <div className="text-center text-xl font-bold">Who is the Chor?</div>
            {view.suspects.map((id) => {
              const p = players.find((x) => x.id === id);
              return (
                <Button key={id} tone="teal" size="lg" className="w-full" onClick={() => confirm(`Is ${p?.name ?? "?"} the Chor?`) && send("guess", id)}>
                  <Avatar id={p?.avatar} /> {p?.name ?? "?"}
                </Button>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-lg text-muted">
            {priv.role === "raja" ? "Now watch your Mantri hunt the Chor!" : "Keep a straight face… the Mantri is watching 👀"}
          </div>
        ))}
    </div>
  );
}

const rajaMantri: GameModule<State, Pub, Priv, Record<string, never>> = {
  id: "raja-mantri",
  defaultOptions: {},
  init({ players }) {
    const seats = players.slice(0, 4).map((p) => p.id);
    const scores: Record<string, number> = {};
    seats.forEach((id) => (scores[id] = 0));
    return deal(seats, 1, scores);
  },
  reduce(s, a) {
    if (a.type === "next") {
      if (s.phase !== "result") return s;
      if (a.playerId !== HOST_ID && !s.seats.includes(a.playerId)) return s;
      return deal(s.seats, s.round + 1, s.scores);
    }
    if (a.playerId === HOST_ID) return s;
    if (a.type === "raja" && s.phase === "raja" && s.roles[a.playerId] === "raja") return { ...s, phase: "mantri" };
    if (a.type === "guess" && s.phase === "mantri" && s.roles[a.playerId] === "mantri") {
      const target = a.payload as string;
      const r = s.roles[target];
      if (r !== "chor" && r !== "sipahi") return s;
      return score(s, target);
    }
    return s;
  },
  publicView(s) {
    const chor = whoIs(s, "chor");
    return {
      round: s.round,
      seats: s.seats,
      phase: s.phase,
      rajaId: s.phase === "raja" ? null : whoIs(s, "raja"),
      mantriId: s.phase === "raja" ? null : whoIs(s, "mantri"),
      suspects: s.phase === "raja" ? [] : s.seats.filter((id) => s.roles[id] === "chor" || s.roles[id] === "sipahi").sort(),
      guess: s.guess,
      correct: s.phase === "result" ? s.guess === chor : null,
      roles: s.phase === "result" ? s.roles : null,
      lastPoints: s.lastPoints,
      scores: s.scores,
    };
  },
  privateView(s, id) {
    return s.roles[id] ? { role: s.roles[id] } : undefined;
  },
  Screen,
  Controller,
};

export default rajaMantri;
