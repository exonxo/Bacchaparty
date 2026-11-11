"use client";
import { Avatar } from "@/components/Avatar";
import { Button, Panel, PhoneMessage } from "@/components/ui";
import { HOST_ID, type GameModule, type Player } from "@/lib/types";
import { COLORS, HOME, LANES, LAST_LOOP, LOOP, SAFE, START, YARD, YARD_SPOTS, tokenXY, type Color } from "./board";
import { applyMove, applyRoll, newGame, nextTurn, type LudoState } from "./rules";

const HEX: Record<Color, string> = { red: "#e53935", green: "#43a047", yellow: "#fbc02d", blue: "#1e88e5" };
const LABEL: Record<Color, string> = { red: "Red", green: "Green", yellow: "Yellow", blue: "Blue" };
/** A disconnected player's turn is skipped after this long. */
const AWAY_SKIP_MS = 10_000;

type State = LudoState;
type Pub = LudoState;

function nameOf(players: Player[], id: string) {
  return players.find((p) => p.id === id)?.name ?? "Player";
}

function Dice({ value, rollId, size = 72 }: { value: number | null; rollId: number; size?: number }) {
  const pips: Record<number, [number, number][]> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
  };
  return (
    <svg key={rollId} viewBox="0 0 3 3" width={size} height={size} className="pop-in shrink-0 rounded-2xl bg-white shadow-lg">
      {value
        ? pips[value].map(([x, y], i) => <circle key={i} cx={x * 0.8 + 0.7} cy={y * 0.8 + 0.7} r={0.28} fill="#1a0b2e" />)
        : <text x="1.5" y="2" textAnchor="middle" fontSize="1.4" fill="#1a0b2e">?</text>}
    </svg>
  );
}

function Board({ view, players }: { view: Pub; players: Player[] }) {
  const current = view.seats[view.turn];
  const seated = new Set(view.seats.map((s) => s.color));
  // Group tokens by drawn position so stacked pieces fan out.
  const groups = new Map<string, { color: Color; idx: number; x: number; y: number }[]>();
  for (const seat of view.seats) {
    view.tokens[seat.color]!.forEach((p, idx) => {
      const [x, y] = tokenXY(seat.color, p, idx);
      const key = `${x.toFixed(2)},${y.toFixed(2)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ color: seat.color, idx, x, y });
    });
  }
  const yardOrigin: Record<Color, [number, number]> = { red: [0, 0], green: [9, 0], yellow: [9, 9], blue: [0, 9] };
  const startColor = new Map<number, Color>(COLORS.map((c) => [START[c], c]));
  return (
    <svg viewBox="-0.2 -0.2 15.4 15.4" className="mx-auto aspect-square w-full max-w-[min(78vh,100%)] drop-shadow-2xl">
      <rect x={-0.2} y={-0.2} width={15.4} height={15.4} rx={0.4} fill="#fff7ec" />
      {COLORS.map((c) => {
        const [ox, oy] = yardOrigin[c];
        const owner = view.seats.find((s) => s.color === c);
        return (
          <g key={c} opacity={seated.has(c) ? 1 : 0.35}>
            <rect x={ox} y={oy} width={6} height={6} rx={0.3} fill={HEX[c]} />
            <rect x={ox + 0.8} y={oy + 0.8} width={4.4} height={4.4} rx={0.4} fill="#fff" />
            {YARD_SPOTS[c].map(([x, y], i) => (
              <circle key={i} cx={x + 0.5} cy={y + 0.5} r={0.55} fill={HEX[c]} opacity={0.25} />
            ))}
            {owner && (
              <text x={ox + 3} y={oy + 5.75} textAnchor="middle" fontSize={0.55} fontWeight={800} fill="#fff">
                {nameOf(players, owner.playerId).slice(0, 12)}
              </text>
            )}
          </g>
        );
      })}
      {LOOP.map(([x, y], i) => {
        const sc = startColor.get(i);
        return (
          <g key={i}>
            <rect x={x} y={y} width={1} height={1} fill={sc ? HEX[sc] : "#fff"} stroke="#cdb8e8" strokeWidth={0.04} />
            {SAFE.has(i) && (
              <text x={x + 0.5} y={y + 0.78} textAnchor="middle" fontSize={0.75} fill={sc ? "#fff" : "#9a86b5"}>
                ★
              </text>
            )}
          </g>
        );
      })}
      {COLORS.map((c) =>
        LANES[c].map(([x, y], i) => <rect key={`${c}${i}`} x={x} y={y} width={1} height={1} fill={HEX[c]} stroke="#fff" strokeWidth={0.04} />),
      )}
      <polygon points="6,6 6,9 7.5,7.5" fill={HEX.red} />
      <polygon points="6,6 9,6 7.5,7.5" fill={HEX.green} />
      <polygon points="9,6 9,9 7.5,7.5" fill={HEX.yellow} />
      <polygon points="6,9 9,9 7.5,7.5" fill={HEX.blue} />
      {[...groups.values()].flatMap((group) =>
        group.map((t, k) => {
          const spread = group.length > 1 ? 0.22 : 0;
          const ang = (k / group.length) * Math.PI * 2;
          const cx = t.x + Math.cos(ang) * spread;
          const cy = t.y + Math.sin(ang) * spread;
          const canMove = view.phase === "move" && current?.color === t.color && view.movable.includes(t.idx);
          return (
            <g key={`${t.color}${t.idx}`}>
              {canMove && (
                <circle cx={cx} cy={cy} r={0.5} fill="none" stroke="#1a0b2e" strokeWidth={0.08}>
                  <animate attributeName="r" values="0.42;0.55;0.42" dur="1s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={cx} cy={cy} r={group.length > 1 ? 0.32 : 0.38} fill={HEX[t.color]} stroke="#fff" strokeWidth={0.08} />
              <text x={cx} y={cy + 0.15} textAnchor="middle" fontSize={0.42} fontWeight={800} fill="#fff">
                {t.idx + 1}
              </text>
            </g>
          );
        }),
      )}
    </svg>
  );
}

function progressLabel(p: number) {
  if (p === YARD) return "in yard";
  if (p >= HOME) return "home 🏠";
  if (p > LAST_LOOP) return `home lane ${p - LAST_LOOP}/5`;
  return `square ${p + 1}`;
}

function Screen({ view, players, act, now }: { view: Pub; players: Player[]; act: (t: string, p?: unknown) => void; now: number }) {
  const current = view.seats[view.turn];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Board view={view} players={players} />
      <div className="space-y-4">
        {view.phase === "over" ? (
          <Panel className="text-center">
            <div className="text-5xl">🏆</div>
            <div className="mt-2 text-3xl font-extrabold">{nameOf(players, view.finished[0])} wins!</div>
          </Panel>
        ) : (
          current && (
            <Panel>
              <div className="text-sm font-bold uppercase tracking-widest text-muted">Turn</div>
              <div className="mt-1 flex items-center gap-3 text-2xl font-extrabold">
                <span className="h-6 w-6 rounded-full" style={{ background: HEX[current.color] }} />
                {nameOf(players, current.playerId)}
              </div>
              <div className="mt-3 flex items-center gap-4">
                <Dice value={view.dice} rollId={view.rollId} />
                <div className="text-lg text-muted">{view.phase === "roll" ? "Roll on your phone 🎲" : "Choose a piece to move"}</div>
              </div>
              {view.event && now - view.event.at < 6000 && <div className="pop-in mt-3 rounded-xl bg-pink px-3 py-2 font-bold">{view.event.text}</div>}
              <Button tone="ghost" size="sm" className="mt-4" onClick={() => act("skip")}>
                Skip this turn
              </Button>
            </Panel>
          )
        )}
        <Panel>
          <div className="mb-2 text-sm font-bold uppercase tracking-widest text-muted">Players</div>
          <ul className="space-y-2">
            {view.seats.map((s) => {
              const home = view.tokens[s.color]!.filter((p) => p >= HOME).length;
              const place = view.finished.indexOf(s.playerId);
              const p = players.find((x) => x.id === s.playerId);
              return (
                <li key={s.color} className={`flex items-center justify-between gap-2 text-lg ${p?.connected === false ? "opacity-50" : ""}`}>
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="h-4 w-4 rounded-full" style={{ background: HEX[s.color] }} />
                    <Avatar id={p?.avatar} /> {nameOf(players, s.playerId)}
                  </span>
                  <span className="text-muted">{place >= 0 ? <b className="text-gold">#{place + 1}</b> : `${home}/4 home`}</span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Controller({ view, me, players, send, now }: { view: Pub; priv: undefined; me: Player; players: Player[]; send: (t: string, p?: unknown) => void; now: number }) {
  const seat = view.seats.find((s) => s.playerId === me.id);
  if (!seat) return <PhoneMessage emoji="👀" title="Watching this game">Ludo is for 2–4 players — you can play the next one!</PhoneMessage>;
  const myTokens = view.tokens[seat.color]!;
  const current = view.seats[view.turn];
  const myTurn = current?.playerId === me.id && view.phase !== "over";
  const place = view.finished.indexOf(me.id);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl px-4 py-3 text-xl font-extrabold text-white" style={{ background: HEX[seat.color] }}>
        <span>You are {LABEL[seat.color]}</span>
        <span>{myTokens.filter((p) => p >= HOME).length}/4 home</span>
      </div>
      {view.phase === "over" ? (
        <PhoneMessage emoji={place === 0 ? "🏆" : "🎲"} title={place === 0 ? "You won!" : `You finished #${place + 1}`} />
      ) : place >= 0 ? (
        <PhoneMessage emoji="🎉" title={`You finished #${place + 1}!`}>Cheer on the others.</PhoneMessage>
      ) : myTurn ? (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            <Dice value={view.dice} rollId={view.rollId} size={88} />
          </div>
          {view.phase === "roll" ? (
            <Button size="xl" className="w-full" onClick={() => send("roll")}>
              🎲 Roll!
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="text-center text-lg font-bold">You rolled {view.dice}. Which piece?</div>
              {view.movable
                .filter((i, k, arr) => arr.findIndex((j) => myTokens[j] === myTokens[i]) === k)
                .map((i) => (
                <Button key={i} size="lg" tone="teal" className="w-full" onClick={() => send("move", i)}>
                  Piece {i + 1} · {progressLabel(myTokens[i])} → {progressLabel(myTokens[i] === YARD ? 0 : myTokens[i] + (view.dice ?? 0))}
                </Button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 text-center">
          <div className="text-xl font-bold">{current ? `${nameOf(players, current.playerId)}'s turn` : "Waiting…"}</div>
          <div className="flex justify-center">
            <Dice value={view.dice} rollId={view.rollId} />
          </div>
        </div>
      )}
      {view.event && now - view.event.at < 6000 && <div className="rounded-xl bg-white/10 px-3 py-2 text-center font-semibold">{view.event.text}</div>}
      <Panel>
        <div className="mb-2 text-sm font-bold uppercase tracking-widest text-muted">Your pieces</div>
        <ul className="grid grid-cols-2 gap-2 text-base">
          {myTokens.map((p, i) => (
            <li key={i} className="rounded-xl bg-white/5 px-3 py-2">
              <b>#{i + 1}</b> {progressLabel(p)}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

const game: GameModule<State, Pub, undefined, Record<string, never>> = {
  id: "ludo-yatra",
  defaultOptions: {},
  init({ players, now }) {
    return newGame(
      players.map((p) => p.id),
      now,
    );
  },
  reduce(s, a, { now, players }) {
    const name = (id: string) => nameOf(players, id);
    const present = (id: string) => !!players.find((p) => p.id === id)?.connected;
    if (a.playerId === HOST_ID) {
      if (a.type === "skip" && s.phase !== "over") {
        const seat = s.seats[s.turn];
        return nextTurn({ ...s, event: { text: `${name(seat.playerId)}'s turn was skipped`, at: now } }, now, present);
      }
      return s;
    }
    const seat = s.seats[s.turn];
    if (!seat || seat.playerId !== a.playerId) return s;
    if (a.type === "roll") return applyRoll(s, 1 + Math.floor(Math.random() * 6), now, name);
    if (a.type === "move") return applyMove(s, Number(a.payload), now, name);
    return s;
  },
  tick(s, { now, players }) {
    if (s.phase === "over") return s;
    const seat = s.seats[s.turn];
    const p = players.find((x) => x.id === seat?.playerId);
    if (seat && (!p || !p.connected) && now - s.turnStartedAt > AWAY_SKIP_MS) {
      const present = (id: string) => !!players.find((x) => x.id === id)?.connected;
      // If nobody else is around either, just wait.
      if (!s.seats.some((x) => x.playerId !== seat.playerId && present(x.playerId) && !s.finished.includes(x.playerId))) return s;
      return nextTurn({ ...s, event: { text: `${p?.name ?? "A player"} is away — turn skipped`, at: now } }, now, present);
    }
    return s;
  },
  publicView(s) {
    return s;
  },
  Screen,
  Controller,
};

export default game;
