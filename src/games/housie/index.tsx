"use client";
import { useEffect, useRef } from "react";
import { Button, NumberPicker, Panel, PhoneMessage, Scoreboard, Toggle } from "@/components/ui";
import { callFor } from "@/content/housieCalls";
import { HOST_ID, type GameModule, type Player } from "@/lib/types";
import { shuffle } from "@/lib/util";

/** A ticket is 3 rows x 9 columns; 0 = blank. */
type Ticket = number[][];
type Prize = "early5" | "top" | "middle" | "bottom" | "full";

const PRIZES: { id: Prize; label: string; points: number }[] = [
  { id: "early5", label: "Early Five", points: 10 },
  { id: "top", label: "Top Line", points: 15 },
  { id: "middle", label: "Middle Line", points: 15 },
  { id: "bottom", label: "Bottom Line", points: 15 },
  { id: "full", label: "Full House", points: 30 },
];

interface Options {
  autoCall: number; // seconds between calls, 0 = manual
  autoMark: boolean;
}

interface State {
  options: Options;
  tickets: Record<string, Ticket>;
  marks: Record<string, number[]>;
  order: number[];
  called: number[];
  nextCallAt: number | null;
  paused: boolean;
  winners: Partial<Record<Prize, { playerId: string; name: string }>>;
  scores: Record<string, number>;
  lastEvent: { text: string; at: number } | null;
  bogey: Record<string, number>;
}

interface Pub {
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

interface Priv {
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

function speak(text: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    u.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}

function Screen({ view, players, act, now }: { view: Pub; players: Player[]; act: (t: string, p?: unknown) => void; now: number }) {
  const spoken = useRef<number | null>(null);
  useEffect(() => {
    if (view.current && spoken.current !== view.current) {
      spoken.current = view.current;
      speak(view.call ?? String(view.current));
    }
  }, [view.current, view.call]);
  const calledSet = new Set(view.called);
  const left = view.nextCallAt ? Math.max(0, Math.ceil((view.nextCallAt - now) / 1000)) : null;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <Panel className="flex flex-col items-center gap-3 py-8 text-center">
          {view.current ? (
            <>
              <div key={view.current} className="pop-in flex h-40 w-40 items-center justify-center rounded-full bg-gold text-8xl font-extrabold text-bg shadow-2xl">
                {view.current}
              </div>
              <div className="text-3xl font-bold">{view.call}</div>
            </>
          ) : (
            <div className="text-3xl font-bold">Ready? Tap “Next number” to start!</div>
          )}
          <div className="text-muted">{view.called.length} of 90 called</div>
          <div className="flex flex-wrap justify-center gap-3">
            {!view.done && (
              <Button size="lg" onClick={() => act("next")}>
                Next number
              </Button>
            )}
            {view.autoCall > 0 && !view.done && (
              <Button size="lg" tone="ghost" onClick={() => act("pause")}>
                {view.paused ? "▶ Resume auto-call" : `⏸ Pause${left !== null ? ` (${left}s)` : ""}`}
              </Button>
            )}
          </div>
          {view.lastEvent && now - view.lastEvent.at < 8000 && (
            <div className="pop-in rounded-2xl bg-pink px-5 py-2 text-xl font-bold">{view.lastEvent.text}</div>
          )}
        </Panel>
        <Panel>
          <div className="grid grid-cols-10 gap-1.5">
            {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                className={`flex aspect-square items-center justify-center rounded-lg text-lg font-bold ${
                  n === view.current ? "bg-gold text-bg" : calledSet.has(n) ? "bg-pink text-white" : "bg-white/5 text-white/30"
                }`}
              >
                {n}
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="space-y-6">
        <Panel>
          <div className="mb-3 text-sm font-bold uppercase tracking-widest text-muted">Prizes</div>
          <ul className="space-y-2">
            {PRIZES.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-lg">
                <span className="font-semibold">
                  {p.label} <span className="text-sm text-muted">({p.points})</span>
                </span>
                <span className={view.winners[p.id] ? "font-bold text-gold" : "text-muted"}>{view.winners[p.id]?.name ?? "open"}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Scoreboard players={players} scores={view.scores} />
      </div>
    </div>
  );
}

function Controller({ view, priv, send, now }: { view: Pub; priv: Priv | undefined; send: (t: string, p?: unknown) => void; now: number }) {
  if (!priv) return <PhoneMessage emoji="🎟️" title="Getting your ticket…" />;
  const called = new Set(view.called);
  const marks = new Set(view.autoMark ? priv.ticket.flat().filter((n) => n && called.has(n)) : priv.marks);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-muted">Last number</div>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold text-3xl font-extrabold text-bg">{view.current ?? "–"}</div>
      </div>
      <div className="overflow-hidden rounded-2xl border-4 border-gold bg-[#fff7ec] p-1">
        {priv.ticket.map((row, r) => (
          <div key={r} className="grid grid-cols-9">
            {row.map((n, c) => (
              <button
                key={c}
                disabled={!n || view.autoMark}
                onClick={() => send("mark", n)}
                className={`m-[2px] flex aspect-square items-center justify-center rounded-md text-lg font-extrabold ${
                  !n ? "bg-transparent" : marks.has(n) ? "bg-pink text-white" : "bg-white text-bg"
                }`}
              >
                {n || ""}
              </button>
            ))}
          </div>
        ))}
      </div>
      {priv.bogeyAt && now - priv.bogeyAt < 5000 && (
        <div className="rounded-xl bg-red px-4 py-2 text-center font-bold">Bogey! That claim isn’t complete yet.</div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {PRIZES.map((p) => {
          const winner = view.winners[p.id];
          return (
            <Button key={p.id} tone={winner ? "ghost" : "teal"} disabled={!!winner} onClick={() => send("claim", p.id)} className={p.id === "full" ? "col-span-2" : ""}>
              {winner ? `${p.label}: ${winner.name}` : `Claim ${p.label}`}
            </Button>
          );
        })}
      </div>
    </div>
  );
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
  defaultOptions: { autoCall: 0, autoMark: false },
  OptionsForm,
  init({ players, options }) {
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
      nextCallAt: null,
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
        return { ...s, bogey: { ...s.bogey, [a.playerId]: now }, lastEvent: { text: `🙈 Bogey! ${name}'s ${def.label} claim isn't complete`, at: now } };
      }
      return {
        ...s,
        winners: { ...s.winners, [prize]: { playerId: a.playerId, name } },
        scores: { ...s.scores, [a.playerId]: (s.scores[a.playerId] ?? 0) + def.points },
        lastEvent: { text: `🎉 ${name} wins ${def.label}!`, at: now },
      };
    }
    return s;
  },
  tick(s, { now }) {
    if (!s.options.autoCall || s.paused || s.winners.full) return s;
    if (s.nextCallAt === null) return s.called.length ? { ...s, nextCallAt: now + s.options.autoCall * 1000 } : s;
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
  Screen,
  Controller,
};
