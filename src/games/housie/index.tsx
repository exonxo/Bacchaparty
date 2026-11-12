"use client";
import { NumberPicker, Toggle } from "@/components/ui";
import { callFor } from "@/content/housieCalls";
import { HOST_ID, type ControllerProps, type GameModule } from "@/lib/types";
import { PRIZES, type Prize, type Ticket } from "./helpers";
import { Phone } from "./PaperPhone";
import { TvScreen } from "./TvScreen";
import { shuffle } from "@/lib/util";

export interface Options {
  autoCall: number; // seconds between calls, 0 = manual
  autoMark: boolean;
}

export interface State {
  options: Options;
  tickets: Record<string, Ticket>;
  marks: Record<string, number[]>;
  order: number[];
  called: number[];
  nextCallAt: number | null;
  paused: boolean;
  winners: Partial<Record<Prize, { playerId: string; name: string }>>;
  scores: Record<string, number>;
  lastEvent: { text: string; at: number; kind: "win" | "bogey"; playerId: string } | null;
  bogey: Record<string, number>;
}

export interface Pub {
  called: number[];
  current: number | null;
  call: string | null;
  autoCall: number;
  autoMark: boolean;
  paused: boolean;
  nextCallAt: number | null;
  winners: State["winners"];
  scores: Record<string, number>;
  lastEvent: State["lastEvent"];
  done: boolean;
}

export interface Priv {
  ticket: Ticket;
  marks: number[];
  bogeyAt: number | null;
}

function randInt(lo: number, hi: number) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/** Generates a valid Housie ticket: 15 numbers, 5 per row, 1–3 per column, columns sorted. */
export function makeTicket(): Ticket {
  for (;;) {
    // Decide how many numbers each column gets (1..3), totalling 15.
    const counts = Array(9).fill(1);
    let extra = 6;
    while (extra > 0) {
      const c = randInt(0, 8);
      if (counts[c] < 3) {
        counts[c]++;
        extra--;
      }
    }
    // Assign rows so that every row has exactly 5 numbers.
    const grid: boolean[][] = [Array(9).fill(false), Array(9).fill(false), Array(9).fill(false)];
    const rowCount = [0, 0, 0];
    let ok = true;
    const cols = shuffle([...Array(9).keys()]).sort((a, b) => counts[b] - counts[a]);
    for (const c of cols) {
      const rows = [0, 1, 2].sort((a, b) => rowCount[a] - rowCount[b] || Math.random() - 0.5).slice(0, counts[c]);
      for (const r of rows) {
        if (rowCount[r] >= 5) ok = false;
        grid[r][c] = true;
        rowCount[r]++;
      }
    }
    if (!ok || rowCount.some((n) => n !== 5)) continue;
    const ticket: Ticket = [Array(9).fill(0), Array(9).fill(0), Array(9).fill(0)];
    for (let c = 0; c < 9; c++) {
      const lo = c === 0 ? 1 : c * 10;
      const hi = c === 8 ? 90 : c * 10 + 9;
      const nums = shuffle(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i))
        .slice(0, counts[c])
        .sort((a, b) => a - b);
      let k = 0;
      for (let r = 0; r < 3; r++) if (grid[r][c]) ticket[r][c] = nums[k++];
    }
    return ticket;
  }
}

function prizeNumbers(ticket: Ticket, prize: Prize): number[] {
  const all = ticket.flat().filter(Boolean);
  if (prize === "top") return ticket[0].filter(Boolean);
  if (prize === "middle") return ticket[1].filter(Boolean);
  if (prize === "bottom") return ticket[2].filter(Boolean);
  return all;
}

function isValidClaim(ticket: Ticket, called: number[], prize: Prize): boolean {
  const set = new Set(called);
  if (prize === "early5") return ticket.flat().filter((n) => n && set.has(n)).length >= 5;
  return prizeNumbers(ticket, prize).every((n) => set.has(n));
}

function callNext(s: State, now: number): State {
  const n = s.order[s.called.length];
  if (n === undefined) return s;
  return {
    ...s,
    called: [...s.called, n],
    nextCallAt: s.options.autoCall && !s.paused ? now + s.options.autoCall * 1000 : null,
  };
}


/** With a big screen, the phone is the same view without the host's controls. */
function Controller(props: ControllerProps<Pub, Priv>) {
  return <Phone {...props} isHost={false} hostAct={() => {}} together />;
}

function OptionsForm({ value, onChange }: { value: Options; onChange: (o: Options) => void }) {
  return (
    <div className="space-y-4">
      <NumberPicker
        label="Calling"
        value={value.autoCall}
        onChange={(autoCall) => onChange({ ...value, autoCall })}
        options={[0, 6, 10, 15]}
        format={(n) => (n === 0 ? "Manual" : `Auto every ${n}s`)}
      />
      <Toggle label="Auto-mark tickets (easier for kids & grandparents)" value={value.autoMark} onChange={(autoMark) => onChange({ ...value, autoMark })} />
    </div>
  );
}

export const housie: GameModule<State, Pub, Priv, Options> = {
  id: "housie",
  paper: true,
  tvPaper: true,
  defaultOptions: { autoCall: 10, autoMark: false },
  OptionsForm,
  init({ players, options, now }) {
    const tickets: Record<string, Ticket> = {};
    const marks: Record<string, number[]> = {};
    const scores: Record<string, number> = {};
    for (const p of players) {
      tickets[p.id] = makeTicket();
      marks[p.id] = [];
      scores[p.id] = 0;
    }
    return {
      options,
      tickets,
      marks,
      scores,
      order: shuffle(Array.from({ length: 90 }, (_, i) => i + 1)),
      called: [],
      // With auto-call on, the first number comes by itself after a short "get ready".
      nextCallAt: options.autoCall ? now + 6000 : null,
      paused: false,
      winners: {},
      lastEvent: null,
      bogey: {},
    };
  },
  onPlayerJoin(s, p) {
    if (s.tickets[p.id]) return s;
    return { ...s, tickets: { ...s.tickets, [p.id]: makeTicket() }, marks: { ...s.marks, [p.id]: [] }, scores: { ...s.scores, [p.id]: 0 } };
  },
  reduce(s, a, { now, players }) {
    if (a.playerId === HOST_ID) {
      if (a.type === "next") return callNext(s, now);
      if (a.type === "pause") {
        const paused = !s.paused;
        return { ...s, paused, nextCallAt: paused ? null : now + s.options.autoCall * 1000 };
      }
      return s;
    }
    const ticket = s.tickets[a.playerId];
    if (!ticket) return s;
    if (a.type === "mark") {
      const n = Number(a.payload);
      if (!ticket.flat().includes(n)) return s;
      const cur = s.marks[a.playerId] ?? [];
      const next = cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n];
      return { ...s, marks: { ...s.marks, [a.playerId]: next } };
    }
    if (a.type === "claim") {
      const prize = a.payload as Prize;
      const def = PRIZES.find((p) => p.id === prize);
      if (!def || s.winners[prize]) return s;
      const name = players.find((p) => p.id === a.playerId)?.name ?? "Someone";
      if (!isValidClaim(ticket, s.called, prize)) {
        return { ...s, bogey: { ...s.bogey, [a.playerId]: now }, lastEvent: { text: `Bogey! ${name}'s ${def.label} claim isn't complete`, at: now, kind: "bogey", playerId: a.playerId } };
      }
      return {
        ...s,
        winners: { ...s.winners, [prize]: { playerId: a.playerId, name } },
        scores: { ...s.scores, [a.playerId]: (s.scores[a.playerId] ?? 0) + def.points },
        lastEvent: { text: `${name} wins ${def.label}!`, at: now, kind: "win", playerId: a.playerId },
      };
    }
    return s;
  },
  tick(s, { now }) {
    if (!s.options.autoCall || s.paused || s.winners.full) return s;
    if (s.nextCallAt === null) return { ...s, nextCallAt: now + s.options.autoCall * 1000 };
    if (now >= s.nextCallAt) return callNext(s, now);
    return s;
  },
  publicView(s) {
    const current = s.called[s.called.length - 1] ?? null;
    return {
      called: s.called,
      current,
      call: current ? callFor(current) : null,
      autoCall: s.options.autoCall,
      autoMark: s.options.autoMark,
      paused: s.paused,
      nextCallAt: s.nextCallAt,
      winners: s.winners,
      scores: s.scores,
      lastEvent: s.lastEvent,
      done: !!s.winners.full || s.called.length >= 90,
    };
  },
  privateView(s, id) {
    if (!s.tickets[id]) return undefined;
    return { ticket: s.tickets[id], marks: s.marks[id] ?? [], bogeyAt: s.bogey[id] ?? null };
  },
  Screen: TvScreen,
  Controller,
  Phone,
};
