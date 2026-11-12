"use client";
import { Avatar } from "@/components/Avatar";
import { Button, Panel } from "@/components/ui";
import { HOST_ID, type ControllerProps, type GameModule, type Player, type ScreenProps } from "@/lib/types";
import { COLORS, HOME, LANES, LOOP, SAFE, START, YARD, YARD_SPOTS, tokenXY, type Color } from "./board";
import { AWAY_SKIP_MS, TURN_MS, type Note, type Pub, type State } from "./helpers";
import { Phone } from "./PaperPhone";
import { applyMove, applyRoll, newGame, nextTurn } from "./rules";

export type { Pub, State } from "./helpers";

const HEX: Record<Color, string> = { red: "#e53935", green: "#43a047", yellow: "#fbc02d", blue: "#1e88e5" };

function nameOf(players: Player[], id: string) {
  return players.find((p) => p.id === id)?.name ?? "Player";
}

/* ------------------------------------------------------------------ */
/* Big-screen (TV) view — still the classic look                        */
/* ------------------------------------------------------------------ */

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

function Screen({ view, players, act, now, spectator }: ScreenProps<Pub>) {
  const current = view.seats[view.turn];
  const note = view.note && now - view.note.at < 6000 ? view.note : null;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Board view={view} players={players} />
      <div className="space-y-4">
        {view.phase === "over" ? (
          <Panel className="text-center">
            <div className="mt-2 text-3xl font-extrabold">{nameOf(players, view.finished[0])} jeet gaye!</div>
          </Panel>
        ) : (
          current && (
            <Panel>
              <div className="text-sm font-bold uppercase tracking-widest text-muted">Baari</div>
              <div className="mt-1 flex items-center gap-3 text-2xl font-extrabold">
                <span className="h-6 w-6 rounded-full" style={{ background: HEX[current.color] }} />
                {nameOf(players, current.playerId)}
              </div>
              <div className="mt-3 flex items-center gap-4">
                <Dice value={view.dice} rollId={view.rollId} />
                <div className="text-lg text-muted">{view.phase === "roll" ? "Phone pe dice ghumao" : "Goti chuno"}</div>
              </div>
              {note && <div className="pop-in mt-3 rounded-xl bg-pink px-3 py-2 font-bold">{note.text}</div>}
              {!spectator && (
                <Button tone="ghost" size="sm" className="mt-4" onClick={() => act("skip")}>
                  Skip this turn
                </Button>
              )}
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

/* ------------------------------------------------------------------ */
/* Rules wrapper                                                        */
/* ------------------------------------------------------------------ */

const noop = () => {};

/** Phones without host controls (the classic controller path) still get the paper view. */
function Controller(props: ControllerProps<Pub, undefined>) {
  return <Phone {...props} isHost={false} hostAct={noop} together />;
}

/** Works out what just happened, for the animation and the note everyone sees. */
function describe(prev: State, next: State, now: number, players: Player[], auto = false): State {
  const seat = prev.seats[prev.turn];
  if (!seat || next === prev) return next;
  const name = nameOf(players, seat.playerId);
  const rolled = next.rollId !== prev.rollId;
  const before = prev.tokens[seat.color]!;
  const after = next.tokens[seat.color]!;
  const idx = after.findIndex((p, i) => p !== before[i]);
  const again = next.phase === "roll" && next.turn === prev.turn && !next.finished.includes(seat.playerId);
  let note: Note | null = null;
  let lastMove = next.lastMove;

  if (idx >= 0) {
    const captured: { color: Color; idx: number; from: number }[] = [];
    for (const other of prev.seats) {
      if (other.color === seat.color) continue;
      prev.tokens[other.color]!.forEach((p, i) => {
        if (p !== YARD && next.tokens[other.color]![i] === YARD) captured.push({ color: other.color, idx: i, from: p });
      });
    }
    const from = before[idx];
    const to = after[idx];
    lastMove = { id: (prev.lastMove?.id ?? 0) + 1, color: seat.color, idx, from, to, captured, at: now };
    const finished = next.finished.length > prev.finished.length && next.finished.includes(seat.playerId);
    if (finished) note = { kind: "finish", text: `${name} #${next.finished.indexOf(seat.playerId) + 1} pe finish!`, at: now, playerId: seat.playerId };
    else if (captured.length) {
      const victims = [...new Set(captured.map((c) => nameOf(players, prev.seats.find((x) => x.color === c.color)!.playerId)))].join(" aur ");
      note = { kind: "capture", text: `Kat gaya! ${name} ne ${victims} ki goti kaati`, at: now, playerId: seat.playerId };
    } else if (to >= HOME) note = { kind: "home", text: `${name} ki goti ghar pahunchi!`, at: now, playerId: seat.playerId };
    else if (from === YARD) note = { kind: "out", text: `${name} ki goti bahar aayi!`, at: now, playerId: seat.playerId };
    else note = { kind: "move", text: `${name} ne ${to - from} khane chale`, at: now, playerId: seat.playerId };
  } else if (rolled) {
    const three = prev.sixes >= 2 && next.dice === 6;
    note = three
      ? { kind: "three6", text: `Teen baar 6! ${name} ki baari gayi`, at: now, playerId: seat.playerId }
      : { kind: "nomove", text: `${name} ka ${next.dice} — koi chaal nahi`, at: now, playerId: seat.playerId };
  }

  const phaseChanged = next.turn !== prev.turn || next.phase !== prev.phase || next.rollId !== prev.rollId;
  return {
    ...next,
    lastMove,
    note: note ? { ...note, auto, again } : next.note,
    phaseStartedAt: phaseChanged ? now : next.phaseStartedAt,
  };
}

const rollDie = () => 1 + Math.floor(Math.random() * 6);

const game: GameModule<State, Pub, undefined, Record<string, never>> = {
  id: "ludo-yatra",
  paper: true,
  defaultOptions: {},
  init({ players, now }) {
    return { ...newGame(players.map((p) => p.id), now), phaseStartedAt: now, note: null, lastMove: null };
  },
  reduce(s, a, { now, players }) {
    const name = (id: string) => nameOf(players, id);
    const present = (id: string) => !!players.find((p) => p.id === id)?.connected;
    if (a.playerId === HOST_ID) {
      if (a.type === "skip" && s.phase !== "over") {
        const seat = s.seats[s.turn];
        const next = nextTurn(s, now, present) as State;
        return { ...next, phaseStartedAt: now, note: { kind: "skip", text: `${name(seat.playerId)} ki baari skip`, at: now, playerId: seat.playerId } };
      }
      return s;
    }
    const seat = s.seats[s.turn];
    if (!seat || seat.playerId !== a.playerId) return s;
    if (a.type === "roll") return describe(s, applyRoll(s, rollDie(), now, name) as State, now, players);
    if (a.type === "move") return describe(s, applyMove(s, Number(a.payload), now, name) as State, now, players);
    return s;
  },
  tick(s, { now, players }) {
    if (s.phase === "over") return s;
    const seat = s.seats[s.turn];
    if (!seat) return s;
    const p = players.find((x) => x.id === seat.playerId);
    const present = (id: string) => !!players.find((x) => x.id === id)?.connected;
    if (!p || !p.connected) {
      if (now - s.turnStartedAt <= AWAY_SKIP_MS) return s;
      // If nobody else is around either, just wait.
      if (!s.seats.some((x) => x.playerId !== seat.playerId && present(x.playerId) && !s.finished.includes(x.playerId))) return s;
      const next = nextTurn(s, now, present) as State;
      return { ...next, phaseStartedAt: now, note: { kind: "away", text: `${p?.name ?? "Koi"} offline hai — baari skip`, at: now, playerId: seat.playerId } };
    }
    // Time's up for a player who is here: the game plays their turn for them.
    if (now - (s.phaseStartedAt ?? s.turnStartedAt) >= TURN_MS) {
      const name = (id: string) => nameOf(players, id);
      let next = s.phase === "roll" ? (applyRoll(s, rollDie(), now, name) as State) : s;
      if (next.phase === "move" && next.turn === s.turn && next.movable.length) next = applyMove(next, next.movable[0], now, name) as State;
      return describe(s, next, now, players, true);
    }
    return s;
  },
  publicView(s) {
    return s;
  },
  Screen,
  Controller,
  Phone,
};

export default game;
