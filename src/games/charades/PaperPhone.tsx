"use client";
import { Check, Hand, RefreshCw, SkipForward, Timer, UserRoundCog, Users, WifiOff } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { dur, ease, screenIn, spring } from "@/components/paper/motion";
import { InkDefs, VerdictSlip } from "@/components/paper/objects";
import { PaperButton, Sticker, tornClip } from "@/components/paper/Paper";
import { celebrate } from "@/lib/celebrate";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import type { PhoneProps, Player } from "@/lib/types";
import { AWAY_MS, TEAM_NAMES, type Priv, type Pub, type Team } from "./index";

const HINT_KEY = "bacchaparty-charades-peeked";
const INK = "#1e1a17";
/** Chit paper (the game's colour) and the two team papers. */
const CHIT = "#3e8e5a";
const TEAM_PAPER: Record<Team, string> = { A: "#f2b632", B: "#ec7a3c" };
const TEAM_SHORT: Record<Team, string> = { A: "Laddoo", B: "Jalebi" };

function fmt(secs: number) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

function wordsOf(movie: string) {
  return movie.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                         */
/* ------------------------------------------------------------------ */

/** Counts up from the start of the turn. No countdown in Charades — take your time. */
function StopwatchTag({ since, now }: { since: number | null; now: number }) {
  const secs = since ? Math.max(0, Math.floor((now - since) / 1000)) : 0;
  return (
    <div
      className="cut flex h-11 items-center gap-2 rounded-cut bg-paper pl-2.5 pr-3 text-ink"
      style={{ transform: "rotate(1.2deg)" }}
      aria-label={since ? `Acting for ${Math.floor(secs / 60)} minutes ${secs % 60} seconds` : "Turn not started"}
    >
      <Timer className="h-4 w-4" strokeWidth={2.4} />
      <span className="font-display text-p-lead font-bold tabular-nums">{since ? fmt(secs) : "0:00"}</span>
    </div>
  );
}

/** Two paper team cards with score and members. The team acting now sits tilted with a tag. */
function TeamCards({ view, players, me }: { view: Pub; players: Player[]; me: Player }) {
  return (
    <div className="grid grid-cols-2 gap-3" aria-label="Teams and scores">
      {(["A", "B"] as Team[]).map((t, i) => {
        const active = view.turnTeam === t;
        const mine = view.teams[t].includes(me.id);
        const members = view.teams[t].map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
        return (
          <motion.div
            key={t}
            animate={{ rotate: active ? (i ? 1.5 : -1.5) : 0, y: active ? -2 : 0 }}
            transition={spring.select}
            className={`relative rounded-cut px-3 pb-2.5 pt-2 text-ink ${active ? "cut" : "border-[1.5px] border-ink/25"}`}
            style={{ background: active ? TEAM_PAPER[t] : `color-mix(in srgb, ${TEAM_PAPER[t]} 28%, var(--paper))` }}
          >
            {active && (
              <span className="absolute -top-2.5 right-2 rounded-cut bg-ink px-1.5 py-0.5 text-p-note font-bold leading-none text-bg" style={{ transform: "rotate(4deg)" }}>
                Abhi baari
              </span>
            )}
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0 leading-tight">
                <div className="text-p-note font-bold uppercase tracking-[0.14em] text-ink/70">Team</div>
                <div className="truncate font-display text-p-lead font-extrabold">{TEAM_SHORT[t]}</div>
                <div className="text-p-note font-semibold text-ink/75">{mine ? "Aapki team" : `${members.length} log`}</div>
              </div>
              <motion.span
                key={view.scores[t]}
                initial={{ scale: 1.5 }}
                animate={{ scale: 1 }}
                transition={spring.settle}
                className="font-display text-p-show font-extrabold leading-none tabular-nums"
                aria-label={`${view.scores[t]} points`}
              >
                {view.scores[t]}
              </motion.span>
            </div>
            <div className="mt-2 flex -space-x-2">
              {members.slice(0, 6).map((p) => (
                <span key={p.id} className={`${p.connected ? "" : "opacity-40"} ${p.id === view.actorId ? "relative z-10 -translate-y-1" : ""}`} title={p.name}>
                  <Sticker id={p.avatar} size={28} />
                </span>
              ))}
              {members.length > 6 && <span className="flex h-7 items-center pl-3 text-p-note font-bold">+{members.length - 6}</span>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/** A leaf-green bowl with folded chits peeking out. Decorative. */
function Bowl({ size = 168, wobble = false }: { size?: number; wobble?: boolean }) {
  const chits = [
    [62, 28, -18],
    [86, 18, 8],
    [110, 26, -6],
    [132, 32, 20],
    [96, 34, -26],
  ];
  return (
    <motion.svg
      viewBox="0 0 200 120"
      width={size}
      height={(size * 120) / 200}
      aria-hidden
      animate={wobble ? { rotate: [0, -2, 2, -1, 0] } : undefined}
      transition={wobble ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      {chits.map(([x, y, r], i) => (
        <g key={i} transform={`rotate(${r} ${x + 12} ${y + 9})`}>
          <rect x={x} y={y} width="26" height="18" fill="#fffdf8" stroke={INK} strokeWidth="1.5" />
          <path d={`M${x + 13} ${y} v18`} stroke={INK} strokeWidth="1" opacity=".35" />
        </g>
      ))}
      <path d="M14 50 Q100 140 186 50 Z" fill={CHIT} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="100" cy="50" rx="86" ry="10" fill="#2f6f47" stroke={INK} strokeWidth="2" />
      <path d="M40 74 Q100 102 160 74" stroke="#fffdf8" strokeOpacity=".35" strokeWidth="3" fill="none" strokeLinecap="round" />
    </motion.svg>
  );
}

/** Two-tap confirm for host actions that change the turn (no browser dialogs). */
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

/* ------------------------------------------------------------------ */
/* The actor's chit (press and hold)                                    */
/* ------------------------------------------------------------------ */

function Chit({ movie, leaving, onPeek }: { movie: string; leaving: "got" | "pass" | null; onPeek: () => void }) {
  const [held, setHeld] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const open = (held || pinned) && !leaving;
  const words = useMemo(() => wordsOf(movie), [movie]);
  const clip = useMemo(() => tornClip(movie.length * 31 + 7, { top: true }, 4), [movie]);

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

  const away =
    leaving === "got"
      ? { scale: 0.12, rotate: -40, opacity: 0, transition: { duration: 0.32, ease: ease.in } }
      : leaving === "pass"
        ? { y: 140, rotate: 10, opacity: 0, transition: { duration: 0.3, ease: ease.in } }
        : { scale: 1, rotate: -1, y: 0, opacity: 1 };

  return (
    <div>
      <motion.div initial={{ y: -40, opacity: 0, rotate: -6 }} animate={away} transition={spring.settle}>
        <button
          type="button"
          aria-label="Your movie chit. Press and hold to unfold it."
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
          <div className="relative min-h-[13.5rem]">
            {/* Folded */}
            <motion.div
              className="cut absolute inset-0 overflow-hidden rounded-cut"
              style={{ background: CHIT, transformOrigin: "50% 0%" }}
              animate={open ? { scaleY: 0.08, opacity: 0 } : { scaleY: 1, opacity: 1 }}
              transition={{ duration: open ? 0.22 : 0.26, ease: open ? ease.in : ease.out }}
            >
              <div className="absolute inset-x-0 top-[24%] h-px bg-ink/30" />
              <div className="absolute inset-x-0 top-[24%] mt-px h-2 bg-gradient-to-b from-ink/10 to-transparent" />
              <div className="absolute inset-x-0 top-[76%] h-px bg-ink/30" />
              <div className="absolute inset-x-0 top-[76%] mt-px h-2 bg-gradient-to-b from-ink/10 to-transparent" />
              <div className="absolute right-0 top-0 h-12 w-12" style={{ background: "linear-gradient(225deg, var(--bg) 50%, #2f6f47 50%)" }} />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-paper">
                <span className="rounded-cut border-[1.5px] border-paper/80 px-2 py-0.5 text-p-note font-bold uppercase tracking-[0.18em]">Movie ki chit</span>
                <span className="flex items-center gap-1.5 font-display text-p-lead font-extrabold">
                  <Hand className="h-5 w-5" strokeWidth={2.4} /> Dabaake kholo
                </span>
              </div>
            </motion.div>
            {/* Unfolded */}
            <motion.div
              className="cut-drop absolute inset-0"
              style={{ transformOrigin: "50% 0%" }}
              initial={false}
              animate={open ? { scaleY: 1, opacity: 1 } : { scaleY: 0.6, opacity: 0 }}
              transition={{ duration: open ? 0.3 : 0.18, ease: open ? ease.out : ease.in }}
              aria-hidden={!open}
            >
              <div className="paper-rule flex h-full flex-col items-center justify-center border-x-[1.5px] border-b-[1.5px] border-ink bg-paper px-4 py-5 text-center" style={{ clipPath: clip }}>
                <div className="text-p-note font-semibold uppercase tracking-[0.16em] text-muted">Act karo — no talking!</div>
                <div className="mt-1 font-display text-p-title font-extrabold leading-tight text-balance">{movie}</div>
                <div className="mt-3 flex flex-wrap items-end justify-center gap-x-2.5 gap-y-1.5" aria-label={`${words.length} words`}>
                  {words.map((w, i) => (
                    <span key={i} className="flex flex-col items-center gap-0.5">
                      <span className="block h-[3px] rounded-full bg-ink" style={{ width: Math.min(84, 10 + w.length * 7) }} />
                      <span className="text-[0.6875rem] font-bold leading-none text-muted">{w.length}</span>
                    </span>
                  ))}
                </div>
                <div className="mt-2 text-p-note font-bold text-turmeric-ink">
                  {words.length} {words.length === 1 ? "word" : "words"} — show with your fingers
                </div>
              </div>
            </motion.div>
          </div>
        </button>
      </motion.div>
      <div className="mt-2 flex min-h-11 items-center justify-between gap-3">
        {showHint ? (
          <div className="leading-tight">
            <div className="font-display text-p-body font-bold text-vermilion">Pehle screen chhupao!</div>
            <div className="text-p-note font-medium text-ink/80">Then press &amp; hold the chit.</div>
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
/* Screens                                                              */
/* ------------------------------------------------------------------ */

function ActorReady({ onStart }: { onStart: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="cut rounded-soft bg-paper px-4 pb-5 pt-4 text-center">
      <div className="text-p-note font-bold uppercase tracking-[0.18em] text-turmeric-ink">Aapki baari!</div>
      <h2 className="mt-1 font-display text-p-title font-extrabold">You’re acting this turn</h2>
      <div className="mt-3 flex justify-center">
        <Bowl wobble />
      </div>
      <p className="mt-2 text-p-body text-muted">Hide your screen from everyone, then pull a chit. Only you will see the movie.</p>
      <PaperButton
        size="lg"
        className="mt-4 w-full"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          onStart();
        }}
      >
        Bowl se chit nikalo
      </PaperButton>
    </div>
  );
}

function ActorActing({ view, priv, now, send, onPeek }: { view: Pub; priv: Priv | undefined; now: number; send: (t: string) => void; onPeek: () => void }) {
  const [leaving, setLeaving] = useState<"got" | "pass" | null>(null);
  useOnChange(priv?.movie, () => setLeaving(null));
  const act = (kind: "got" | "pass") => {
    if (leaving) return;
    setLeaving(kind);
    setTimeout(() => send(kind), 300);
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="leading-tight">
          <div className="text-p-note font-bold uppercase tracking-[0.18em] text-turmeric-ink">Aap act kar rahe ho</div>
          <div className="text-p-body text-muted">{view.passes > 0 ? `${view.passes} pass${view.passes > 1 ? "es" : ""} so far` : "Your team guesses out loud"}</div>
        </div>
        <StopwatchTag since={view.turnStart} now={now} />
      </div>
      {priv?.movie ? (
        <Chit key={priv.movie} movie={priv.movie} leaving={leaving} onPeek={onPeek} />
      ) : (
        <div className="flex min-h-[13.5rem] flex-col items-center justify-center gap-2 rounded-cut border-[1.5px] border-dashed border-ink/30">
          <Bowl size={120} wobble />
          <span className="text-p-body font-semibold text-muted">Chit aa rahi hai…</span>
        </div>
      )}
      <div className="grid grid-cols-[1.4fr_1fr] gap-3">
        <PaperButton size="lg" className="w-full !bg-leaf !text-paper" disabled={!!leaving || !priv?.movie} onClick={() => act("got")}>
          <Check className="h-5 w-5" strokeWidth={3} /> Got it!
        </PaperButton>
        <PaperButton size="lg" tone="paper" className="w-full" disabled={!!leaving || !priv?.movie} onClick={() => act("pass")}>
          <RefreshCw className="h-5 w-5" strokeWidth={2.4} /> Pass
        </PaperButton>
      </div>
      <p className="text-center text-p-note text-muted">Fingers for words · tug your ear for “sounds like” · bilkul chup!</p>
    </div>
  );
}

function Watching({ view, players, me, now }: { view: Pub; players: Player[]; me: Player; now: number }) {
  const actor = players.find((p) => p.id === view.actorId) ?? null;
  const teamName = TEAM_NAMES[view.turnTeam];
  const myTeam: Team | null = view.teams.A.includes(me.id) ? "A" : view.teams.B.includes(me.id) ? "B" : null;
  const guessers = view.teams[view.turnTeam].filter((id) => id !== view.actorId && players.some((p) => p.id === id && p.connected));
  const everyone = guessers.length === 0;
  const mineTurn = myTeam === view.turnTeam;
  const awayLeft = view.actorAwaySince ? Math.max(0, Math.ceil((view.actorAwaySince + AWAY_MS - now) / 1000)) : null;

  if (!actor) {
    return (
      <div className="cut rounded-soft bg-paper px-4 py-6 text-center">
        <Users className="mx-auto h-8 w-8 text-muted" />
        <h2 className="mt-2 font-display text-p-title font-extrabold">{teamName} mein koi nahi</h2>
        <p className="mt-1 text-p-body text-muted">No one from {teamName} is here right now. The host can hand the turn to the other team.</p>
      </div>
    );
  }

  const [headline, sub] =
    view.phase === "ready"
      ? [`${actor.name} chit nikaal rahe hain…`, mineTurn ? "Get ready to guess!" : `${teamName} is about to act.`]
      : everyone
        ? ["Sab guess karo!", `${actor.name} is acting — anyone can shout the answer.`]
        : mineTurn
          ? ["Aapki team ki baari!", `Bolo bolo — what is ${actor.name} acting? Shout your guesses!`]
          : [`${TEAM_SHORT[view.turnTeam]} ki baari`, `${actor.name} is acting. Chup chaap dekho — no hints!`];

  return (
    <div className="cut relative overflow-hidden rounded-soft bg-paper px-4 pb-5 pt-4 text-center">
      <div className="absolute inset-x-0 top-0 h-2" style={{ background: TEAM_PAPER[view.turnTeam] }} aria-hidden />
      <div className="mt-1 flex justify-center">
        <motion.span animate={view.phase === "acting" ? { y: [0, -6, 0], rotate: [0, -3, 3, 0] } : { y: 0 }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
          <Sticker id={actor.avatar} size={92} tilt={-4} />
        </motion.span>
      </div>
      <h2 className="mt-3 font-display text-p-title font-extrabold text-balance">{headline}</h2>
      <p className="mt-1 text-p-lead text-ink/80 text-balance">{sub}</p>
      {view.phase === "ready" && (
        <div className="mt-2 flex justify-center">
          <Bowl size={120} wobble />
        </div>
      )}
      {view.phase === "acting" && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <StopwatchTag since={view.turnStart} now={now} />
          {view.passes > 0 && <span className="text-p-body font-semibold text-muted">{view.passes} pass{view.passes > 1 ? "es" : ""}</span>}
        </div>
      )}
      {awayLeft !== null && (
        <div role="status" className="mt-4 flex items-center justify-center gap-2 rounded-cut border-[1.5px] border-vermilion/50 px-3 py-2 text-p-body font-semibold text-vermilion">
          <WifiOff className="h-4 w-4 shrink-0" /> {actor.name} ka phone offline hai — next actor in {awayLeft}s
        </div>
      )}
    </div>
  );
}

/** What just happened: a stamped slip when a team gets it, a quiet note otherwise. */
function ResultNote({ view, now }: { view: Pub; now: number }) {
  const r = view.lastResult;
  const visible = !!r && now - r.at < 6000;
  return (
    <AnimatePresence>
      {visible && r && (
        <motion.div
          key={r.at}
          className="flex flex-col items-center gap-1 text-center"
          initial={{ opacity: 0, scale: 1.3 }}
          animate={{ opacity: 1, scale: 1, transition: spring.settle }}
          exit={{ opacity: 0, transition: { duration: dur.screenExit, ease: ease.in } }}
        >
          {r.kind === "got" ? (
            <>
              <VerdictSlip tone="leaf" seed={r.at % 97} tilt={r.team === "A" ? -3 : 3}>
                Pakad liya!
              </VerdictSlip>
              <p className="mt-1 text-p-body font-semibold">
                {TEAM_NAMES[r.team]} · “{r.movie}” · +1
              </p>
            </>
          ) : (
            <p className="rounded-cut border-[1.5px] border-ink/20 bg-paper px-3 py-2 text-p-body font-semibold text-ink/80">
              {r.kind === "pass" ? "Pass — chit wapas bowl mein" : r.kind === "reveal" ? `Turn over — the movie was “${r.movie}”` : r.text}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Phone view                                                           */
/* ------------------------------------------------------------------ */

export function Phone({ view, priv, me, players, send, now, isHost, hostAct }: PhoneProps<Pub, Priv>) {
  const { shared, mine } = useSfx();
  const isActor = view.actorId === me.id;
  const myTeam: Team | null = view.teams.A.includes(me.id) ? "A" : view.teams.B.includes(me.id) ? "B" : null;

  useOnChange(view.actorId, (id) => {
    if (id === me.id) mine("turn", [60, 40, 60]);
  });
  useOnChange(view.lastResult?.at ?? 0, () => {
    const r = view.lastResult;
    if (!r) return;
    if (r.kind === "got") {
      if (r.team === myTeam) {
        mine("fanfare", [60, 40, 60]);
        celebrate([TEAM_PAPER[r.team], "#3e8e5a", "#1e1a17", "#fffdf8"]);
      } else shared("ding");
    } else if (r.kind === "pass") shared("whoosh");
  });

  const stage =
    isActor && view.phase === "ready" ? (
      <ActorReady onStart={() => send("start")} />
    ) : isActor && view.phase === "acting" ? (
      <ActorActing view={view} priv={priv} now={now} send={send} onPeek={() => mine("rustle", 12)} />
    ) : (
      <Watching view={view} players={players} me={me} now={now} />
    );

  const lr = view.lastResult;
  const liveText = lr ? (lr.kind === "pass" ? "Passed. The chit went back in the bowl." : lr.kind === "got" ? `${TEAM_NAMES[lr.team]} got it! Plus one.` : lr.text) : "";

  return (
    <MotionConfig reducedMotion="user">
      <InkDefs />
      <div className="relative z-10 space-y-5 text-ink">
        <div aria-live="polite" className="sr-only">
          {liveText}
        </div>
        <TeamCards view={view} players={players} me={me} />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={`${view.actorId}-${view.phase}-${isActor}`} {...screenIn}>
            {stage}
          </motion.div>
        </AnimatePresence>

        <ResultNote view={view} now={now} />

        {isHost && (
          <section aria-label="Host controls" className="border-t-[1.5px] border-dashed border-ink/25 pt-4">
            <div className="mb-2 text-p-note font-semibold uppercase tracking-[0.14em] text-muted">Host ke controls</div>
            <div className="grid grid-cols-2 gap-3">
              <PaperButton tone="paper" className="w-full" onClick={() => hostAct("skipActor")}>
                <UserRoundCog className="h-4 w-4" strokeWidth={2.4} /> Doosra actor
              </PaperButton>
              <ConfirmButton
                label="Agli team"
                confirmLabel="Pakka?"
                icon={<SkipForward className="h-4 w-4" strokeWidth={2.4} />}
                now={now}
                onConfirm={() => hostAct("nextTurn")}
              />
              {view.phase === "acting" && (
                <PaperButton tone="paper" className="col-span-2 w-full" onClick={() => hostAct("pass")}>
                  <RefreshCw className="h-4 w-4" strokeWidth={2.4} /> Skip this movie
                </PaperButton>
              )}
            </div>
          </section>
        )}

        <p className="text-center text-p-note text-muted">
          Koi timer nahi — aaram se khelo · Turn {view.turns + 1}
        </p>
      </div>
    </MotionConfig>
  );
}
