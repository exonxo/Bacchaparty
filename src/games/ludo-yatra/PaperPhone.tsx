"use client";
import { Crown, Dices, SkipForward } from "lucide-react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { dur, ease, screenIn, spring } from "@/components/paper/motion";
import { InkDefs, Stamp } from "@/components/paper/objects";
import { PaperButton, Sticker } from "@/components/paper/Paper";
import { celebrate } from "@/lib/celebrate";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import type { PhoneProps, Player } from "@/lib/types";
import { COLORS, HOME, LANES, LOOP, SAFE, START, YARD, YARD_SPOTS, tokenXY, type Color } from "./board";
import { COLOR_NAME, INK_OF, ON_INK, TURN_MS, landing, placeLabel, type Pub } from "./helpers";

const INK = "#1e1a17";
const PAPER = "#fffdf8";
const BOARD = "#fbf3e1";

type Tokens = Pub["tokens"];

const nameOf = (players: Player[], id: string | undefined) => players.find((p) => p.id === id)?.name ?? "Koi";

/* ------------------------------------------------------------------ */
/* Pieces hop square by square                                          */
/* ------------------------------------------------------------------ */

const cloneTokens = (t: Tokens): Tokens => Object.fromEntries(Object.entries(t).map(([c, v]) => [c, [...(v ?? [])]])) as Tokens;

/**
 * Where each piece is drawn right now. After a move the piece walks from its old
 * square to the new one (≤55ms per square); a captured piece stays put until the
 * mover lands, then flies home. Reduced motion: pieces jump straight there.
 */
function useShownTokens(view: Pub, reduce: boolean) {
  const key = JSON.stringify(view.tokens);
  const moveId = view.lastMove?.id ?? 0;
  const moveRef = useRef(view.lastMove);
  moveRef.current = view.lastMove;
  const seenId = useRef(moveId);
  const [shown, setShown] = useState<Tokens>(view.tokens);

  useEffect(() => {
    const target = JSON.parse(key) as Tokens;
    const mv = moveRef.current;
    const fresh = !!mv && mv.id !== seenId.current;
    seenId.current = mv?.id ?? 0;
    if (!fresh || !mv || reduce || mv.from === YARD || mv.to <= mv.from) {
      setShown(target);
      return;
    }
    const start = cloneTokens(target);
    start[mv.color]![mv.idx] = mv.from;
    for (const c of mv.captured) start[c.color]![c.idx] = c.from;
    setShown(start);
    let p = mv.from;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const step = () => {
      p += 1;
      if (p >= mv.to) {
        setShown(target);
        return;
      }
      const next = cloneTokens(start);
      next[mv.color]![mv.idx] = p;
      setShown(next);
      timers.push(setTimeout(step, 55));
    };
    timers.push(setTimeout(step, 55));
    return () => timers.forEach(clearTimeout);
  }, [key, moveId, reduce]);

  return shown;
}

/* ------------------------------------------------------------------ */
/* The board                                                            */
/* ------------------------------------------------------------------ */

function starPoints(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(3)},${(cy + Math.sin(a) * rr).toFixed(3)}`);
  }
  return pts.join(" ");
}

const YARD_ORIGIN: Record<Color, [number, number]> = { red: [0, 0], green: [9, 0], yellow: [9, 9], blue: [0, 9] };

export function PaperBoard({
  view,
  players,
  meId,
  pickable,
  onPick,
  now,
}: {
  view: Pub;
  players: Player[];
  meId: string;
  /** Token indices of the current seat that can be moved by tapping. */
  pickable: number[];
  onPick: (idx: number) => void;
  now: number;
}) {
  const reduce = !!useReducedMotion();
  const shown = useShownTokens(view, reduce);
  const current = view.seats[view.turn];
  const seated = new Map(view.seats.map((s) => [s.color, s]));
  const startColor = new Map<number, Color>(COLORS.map((c) => [START[c], c]));
  const mv = view.lastMove;
  const flyingHome = new Set(mv && now - mv.at < 1500 ? mv.captured.map((c) => `${c.color}${c.idx}`) : []);

  const groups = new Map<string, { color: Color; idx: number; x: number; y: number }[]>();
  for (const seat of view.seats) {
    (shown[seat.color] ?? []).forEach((p, idx) => {
      const [x, y] = tokenXY(seat.color, p, idx);
      const k = `${x.toFixed(2)},${y.toFixed(2)}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push({ color: seat.color, idx, x, y });
    });
  }
  const pieces = [...groups.values()].flatMap((g) =>
    g.map((t, k) => {
      const spread = g.length > 1 ? 0.2 : 0;
      const ang = (k / g.length) * Math.PI * 2;
      return { ...t, cx: t.x + Math.cos(ang) * spread, cy: t.y + Math.sin(ang) * spread, small: g.length > 1 };
    }),
  );

  // "Kat gaya!" over the square where a piece was captured.
  const stampAt = mv && mv.captured.length && now - mv.at < 1800 ? tokenXY(mv.color, mv.to, 0) : null;

  return (
    <div className="relative">
      <svg viewBox="-0.2 -0.2 15.4 15.4" className="block aspect-square w-full" role="img" aria-label="Ludo board">
        <style>{`@keyframes ludoPulse{0%,100%{opacity:.35}50%{opacity:1}} .ludo-pulse{animation:ludoPulse 1.1s ease-in-out infinite}`}</style>
        <rect x={-0.2} y={-0.2} width={15.4} height={15.4} rx={0.35} fill={BOARD} stroke={INK} strokeWidth={0.07} />

        {/* Yards */}
        {COLORS.map((c) => {
          const [ox, oy] = YARD_ORIGIN[c];
          const seat = seated.get(c);
          const mine = seat?.playerId === meId;
          const turn = current?.color === c && view.phase !== "over";
          return (
            <g key={c} opacity={seat ? 1 : 0.28}>
              <rect x={ox + 0.08} y={oy + 0.08} width={5.84} height={5.84} rx={0.3} fill={INK_OF[c]} stroke={INK} strokeWidth={mine ? 0.12 : 0.06} />
              <rect x={ox + 0.8} y={oy + 0.8} width={4.4} height={4.4} rx={0.35} fill={PAPER} stroke={INK} strokeWidth={0.05} />
              {YARD_SPOTS[c].map(([x, y], i) => (
                <circle key={i} cx={x + 0.5} cy={y + 0.5} r={0.5} fill={INK_OF[c]} opacity={0.16} />
              ))}
              {turn && <rect x={ox + 1.05} y={oy + 1.05} width={3.9} height={3.9} rx={0.3} fill="none" stroke={INK} strokeWidth={0.08} strokeDasharray="0.28 0.16" className="ludo-pulse" />}
              {seat && (
                <text x={ox + 3} y={oy + 5.62} textAnchor="middle" fontSize={0.52} fontWeight={800} fill={ON_INK[c]} style={{ fontFamily: "var(--font-display)" }}>
                  {mine ? "Aap" : nameOf(players, seat.playerId).slice(0, 10)}
                </text>
              )}
            </g>
          );
        })}

        {/* The shared track */}
        {LOOP.map(([x, y], i) => {
          const sc = startColor.get(i);
          return (
            <g key={i}>
              <rect x={x} y={y} width={1} height={1} fill={sc ? INK_OF[sc] : PAPER} stroke={INK} strokeOpacity={0.35} strokeWidth={0.035} />
              {SAFE.has(i) && <polygon points={starPoints(x + 0.5, y + 0.5, 0.34)} fill={sc ? PAPER : "none"} stroke={INK} strokeWidth={0.045} opacity={sc ? 0.9 : 0.55} />}
            </g>
          );
        })}

        {/* Home lanes */}
        {COLORS.map((c) =>
          LANES[c].map(([x, y], i) => (
            <rect key={`${c}${i}`} x={x} y={y} width={1} height={1} fill={INK_OF[c]} opacity={seated.has(c) ? 1 : 0.35} stroke={INK} strokeOpacity={0.35} strokeWidth={0.035} />
          )),
        )}

        {/* Home */}
        <polygon points="6,6 6,9 7.5,7.5" fill={INK_OF.red} stroke={INK} strokeWidth={0.04} />
        <polygon points="6,6 9,6 7.5,7.5" fill={INK_OF.green} stroke={INK} strokeWidth={0.04} />
        <polygon points="9,6 9,9 7.5,7.5" fill={INK_OF.yellow} stroke={INK} strokeWidth={0.04} />
        <polygon points="6,9 9,9 7.5,7.5" fill={INK_OF.blue} stroke={INK} strokeWidth={0.04} />

        {/* Pieces */}
        {pieces.map((t) => {
          const canPick = current?.color === t.color && pickable.includes(t.idx);
          const flying = flyingHome.has(`${t.color}${t.idx}`);
          // Bigger pieces (and biggest when you can move them) so they are easy to see and tap.
          const r = canPick ? 0.56 : t.small ? 0.36 : 0.46;
          return (
            <motion.g
              key={`${t.color}${t.idx}`}
              initial={false}
              animate={{ x: t.cx, y: t.cy }}
              transition={flying ? { type: "spring", visualDuration: 0.45, bounce: 0.2 } : { duration: 0.05, ease: "linear" }}
            >
              {canPick && (
                <>
                  <circle r={0.74} fill="#f2b632" opacity={0.55} className="ludo-pulse" />
                  <circle r={0.74} fill="none" stroke={INK} strokeWidth={0.07} />
                </>
              )}
              <circle r={r} cy={0.05} fill={INK} />
              <circle r={r} fill={INK_OF[t.color]} stroke={INK} strokeWidth={0.07} />
              <circle r={r * 0.55} fill="none" stroke={ON_INK[t.color]} strokeWidth={0.05} opacity={0.7} />
              <text y={0.13} textAnchor="middle" fontSize={r * 1.05} fontWeight={800} fill={ON_INK[t.color]}>
                {t.idx + 1}
              </text>
            </motion.g>
          );
        })}

        {/* Big invisible tap targets (≥44px on a 360px phone) for pieces you can move */}
        {pieces
          .filter((t) => current?.color === t.color && pickable.includes(t.idx))
          .map((t) => (
            <circle
              key={`hit${t.idx}`}
              cx={t.cx}
              cy={t.cy}
              r={1.1}
              fill="transparent"
              role="button"
              tabIndex={0}
              aria-label={`Goti ${t.idx + 1} chalao, ${placeLabel(view.tokens[t.color]![t.idx])} se`}
              className="cursor-pointer focus:outline-none"
              onClick={() => onPick(t.idx)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPick(t.idx);
                }
              }}
            />
          ))}
      </svg>
      <AnimatePresence>
        {stampAt && (
          <motion.div
            key={mv!.id}
            className="pointer-events-none absolute"
            style={{ left: `${((stampAt[0] + 0.2) / 15.4) * 100}%`, top: `${((stampAt[1] + 0.2) / 15.4) * 100}%` }}
            initial={{ opacity: 0, scale: 1.6, rotate: -14, x: "-50%", y: "-120%" }}
            animate={{ opacity: 1, scale: 1, rotate: -8, x: "-50%", y: "-120%", transition: { delay: 0.25, ...spring.settle } }}
            exit={{ opacity: 0, transition: { duration: dur.screenExit, ease: ease.in } }}
          >
            <Stamp className="bg-paper/90 !text-p-lead">Kat gaya!</Stamp>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The dice                                                             */
/* ------------------------------------------------------------------ */

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

/** A paper dice. Each new roll tumbles in the same way (no fade, so it is never blank). */
export function PaperDice({ value, rollId, size = 76 }: { value: number | null; rollId: number; size?: number }) {
  return (
    <motion.svg
      key={rollId}
      viewBox="-0.15 -0.15 3.4 3.4"
      width={size}
      height={size}
      className="block shrink-0"
      role="img"
      aria-label={value ? `Dice: ${value}` : "Dice abhi ghooma nahi"}
      initial={rollId ? { rotate: -220, scale: 0.55, y: -18 } : false}
      animate={{ rotate: rollId % 2 ? 6 : -5, scale: 1, y: 0, transition: spring.settle }}
    >
      <rect x={0.08} y={0.08} width={3} height={3} rx={0.45} fill={INK} />
      <rect x={0} y={0} width={3} height={3} rx={0.45} fill={PAPER} stroke={INK} strokeWidth={0.07} />
      {value ? (
        PIPS[value].map(([x, y], i) => <circle key={i} cx={x * 0.85 + 0.65} cy={y * 0.85 + 0.65} r={0.27} fill={INK} />)
      ) : (
        <text x={1.5} y={2.05} textAnchor="middle" fontSize={1.5} fontWeight={800} fill={INK} opacity={0.35}>
          ?
        </text>
      )}
    </motion.svg>
  );
}

/* ------------------------------------------------------------------ */
/* Turn banner + timer                                                  */
/* ------------------------------------------------------------------ */

export function TurnBanner({ view, players, meId, now }: { view: Pub; players: Player[]; meId: string; now: number }) {
  const seat = view.seats[view.turn];
  if (!seat) return null;
  const mine = seat.playerId === meId;
  const who = nameOf(players, seat.playerId);
  const left = Math.max(0, (view.phaseStartedAt ?? view.turnStartedAt) + TURN_MS - now);
  const secs = Math.ceil(left / 1000);
  const urgent = secs <= 5;
  const offline = players.find((p) => p.id === seat.playerId)?.connected === false;

  return (
    <motion.section
      key={`${view.turn}-${mine}`}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0, transition: { duration: dur.screen, ease: ease.out } }}
      className={`cut relative overflow-hidden rounded-soft p-3 ${mine ? "-rotate-[0.6deg]" : ""}`}
      style={{ background: mine ? INK_OF[seat.color] : PAPER, color: mine ? ON_INK[seat.color] : INK }}
    >
      <div className="flex items-center gap-3">
        <Sticker id={players.find((p) => p.id === seat.playerId)?.avatar} size={40} />
        <div className="min-w-0 flex-1">
          {mine ? (
            <>
              <div className="font-display text-p-title font-extrabold leading-none">Aapki baari!</div>
              <div className="mt-1 text-p-body font-semibold opacity-90">{view.phase === "roll" ? "Dice ghumao" : `${view.dice} aaya — goti chuno`}</div>
            </>
          ) : (
            <>
              <div className="font-display text-p-lead font-extrabold leading-tight">{who} ki baari</div>
              <div className="text-p-body text-muted">
                {offline ? "Phone offline hai — thodi der mein skip hoga" : view.phase === "roll" ? "Dice ghoom raha hai…" : `${view.dice} aaya — goti chun rahe hain…`}
              </div>
            </>
          )}
        </div>
        <span
          className="font-display w-9 shrink-0 text-right text-p-title font-extrabold tabular-nums"
          style={{ color: urgent ? (mine ? ON_INK[seat.color] : "var(--vermilion)") : undefined }}
        >
          {secs}
        </span>
      </div>
      <div
        role="timer"
        aria-label={mine ? `Aapke paas ${secs} second` : `${who} ke paas ${secs} second`}
        className="mt-2.5 h-2 overflow-hidden rounded-full border-[1.5px]"
        style={{ borderColor: mine ? ON_INK[seat.color] : INK }}
      >
        <div
          className="h-full"
          style={{
            width: `${(left / TURN_MS) * 100}%`,
            background: urgent ? "var(--vermilion)" : mine ? ON_INK[seat.color] : INK_OF[seat.color],
            transition: "width 0.25s linear",
          }}
        />
      </div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Seats                                                                */
/* ------------------------------------------------------------------ */

export function Seats({ view, players, meId }: { view: Pub; players: Player[]; meId: string }) {
  return (
    <ul className="grid grid-cols-2 gap-2" aria-label="Khiladi">
      {view.seats.map((s, i) => {
        const p = players.find((x) => x.id === s.playerId);
        const home = view.tokens[s.color]!.filter((t) => t >= HOME).length;
        const place = view.finished.indexOf(s.playerId);
        const turn = i === view.turn && view.phase !== "over";
        return (
          <li
            key={s.color}
            className={`flex min-h-12 items-center gap-2 rounded-cut border-[1.5px] bg-paper px-2 py-1.5 ${turn ? "border-ink shadow-[2px_2px_0_0_var(--ink)]" : "border-ink/15"} ${p?.connected === false ? "opacity-45" : ""}`}
          >
            <span className="h-4 w-4 shrink-0 rounded-full border-[1.5px] border-ink" style={{ background: INK_OF[s.color] }} aria-label={COLOR_NAME[s.color]} />
            <Sticker id={p?.avatar} size={26} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-p-body font-bold leading-tight">{s.playerId === meId ? "Aap" : nameOf(players, s.playerId)}</span>
              <span className="flex items-center gap-0.5" aria-label={`${home} of 4 ghar`}>
                {[0, 1, 2, 3].map((k) => (
                  <span key={k} className="h-1.5 w-3 rounded-full border border-ink/40" style={{ background: k < home ? INK_OF[s.color] : "transparent" }} />
                ))}
              </span>
            </span>
            {place >= 0 && <span className="font-display shrink-0 text-p-body font-extrabold">#{place + 1}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Game over                                                            */
/* ------------------------------------------------------------------ */

export function Podium({ view, players, meId }: { view: Pub; players: Player[]; meId: string }) {
  const order = view.finished;
  const top = [order[1], order[0], order[2]];
  const heights = [72, 104, 52];
  const delays = [0.35, 0.7, 0];
  const iWon = order[0] === meId;
  return (
    <motion.section {...screenIn} aria-label="Game over" className="cut rounded-soft bg-paper p-4 text-center">
      <div className="text-p-note font-bold uppercase tracking-[0.16em] text-muted">Yatra poori</div>
      <h2 className="mt-0.5 text-p-title font-extrabold">{iWon ? "Wah! Aap jeet gaye!" : `${nameOf(players, order[0])} jeet gaye!`}</h2>
      <div className="mt-5 flex items-end justify-center gap-2">
        {top.map((id, i) => {
          if (!id) return <div key={i} className="w-24" />;
          const seat = view.seats.find((s) => s.playerId === id);
          const p = players.find((x) => x.id === id);
          return (
            <motion.div
              key={id}
              className="flex w-24 flex-col items-center"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0, transition: { delay: delays[i], ...spring.settle } }}
            >
              {i === 1 && <Crown className="mb-1 h-6 w-6" style={{ color: "var(--turmeric-ink)" }} />}
              <Sticker id={p?.avatar} size={i === 1 ? 52 : 42} />
              <div className="mt-1 max-w-full truncate text-p-body font-bold">{id === meId ? "Aap" : nameOf(players, id)}</div>
              <div
                className="cut mt-1 flex w-full items-start justify-center rounded-t-cut pt-1.5 font-display text-p-title font-extrabold"
                style={{ height: heights[i], background: seat ? INK_OF[seat.color] : PAPER, color: seat ? ON_INK[seat.color] : INK }}
              >
                {i === 1 ? 1 : i === 0 ? 2 : 3}
              </div>
            </motion.div>
          );
        })}
      </div>
      {order.length > 3 && (
        <ul className="mt-3 border-t-[1.5px] border-ink/15 pt-2 text-left">
          {order.slice(3).map((id, k) => (
            <li key={id} className="flex min-h-11 items-center gap-2 text-p-body">
              <span className="font-display w-6 font-extrabold text-muted">{k + 4}</span>
              <Sticker id={players.find((x) => x.id === id)?.avatar} size={26} />
              <span className="font-semibold">{id === meId ? "Aap" : nameOf(players, id)}</span>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Host: skip (two taps)                                                */
/* ------------------------------------------------------------------ */

function SkipButton({ onSkip }: { onSkip: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <PaperButton
      tone={armed ? "vermilion" : "paper"}
      className="w-full"
      onClick={() => {
        if (armed) {
          setArmed(false);
          onSkip();
        } else setArmed(true);
      }}
    >
      <SkipForward className="h-4 w-4" strokeWidth={2.4} /> {armed ? "Pakka? Dobara tap karo" : "Baari skip karo"}
    </PaperButton>
  );
}

/* ------------------------------------------------------------------ */
/* The phone view                                                       */
/* ------------------------------------------------------------------ */

export function Phone({ view, me, players, send, now, isHost, hostAct }: PhoneProps<Pub, undefined>) {
  const sfx = useSfx();
  // Arriving from a scrolled lobby: start at the top so the turn banner is visible.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  const seat = view.seats.find((s) => s.playerId === me.id);
  const current = view.seats[view.turn];
  const myTurn = !!seat && current?.playerId === me.id && view.phase !== "over";
  const myPlace = view.finished.indexOf(me.id);
  const myTokens = seat ? view.tokens[seat.color]! : [];
  const pickable = myTurn && view.phase === "move" ? view.movable : [];

  // One button per distinct square (pieces stacked on one square move the same way).
  const choices = pickable.filter((i, k, arr) => arr.findIndex((j) => myTokens[j] === myTokens[i]) === k);

  // Sounds and haptics.
  const turnKey = myTurn && view.phase === "roll" ? `${view.turn}-${view.phaseStartedAt}` : "";
  useOnChange(turnKey, (k) => {
    if (k) sfx.mine("turn", [60, 40, 60]);
  });
  useOnChange(view.rollId, () => {
    if (current?.playerId === me.id) sfx.mine("pop", 30);
    else sfx.shared("pop");
  });
  const secs = Math.ceil(Math.max(0, (view.phaseStartedAt ?? view.turnStartedAt) + TURN_MS - now) / 1000);
  useOnChange(secs, (s) => {
    if (myTurn && s >= 1 && s <= 5) sfx.mine("tick");
  });
  useOnChange(view.note?.at ?? 0, () => {
    const n = view.note;
    if (!n) return;
    const capturedMe = n.kind === "capture" && seat && view.lastMove?.captured.some((c) => c.color === seat.color);
    if (capturedMe) sfx.mine("buzz", [200]);
    else if (n.playerId === me.id && (n.kind === "capture" || n.kind === "home")) sfx.mine("ding", [50]);
    else if (n.kind === "finish") {
      if (n.playerId === me.id) {
        sfx.mine("fanfare", [80, 40, 120]);
        celebrate([INK_OF[seat?.color ?? "yellow"], "#f2b632", "#fffdf8", "#c23a22"]);
      } else sfx.shared("fanfare");
    }
  });
  useOnChange(view.phase, (p) => {
    if (p === "over" && view.finished[0] === me.id) celebrate([INK_OF[seat?.color ?? "yellow"], "#f2b632", "#fffdf8"]);
  });

  const note = view.note && now - view.note.at < 5000 ? view.note : null;

  const moveSection = (
          <section aria-label="Aapki chaal" className="cut rounded-soft bg-paper p-3">
            {view.phase === "roll" ? (
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => send("roll")} aria-label="Dice ghumao" className="press rounded-soft">
                  <PaperDice value={view.dice} rollId={view.rollId} />
                </button>
                <div className="min-w-0 flex-1">
                  <PaperButton size="lg" className="w-full" onClick={() => send("roll")}>
                    <Dices className="h-5 w-5" strokeWidth={2.4} /> Dice ghumao
                  </PaperButton>
                  <p className="mt-1.5 text-p-note text-muted">6 aaye to goti bahar nikalti hai.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <PaperDice value={view.dice} rollId={view.rollId} size={64} />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-p-body font-semibold">Kaunsi goti chalaoge?</p>
                  {choices.map((i) => (
                    <PaperButton key={i} tone="turmeric" size="lg" className="w-full !justify-start !gap-3 !px-3 text-left" onClick={() => send("move", i)}>
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-ink font-display text-p-lead font-extrabold shadow-[1.5px_1.5px_0_0_var(--ink)]"
                        style={{ background: INK_OF[seat!.color], color: ON_INK[seat!.color] }}
                        aria-hidden
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block">Goti {i + 1}</span>
                        <span className="block text-p-note font-semibold opacity-80">
                          {myTokens[i] === YARD ? "Yard se bahar nikalo" : `${placeLabel(myTokens[i])} → ${placeLabel(landing(myTokens[i], view.dice ?? 0))}`}
                        </span>
                      </span>
                    </PaperButton>
                  ))}
                </div>
              </div>
            )}
          </section>
  );

  return (
    <MotionConfig reducedMotion="user">
      <InkDefs />
      <div className="space-y-3">
        <div className="sr-only" aria-live="polite">
          {note?.text ?? ""}
        </div>

        {view.phase === "over" ? <Podium view={view} players={players} meId={me.id} /> : <TurnBanner view={view} players={players} meId={me.id} now={now} />}

        {!seat && (
          <p className="rounded-cut border-[1.5px] border-ink/15 bg-paper px-3 py-2 text-p-body text-muted">
            Ludo 2–4 khiladiyon ke liye hai. Aap dekh rahe ho — agla game aapka!
          </p>
        )}
        {seat && myPlace >= 0 && view.phase !== "over" && (
          <p className="cut rounded-cut bg-leaf px-3 py-2 text-p-body font-bold text-paper">Shabash! Aap #{myPlace + 1} pe finish — baaki ko cheer karo.</p>
        )}

        {myTurn && view.phase === "move" && moveSection}

        <div className="cut overflow-hidden rounded-soft bg-paper p-1.5">
          <PaperBoard view={view} players={players} meId={me.id} pickable={pickable} onPick={(i) => send("move", i)} now={now} />
        </div>

        <div aria-live="polite" className="min-h-0">
          <AnimatePresence>
            {note && (
              <motion.div
                key={note.at}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0, transition: spring.select }}
                exit={{ opacity: 0, transition: { duration: dur.screenExit, ease: ease.in } }}
                className={`rounded-cut border-[1.5px] px-3 py-2 text-p-body font-semibold ${
                  note.kind === "capture" || note.kind === "finish" || note.kind === "home" ? "border-ink bg-paper shadow-[2px_2px_0_0_var(--ink)]" : "border-ink/15 text-muted"
                }`}
              >
                {note.auto && <b className="text-vermilion">Time up! </b>}
                {note.text}
                {note.again && <span className="font-bold text-ink"> · phir se dice!</span>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Your move: roll here; choosing a piece sits above the board */}
        {myTurn && view.phase === "roll" && moveSection}

        {/* Not your turn: the dice everyone is watching */}
        {!myTurn && view.phase !== "over" && (
          <div className="flex items-center gap-3 rounded-cut border-[1.5px] border-ink/15 bg-paper px-3 py-2">
            <PaperDice value={view.dice} rollId={view.rollId} size={48} />
            <p className="text-p-body text-muted">
              {seat ? (myPlace >= 0 ? "Aap finish kar chuke ho." : "Apni baari ka intezaar karo — baari aate hi phone bajega.") : "Dekhte raho!"}
            </p>
          </div>
        )}

        <Seats view={view} players={players} meId={me.id} />

        {isHost && view.phase !== "over" && (
          <section className="border-t-[1.5px] border-dashed border-ink/25 pt-3">
            <div className="mb-2 text-p-note font-bold uppercase tracking-[0.16em] text-muted">Host ke controls</div>
            <SkipButton onSkip={() => hostAct("skip")} />
          </section>
        )}
      </div>
    </MotionConfig>
  );
}
