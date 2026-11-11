"use client";
import { Check, Crown, Hand, RefreshCw, ScrollText, Shield, Shuffle, SkipForward, Timer, Trophy, UserRoundCog, WifiOff } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { dur, ease, screenIn, spring, staggerDelay } from "@/components/paper/motion";
import { InkDefs, MaskGlyph, Stamp, VerdictSlip } from "@/components/paper/objects";
import { CountUp, PaperButton, PaperSheet, Sticker, tornClip } from "@/components/paper/Paper";
import { celebrate } from "@/lib/celebrate";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import { vibrate } from "@/lib/sfx";
import type { PhoneProps, Player } from "@/lib/types";
import { ROLE_INFO, type Priv, type Pub, type Role } from "./index";

const HINT_KEY = "bacchaparty-raja-peeked";
const INK = "#1e1a17";
/** The game's paper colour: the red cloth the chits are tossed on. */
const MAT = "#b3261e";
const CHIT_TILT = [-7, 5, -3, 8];

const ROLE_PAPER: Record<Role, { bg: string; fg: string }> = {
  raja: { bg: "#f2b632", fg: INK },
  mantri: { bg: "#23407a", fg: "#fffdf8" },
  chor: { bg: "#1e1a17", fg: "#fffdf8" },
  sipahi: { bg: "#2f7d4f", fg: "#fffdf8" },
};

function RoleGlyph({ role, size = 28 }: { role: Role; size?: number }) {
  if (role === "chor") return <MaskGlyph size={size * 1.15} />;
  const Icon = role === "raja" ? Crown : role === "mantri" ? ScrollText : Shield;
  return <Icon style={{ width: size, height: size }} strokeWidth={2.2} aria-hidden />;
}

const nameOf = (players: Player[], id: string | null | undefined) => players.find((p) => p.id === id)?.name ?? "Koi";

/* ------------------------------------------------------------------ */
/* Small pieces                                                         */
/* ------------------------------------------------------------------ */

function RoundBar({ round, score, onScores, right }: { round: number; score: number; onScores: () => void; right?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="font-display text-p-title font-extrabold">Round {round}</div>
        <button
          onClick={onScores}
          aria-label={`Your score: ${score}. Show all scores`}
          className="ml-1 flex h-11 items-center gap-1.5 rounded-cut border-[1.5px] border-ink/25 px-2.5 text-p-body font-bold tabular-nums"
        >
          <Trophy className="h-4 w-4 text-turmeric-ink" strokeWidth={2.4} /> {score}
        </button>
      </div>
      {right}
    </div>
  );
}

function PickTimer({ deadline, now }: { deadline: number; now: number }) {
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const urgent = left <= 5;
  return (
    <div
      role="timer"
      aria-label={`${left} seconds to pick a chit`}
      className={`cut flex h-11 items-center gap-1.5 rounded-cut px-3 ${urgent ? "bg-vermilion text-paper" : "bg-paper text-ink"}`}
      style={{ transform: "rotate(1.2deg)" }}
    >
      <Timer className="h-4 w-4" strokeWidth={2.4} />
      <span className="font-display text-p-lead font-bold tabular-nums">0:{String(left).padStart(2, "0")}</span>
    </div>
  );
}

/** Two-tap confirm for host actions (no browser dialogs on phones). */
function ConfirmButton({ label, confirmLabel, onConfirm, icon, now }: { label: string; confirmLabel: string; onConfirm: () => void; icon: ReactNode; now: number }) {
  const [armedAt, setArmedAt] = useState<number | null>(null);
  const armed = armedAt !== null && now - armedAt < 3000;
  return (
    <PaperButton
      tone={armed ? "vermilion" : "paper"}
      className="w-full"
      onClick={() => {
        if (armed) {
          setArmedAt(null);
          onConfirm();
        } else setArmedAt(now);
      }}
    >
      {icon} {armed ? confirmLabel : label}
    </PaperButton>
  );
}

function ScoreList({ players, scores, seats }: { players: Player[]; scores: Record<string, number>; seats: string[] }) {
  const rows = Object.keys(scores)
    .map((id) => ({ id, p: players.find((x) => x.id === id), s: scores[id] ?? 0 }))
    .sort((a, b) => b.s - a.s);
  return (
    <ol className="divide-y-[1.5px] divide-ink/10">
      {rows.map(({ id, p, s }, i) => (
        <li key={id} className={`flex items-center gap-3 py-2.5 ${seats.includes(id) ? "" : "opacity-55"}`}>
          <span className="w-5 text-p-body font-semibold text-muted">{i + 1}</span>
          <Sticker id={p?.avatar} size={36} />
          <span className="min-w-0 flex-1 truncate text-p-lead font-semibold">{p?.name ?? "Chale gaye"}</span>
          <span className="font-display text-p-title font-extrabold tabular-nums">{s}</span>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* The table: four folded chits on a red cloth                          */
/* ------------------------------------------------------------------ */

/** A folded paper chit: two halves, a dog-eared corner and a red wax dot. Same for every role. */
function FoldedChitArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={`block h-full w-full ${className}`} aria-hidden style={{ filter: `drop-shadow(2px 2px 0 ${INK})` }}>
      <path d="M3 4 H100 L117 21 V76 H3 Z" fill="#fffdf8" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M100 4 V21 H117" fill="#efe4cf" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M60 5 V75" stroke={INK} strokeOpacity=".28" strokeWidth="1.2" />
      <path d="M61 5 V75" stroke={INK} strokeOpacity=".08" strokeWidth="5" />
      <path d="M4 40 H116" stroke={INK} strokeOpacity=".14" strokeWidth="1" />
      <circle cx="60" cy="40" r="7.5" fill={MAT} stroke={INK} strokeWidth="1.5" />
      <path d="M57 38 q3 -3 6 0 q-3 3 -6 0" fill="#fffdf8" opacity=".55" />
    </svg>
  );
}

/** The red cloth the chits are tossed on. */
function Mat({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`cut relative overflow-hidden rounded-soft ${className}`} style={{ background: MAT }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{ backgroundImage: "repeating-linear-gradient(45deg, #fffdf8 0 1px, transparent 1px 9px), repeating-linear-gradient(-45deg, #fffdf8 0 1px, transparent 1px 9px)" }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Where each chit lies on the cloth: a loose, uneven toss rather than a neat grid. */
const SCATTER = [
  { x: "4%", y: "6%", r: -9 },
  { x: "52%", y: "2%", r: 6 },
  { x: "10%", y: "52%", r: 4 },
  { x: "55%", y: "50%", r: -7 },
];

function ChitTable({ view, players, me, onPick, picking }: { view: Pub; players: Player[]; me: Player; onPick: (i: number) => void; picking: boolean }) {
  const byChit = new Map<number, string>(Object.entries(view.taken).map(([id, i]) => [i, id]));
  const mineIdx = view.taken[me.id];
  const canPick = picking && mineIdx === undefined && view.seats.includes(me.id);
  return (
    <Mat>
      <div className="relative mx-auto h-[15.5rem] max-w-[22rem]">
        {[0, 1, 2, 3].map((i) => {
          const owner = byChit.get(i);
          const ownerP = owner ? players.find((p) => p.id === owner) : null;
          const mine = owner === me.id;
          const spot = SCATTER[i];
          const free = canPick && !owner;
          return (
            <motion.button
              key={i}
              type="button"
              disabled={!free}
              onClick={() => onPick(i)}
              aria-label={owner ? `Chit ${i + 1}, taken by ${mine ? "you" : (ownerP?.name ?? "someone")}` : `Pick chit ${i + 1}`}
              className={`absolute block h-[6.25rem] w-[42%] ${free ? "cursor-pointer" : "cursor-default"}`}
              style={{ left: spot.x, top: spot.y }}
              initial={{ y: -60, opacity: 0, rotate: spot.r * 3 }}
              animate={{
                y: owner ? -6 : 0,
                opacity: owner && !mine ? 0.5 : 1,
                rotate: owner ? spot.r / 3 : spot.r,
                scale: mine ? 1.05 : 1,
                transition: { ...spring.settle, delay: staggerDelay(i, 0.05) },
              }}
              whileHover={free ? { y: -3 } : undefined}
              whileTap={free ? { scale: 0.93, transition: { duration: dur.pressDown, ease: ease.out } } : undefined}
            >
              <FoldedChitArt />
              {ownerP && (
                <span className="absolute -right-1 -top-3">
                  <Sticker id={ownerP.avatar} size={36} tilt={6} />
                </span>
              )}
              {mine && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-cut bg-ink px-2 py-0.5 text-p-note font-bold leading-none text-bg">Aapki</span>}
            </motion.button>
          );
        })}
      </div>
      <div className="border-t-[1.5px] border-dashed border-paper/40 px-4 py-2.5 text-center text-p-note font-bold text-paper">
        {canPick ? "Tap a chit to pick it up" : `${Object.keys(view.taken).length}/4 chits uthayi gayi`}
      </div>
    </Mat>
  );
}

/* ------------------------------------------------------------------ */
/* Your chit (press and hold)                                           */
/* ------------------------------------------------------------------ */

function RoleChit({ role, round, onPeek }: { role: Role; round: number; onPeek: () => void }) {
  const [held, setHeld] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const open = held || pinned;
  const clip = useMemo(() => tornClip(round * 17 + 5, { top: true }, 4), [round]);
  const info = ROLE_INFO[role];
  const paper = ROLE_PAPER[role];

  useEffect(() => {
    try {
      setShowHint(!localStorage.getItem(HINT_KEY));
    } catch {
      setShowHint(true);
    }
  }, []);
  useOnChange(open, (o) => {
    if (!o) return;
    onPeek();
    if (showHint) {
      setShowHint(false);
      try {
        localStorage.setItem(HINT_KEY, "1");
      } catch {}
    }
  });
  useEffect(() => {
    if (!pinned) return;
    const t = setTimeout(() => setPinned(false), 5000);
    return () => clearTimeout(t);
  }, [pinned]);

  return (
    <div>
      <button
        type="button"
        aria-label="Your chit. Press and hold to unfold it."
        className="no-callout relative block w-full rounded-cut text-left"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setHeld(true);
        }}
        onPointerUp={() => setHeld(false)}
        onPointerCancel={() => setHeld(false)}
        onLostPointerCapture={() => setHeld(false)}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) setHeld(true);
        }}
        onKeyUp={() => setHeld(false)}
        onBlur={() => setHeld(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="relative h-[11.5rem]">
          {/* Folded: identical for every role */}
          <motion.div
            className="absolute inset-0"
            animate={open ? { opacity: 0 } : { opacity: 1 }}
            transition={{ duration: open ? 0.22 : 0.26, ease: open ? ease.in : ease.out }}
          >
            <Mat className="h-full">
              <div className="flex h-[11.5rem] flex-col items-center justify-center gap-2.5 px-4">
                <motion.div
                  className="h-[6.5rem] w-[10rem]"
                  animate={open ? { scaleX: 0.1, rotate: 0 } : { scaleX: 1, rotate: -4 }}
                  transition={{ duration: open ? 0.22 : 0.3, ease: open ? ease.in : ease.out }}
                >
                  <FoldedChitArt />
                </motion.div>
                <span className="flex items-center gap-1.5 rounded-cut bg-paper px-2.5 py-0.5 font-display text-p-body font-extrabold text-ink">
                  <Hand className="h-4 w-4" strokeWidth={2.4} /> Aapki chit · dabaake kholo
                </span>
              </div>
            </Mat>
          </motion.div>
          {/* Unfolded: same size and timing for every role, so the motion gives nothing away */}
          <motion.div
            className="cut-drop absolute inset-0"
            initial={false}
            animate={open ? { scaleX: 1, opacity: 1 } : { scaleX: 0.5, opacity: 0 }}
            transition={{ duration: open ? 0.3 : 0.18, ease: open ? ease.out : ease.in }}
            aria-hidden={!open}
          >
            <div className="flex h-full flex-col items-center justify-center border-x-[1.5px] border-b-[1.5px] border-ink bg-paper px-4 py-4 text-center" style={{ clipPath: clip }}>
              <div className="text-p-note font-semibold uppercase tracking-[0.16em] text-muted">Aap ho…</div>
              <div className="mt-1 flex items-center gap-2.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-ink" style={{ background: paper.bg, color: paper.fg }}>
                  <RoleGlyph role={role} size={22} />
                </span>
                <span className="font-display text-p-show font-extrabold uppercase leading-none">{info.label}</span>
              </div>
              <div className="mt-2 max-w-[18rem] text-p-body leading-snug text-ink/85">{info.line}</div>
            </div>
          </motion.div>
        </div>
      </button>
      <div className="mt-2 flex min-h-11 items-center justify-between gap-3">
        {showHint ? (
          <div className="leading-tight">
            <div className="font-display text-p-body font-bold text-vermilion">Pehle screen chhupao!</div>
            <div className="text-p-note font-medium text-ink/80">Then press &amp; hold your chit.</div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-p-body font-semibold">
            <Hand className="h-4 w-4" strokeWidth={2.4} /> Chhodo toh band
          </div>
        )}
        <button
          type="button"
          aria-pressed={pinned}
          aria-label={pinned ? "Close the chit" : "Can't hold? Tap to open the chit for 5 seconds"}
          onClick={() => setPinned((p) => !p)}
          className="-mr-2 flex min-h-11 items-center rounded-cut px-2 text-p-note font-semibold text-muted underline decoration-ink/30 underline-offset-4"
        >
          {pinned ? "Close it" : "Tap to open"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Seats: who's at the table, and what they're doing                    */
/* ------------------------------------------------------------------ */

function Seats({ view, players, me, status }: { view: Pub; players: Player[]; me: Player; status: (id: string) => string }) {
  return (
    <ul className="grid grid-cols-4 gap-2" aria-label="Players at the table">
      {view.seats.map((id) => {
        const p = players.find((x) => x.id === id);
        const gone = !p || !p.connected;
        return (
          <li key={id} className={`flex flex-col items-center gap-1 text-center ${gone ? "opacity-45" : ""}`}>
            <span className={id === view.rajaId ? "relative" : ""}>
              <Sticker id={p?.avatar} size={44} tilt={id === me.id ? -5 : 0} />
              {id === view.rajaId && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-turmeric-ink" aria-hidden>
                  <Crown className="h-4 w-4" strokeWidth={2.6} />
                </span>
              )}
            </span>
            <span className="w-full truncate text-p-note font-bold">{id === me.id ? "Aap" : (p?.name ?? "Chale gaye")}</span>
            <span className="w-full truncate text-[0.75rem] font-semibold leading-tight text-muted">{gone ? "offline" : status(id)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Mantri's choice                                                      */
/* ------------------------------------------------------------------ */

function MantriChoice({ suspects, players, onGuess }: { suspects: string[]; players: Player[]; onGuess: (id: string) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  return (
    <div className="space-y-3">
      <div className="text-center">
        <div className="font-display text-p-show font-extrabold">Chor kaun hai?</div>
        <p className="text-p-body text-muted">Dono ke chehre dekho. Ek chuno — sahi pakda toh 800!</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {suspects.map((id, i) => {
          const p = players.find((x) => x.id === id);
          const on = pick === id;
          return (
            <motion.button
              key={id}
              type="button"
              aria-pressed={on}
              disabled={sent}
              onClick={() => setPick(on ? null : id)}
              whileTap={{ scale: 0.96, transition: { duration: dur.pressDown, ease: ease.out } }}
              animate={{ rotate: on ? (i ? 2 : -2) : 0, backgroundColor: on ? "var(--me)" : "var(--paper)" }}
              transition={spring.select}
              className="cut flex min-h-[9.5rem] flex-col items-center justify-center gap-2 rounded-cut px-2 py-3"
            >
              <Sticker id={p?.avatar} size={64} />
              <span className="w-full truncate font-display text-p-lead font-extrabold">{p?.name ?? "?"}</span>
              <span className="text-p-note font-semibold text-ink/70">{on ? "Yahi chor hai?" : "Tap to choose"}</span>
            </motion.button>
          );
        })}
      </div>
      <PaperButton
        size="lg"
        tone="vermilion"
        className="w-full"
        disabled={!pick || sent}
        onClick={() => {
          if (!pick) return;
          setSent(true);
          onGuess(pick);
        }}
      >
        <Check className="h-5 w-5" strokeWidth={3} /> {pick ? `Haan, ${nameOf(players, pick)} hi chor hai!` : "Pehle ek chuno"}
      </PaperButton>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reveal                                                               */
/* ------------------------------------------------------------------ */

function Reveal({ view, players, me, onAgain, canDeal }: { view: Pub; players: Player[]; me: Player; onAgain: () => void; canDeal: boolean }) {
  const roles = view.roles ?? {};
  const mine = view.lastPoints[me.id];
  const order: Role[] = ["raja", "mantri", "chor", "sipahi"];
  const seats = [...view.seats].sort((a, b) => order.indexOf(roles[a]) - order.indexOf(roles[b]));
  return (
    <motion.div {...screenIn} className="space-y-5">
      <div className="flex flex-col items-center text-center">
        <motion.div initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1, transition: { ...spring.settle, delay: 0.15 } }}>
          <VerdictSlip tone={view.correct ? "leaf" : "vermilion"} seed={view.round * 11} tilt={view.correct ? -3 : 3}>
            {view.correct ? "Pakda gaya!" : "Bach nikla!"}
          </VerdictSlip>
        </motion.div>
        <p className="mt-3 text-p-lead font-semibold text-balance">
          {view.correct
            ? `${nameOf(players, view.mantriId)} ne chor pakad liya — it was ${nameOf(players, view.guess)}!`
            : `${nameOf(players, view.mantriId)} ne ${nameOf(players, view.guess)} ko pakda… galat! Chor ko 800.`}
        </p>
        {mine !== undefined && (
          <p className="mt-1 text-p-body font-bold text-leaf">
            Aapko +{mine} · total {view.scores[me.id] ?? 0}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {seats.map((id, i) => {
          const p = players.find((x) => x.id === id);
          const role = roles[id];
          if (!role) return null;
          const paper = ROLE_PAPER[role];
          return (
            <motion.div
              key={id}
              initial={{ scaleX: 0.1, opacity: 0, rotate: CHIT_TILT[i] }}
              animate={{ scaleX: 1, opacity: 1, rotate: CHIT_TILT[i] / 4, transition: { duration: dur.reveal, ease: ease.out, delay: 0.25 + staggerDelay(i) * 3 } }}
              className="cut relative rounded-cut bg-paper px-3 pb-3 pt-3 text-center"
            >
              <div className="relative flex items-center justify-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-ink" style={{ background: paper.bg, color: paper.fg }}>
                  <RoleGlyph role={role} size={18} />
                </span>
                <span className="font-display text-p-lead font-extrabold uppercase">{ROLE_INFO[role].label}</span>
              </div>
              <div className="relative mt-2 flex items-center justify-center gap-1.5">
                <Sticker id={p?.avatar} size={26} />
                <span className="min-w-0 truncate text-p-body font-bold">{id === me.id ? "Aap" : (p?.name ?? "?")}</span>
              </div>
              <div className="relative mt-1 font-display text-p-title font-extrabold text-turmeric-ink">
                +<CountUp from={0} to={view.lastPoints[id] ?? 0} delay={0.9 + i * 0.12} />
              </div>
            </motion.div>
          );
        })}
      </div>

      {canDeal && (
        <PaperButton size="lg" className="w-full" onClick={onAgain}>
          <Shuffle className="h-5 w-5" strokeWidth={2.4} /> Phir se baanto
        </PaperButton>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Phone view                                                           */
/* ------------------------------------------------------------------ */

export function Phone({ view, priv, me, players, send, now, isHost, hostAct }: PhoneProps<Pub, Priv>) {
  const { shared, mine } = useSfx();
  const [scoresOpen, setScoresOpen] = useState(false);
  const seated = view.seats.includes(me.id);
  const myRole = priv?.role ?? null;
  const pickedCount = Object.keys(view.taken).length;
  const iPicked = view.taken[me.id] !== undefined;
  const pickLeft = view.pickDeadline ? Math.max(0, Math.ceil((view.pickDeadline - now) / 1000)) : -1;
  const offline = view.seats.filter((id) => !players.some((p) => p.id === id && p.connected));
  const online = players.filter((p) => p.connected);
  const benchOnline = online.filter((p) => !view.seats.includes(p.id));

  useOnChange(pickLeft, (n) => {
    if (n > 0 && n <= 5) shared("tick");
  });
  useOnChange(view.phase, (ph) => {
    if (ph === "pick") shared("whoosh");
    if (ph === "mantri") {
      shared("reveal");
      if (view.mantriId === me.id) mine("turn", [60, 40, 60]);
    }
    if (ph === "result") {
      shared("reveal");
      vibrate([30, 60, 30]);
      const r = view.roles?.[me.id];
      const won = (r === "mantri" && view.correct) || (r === "chor" && !view.correct);
      if (won) {
        mine("fanfare", [60, 40, 60]);
        setTimeout(() => celebrate(["#b3261e", "#f2b632", "#fffdf8", "#1e1a17"]), 900);
      } else if ((r === "mantri" && !view.correct) || (r === "chor" && view.correct)) mine("buzz", [200]);
    }
  });

  const statusOf = (id: string): string => {
    if (view.phase === "pick") return view.taken[id] !== undefined ? "chit li ✓" : "\u00a0";
    if (view.phase === "raja") return "chupchaap";
    if (view.phase === "mantri") return id === view.rajaId ? "Raja" : id === view.mantriId ? "Mantri" : "shakki";
    return `+${view.lastPoints[id] ?? 0}`;
  };

  const liveText =
    view.phase === "pick"
      ? `${pickedCount} of 4 chits picked`
      : view.phase === "raja"
        ? "Everyone has a chit. Waiting for the Raja."
        : view.phase === "mantri"
          ? `${nameOf(players, view.rajaId)} is the Raja. ${nameOf(players, view.mantriId)} is the Mantri and must find the Chor.`
          : view.correct
            ? "The Chor was caught."
            : "The Chor escaped.";

  /* ---- the main stage for this phase ---- */
  let stage: ReactNode;
  if (view.phase === "result") {
    stage = <Reveal view={view} players={players} me={me} canDeal={seated || isHost} onAgain={() => (isHost && !seated ? hostAct("next") : send("next"))} />;
  } else if (!seated) {
    stage = (
      <div className="cut rounded-soft bg-paper px-4 py-5 text-center">
        <h2 className="font-display text-p-title font-extrabold">Is round mein 4 log khel rahe hain</h2>
        <p className="mt-1 text-p-body text-muted">This game is for exactly four. Dekhte raho — face-reading counts!</p>
      </div>
    );
  } else if (view.phase === "pick" && !iPicked) {
    stage = (
      <div className="space-y-3">
        <div>
          <h2 className="font-display text-p-show font-extrabold">Ek chit uthao!</h2>
          <p className="text-p-body text-muted">Raja, Mantri, Chor ya Sipahi — andar likha hai. Tap one.</p>
        </div>
        <ChitTable
          view={view}
          players={players}
          me={me}
          picking
          onPick={(i) => {
            mine("rustle", 15);
            send("pick", i);
          }}
        />
      </div>
    );
  } else if (!myRole) {
    stage = (
      <div className="flex min-h-[11.5rem] flex-col items-center justify-center gap-2 rounded-cut border-[1.5px] border-dashed border-ink/30">
        <span className="breathe inline-block h-20 w-28">
          <FoldedChitArt />
        </span>
        <span className="text-p-body font-semibold text-muted">Chit aapke haath mein aa rahi hai…</span>
      </div>
    );
  } else {
    const roleBlock = <RoleChit key={view.round} role={myRole} round={view.round} onPeek={() => mine("rustle", 12)} />;
    if (view.phase === "pick") {
      stage = (
        <div className="space-y-4">
          {roleBlock}
          <div className="rounded-cut border-[1.5px] border-ink/15 bg-paper px-3 py-2.5 text-center text-p-body font-semibold">
            Baaki log chit utha rahe hain… {pickedCount}/4
          </div>
        </div>
      );
    } else if (view.phase === "raja") {
      stage = (
        <div className="space-y-4">
          {roleBlock}
          {myRole === "raja" ? (
            <PaperButton
              size="lg"
              className="w-full"
              onClick={() => {
                mine("pop", 30);
                send("raja");
              }}
            >
              <Crown className="h-5 w-5" strokeWidth={2.4} /> Main Raja hoon!
            </PaperButton>
          ) : (
            <div className="cut rounded-cut bg-paper px-3 py-3 text-center">
              <div className="font-display text-p-lead font-extrabold">Raja ka intezaar…</div>
              <div className="text-p-body text-muted">Jiske paas Raja ki chit hai, woh bolega. Chehra seedha!</div>
            </div>
          )}
        </div>
      );
    } else {
      // mantri phase
      stage = (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-1 text-center">
            <Stamp tone="ink" className="!text-p-lead">
              {view.hostAnnounced ? "Raja: " : "Main Raja hoon!"}
              {view.hostAnnounced ? nameOf(players, view.rajaId) : ""}
            </Stamp>
            <p className="mt-1 text-p-body font-semibold">
              {view.rajaId === me.id ? "Aap Raja ho. " : `${nameOf(players, view.rajaId)} Raja hai. `}
              “Mantri {view.mantriId === me.id ? "(aap!)" : nameOf(players, view.mantriId)}, chor dhoondo!”
            </p>
          </div>
          {myRole === "mantri" ? (
            <MantriChoice suspects={view.suspects} players={players} onGuess={(id) => send("guess", id)} />
          ) : (
            <>
              <div className="cut rounded-cut bg-paper px-3 py-3 text-center">
                <div className="font-display text-p-lead font-extrabold">
                  {myRole === "raja" ? "Ab dekho Mantri kya karta hai" : "Mantri aapko dekh raha hai… chehra seedha!"}
                </div>
                <div className="mt-2 flex items-center justify-center gap-3">
                  {view.suspects.map((id) => {
                    const p = players.find((x) => x.id === id);
                    return (
                      <span key={id} className="flex flex-col items-center gap-1">
                        <Sticker id={p?.avatar} size={48} />
                        <span className="text-p-note font-bold">{id === me.id ? "Aap" : (p?.name ?? "?")}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
              {roleBlock}
            </>
          )}
        </div>
      );
    }
  }

  /* ---- someone left: never stall silently ---- */
  const needed = view.phase === "raja" ? view.seats.find((id) => offline.includes(id)) : view.phase === "mantri" ? (offline.includes(view.mantriId ?? "") ? view.mantriId : null) : null;
  const stuckPick = view.phase === "pick" && offline.some((id) => view.taken[id] === undefined);
  const showLeft = view.phase !== "result" && offline.length > 0;
  const canReseat = offline.length > 0 && benchOnline.length > 0 && online.length >= 4;

  return (
    <MotionConfig reducedMotion="user">
      <InkDefs />
      <div className="space-y-5 pb-4">
        <RoundBar
          round={view.round}
          score={view.scores[me.id] ?? 0}
          onScores={() => setScoresOpen(true)}
          right={view.phase === "pick" && view.pickDeadline ? <PickTimer deadline={view.pickDeadline} now={now} /> : undefined}
        />

        {view.phase !== "result" && <Seats view={view} players={players} me={me} status={statusOf} />}

        {showLeft && (
          <div role="status" className="flex items-start gap-2 rounded-cut border-[1.5px] border-vermilion/60 bg-paper px-3 py-2.5 text-p-body font-semibold text-vermilion">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {offline.map((id) => nameOf(players, id)).join(", ")} {offline.length > 1 ? "ke" : "ka"} phone offline hai.{" "}
              {isHost ? "Neeche se game aage badhao." : "Host game aage badha sakte hain."}
            </span>
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={`${view.round}-${view.phase}-${seated}`} {...screenIn}>
            {stage}
          </motion.div>
        </AnimatePresence>

        {isHost && view.phase !== "result" && (
          <section aria-label="Host controls" className="space-y-2 border-t-[1.5px] border-dashed border-ink/25 pt-4">
            <div className="text-p-note font-bold uppercase tracking-[0.16em] text-muted">Host ke controls</div>
            {view.phase === "pick" && (stuckPick || pickLeft <= 15) && (
              <PaperButton className="w-full" onClick={() => hostAct("assign")}>
                <SkipForward className="h-4 w-4" /> Baaki chits baanto
              </PaperButton>
            )}
            {needed && view.phase === "raja" && (
              <PaperButton className="w-full" onClick={() => hostAct("announce")}>
                <Crown className="h-4 w-4" /> Raja ki taraf se bolo
              </PaperButton>
            )}
            {canReseat && (
              <ConfirmButton label="Baithne wale badlo" confirmLabel="Tap again: seat players who are here" icon={<UserRoundCog className="h-4 w-4" />} now={now} onConfirm={() => hostAct("reseat")} />
            )}
            <ConfirmButton label="Naye sire se baanto" confirmLabel="Tap again: deal again, no points" icon={<RefreshCw className="h-4 w-4" />} now={now} onConfirm={() => hostAct("redeal")} />
            {offline.length > 0 && !canReseat && <p className="text-p-note text-muted">Not enough players to reseat. Use the home button at the top to end the game.</p>}
          </section>
        )}

        <div className="sr-only" aria-live="polite">
          {liveText}
        </div>
      </div>

      <PaperSheet open={scoresOpen} onClose={() => setScoresOpen(false)} title="Ab tak ke points">
        <ScoreList players={players} scores={view.scores} seats={view.seats} />
      </PaperSheet>
    </MotionConfig>
  );
}
