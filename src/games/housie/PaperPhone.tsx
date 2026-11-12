"use client";
import { Check, Grid3x3, Pause, Play, SkipForward, Trophy } from "lucide-react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { dur, ease, screenIn, spring, staggerDelay } from "@/components/paper/motion";
import { InkDefs, Stamp } from "@/components/paper/objects";
import { PaperButton, PaperSheet, Sticker } from "@/components/paper/Paper";
import { celebrate } from "@/lib/celebrate";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import type { PhoneProps, Player } from "@/lib/types";
import { PRIZES, prizeProgress, rowNumbers, speak, type Prize, type Ticket } from "./helpers";
import type { Priv, Pub } from "./index";

const JAMUN = "#5b2a6e";
const JAMUN_DEEP = "#43204f";
const CREAM = "#fffdf8";
const AUTO_KEY = "bacchaparty-housie-automark";
const ROW_NAMES = ["Top", "Middle", "Bottom"];

/* ------------------------------------------------------------------ */
/* The called number                                                    */
/* ------------------------------------------------------------------ */

/** A numbered token, like the ones pulled from the Housie bag. */
function Token({ n, size, className = "" }: { n: number | null; size: number; className?: string }) {
  return (
    <span
      className={`font-display inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink bg-paper font-extrabold tabular-nums text-ink ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.46, boxShadow: `inset 0 0 0 ${Math.max(2, size * 0.055)}px ${CREAM}, inset 0 0 0 ${Math.max(3, size * 0.075)}px ${JAMUN}` }}
    >
      {n ?? "?"}
    </span>
  );
}

function CallCard({ view, now, isHost, hostAct }: { view: Pub; now: number; isHost: boolean; hostAct: PhoneProps<Pub, Priv>["hostAct"] }) {
  const earlier = view.called.slice(-6, -1).reverse();
  const auto = view.autoCall > 0;
  const msLeft = view.nextCallAt ? Math.max(0, view.nextCallAt - now) : 0;
  const secs = Math.ceil(msLeft / 1000);
  const urgent = !view.paused && !!view.nextCallAt && secs <= 3;
  const first = view.called.length === 0;

  return (
    <section aria-label="Number being called" className="cut relative overflow-hidden rounded-soft" style={{ background: JAMUN, color: CREAM }}>
      <div className="flex items-center gap-4 p-4 pb-3">
        <div className="relative flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center">
          {/* The token drops in the same way for every number. */}
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={view.current ?? "none"}
              className="absolute"
              initial={{ y: -70, rotate: -24, opacity: 0 }}
              animate={{ y: 0, rotate: 0, opacity: 1, transition: spring.settle }}
              exit={{ opacity: 0, scale: 0.7, transition: { duration: dur.screenExit, ease: ease.in } }}
            >
              <Token n={view.current} size={88} className="shadow-[2px_2px_0_0_var(--ink)]" />
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-p-note font-bold uppercase tracking-[0.16em] opacity-75">{first ? "Taiyaar ho jao" : `Number ${view.called.length} of 90`}</div>
          <div className="font-display mt-0.5 text-p-lead font-extrabold leading-tight text-balance">
            {view.call ?? (auto ? "Pehla number aa raha hai…" : isHost ? "Tap “Call a number” to begin" : "Host pehla number bulayenge")}
          </div>
          {earlier.length > 0 && (
            <div className="mt-2 flex items-center gap-1">
              <span className="mr-0.5 text-p-note font-bold uppercase tracking-[0.1em] opacity-75">Pehle</span>
              {earlier.map((n, i) => (
                <motion.span key={n} layout transition={spring.select} style={{ opacity: 1 - i * 0.13 }}>
                  <Token n={n} size={25} />
                </motion.span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Countdown to the next number, for everyone. */}
      {auto && !view.done && (
        <div
          role="timer"
          aria-label={view.paused ? "Calling is paused" : `Next number in ${secs} seconds`}
          className="flex items-center gap-3 px-4 py-2.5"
          style={{ background: JAMUN_DEEP }}
        >
          <span className="shrink-0 text-p-note font-bold uppercase tracking-[0.14em]">{view.paused ? "Ruka hua hai" : first ? "Pehla number" : "Agla number"}</span>
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-black/30">
            <div
              className="h-full rounded-full"
              style={{
                width: view.paused || !view.nextCallAt ? "100%" : `${Math.min(100, (msLeft / (view.autoCall * 1000)) * 100)}%`,
                background: urgent ? "#ff8b73" : "#f2b632",
                opacity: view.paused ? 0.35 : 1,
                transition: "width 0.25s linear, background-color 0.2s",
              }}
            />
          </div>
          <span className={`font-display w-9 shrink-0 text-right text-p-lead font-extrabold tabular-nums ${urgent ? "text-[#ff8b73]" : ""}`}>
            {view.paused || !view.nextCallAt ? "–" : `${secs}s`}
          </span>
        </div>
      )}

      {isHost && !view.done && (
        <div className="flex gap-2 border-t-[1.5px] border-ink bg-bg p-3 text-ink">
          <PaperButton className="flex-1" onClick={() => hostAct("next")}>
            <SkipForward className="h-5 w-5" strokeWidth={2.4} /> {auto ? "Abhi bulao" : "Call a number"}
          </PaperButton>
          {auto && (
            <PaperButton tone="paper" aria-label={view.paused ? "Resume calling" : "Pause calling"} onClick={() => hostAct("pause")}>
              {view.paused ? <Play className="h-5 w-5" strokeWidth={2.4} /> : <Pause className="h-5 w-5" strokeWidth={2.4} />} {view.paused ? "Chalu" : "Roko"}
            </PaperButton>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The ticket                                                           */
/* ------------------------------------------------------------------ */

function Cell({ n, marked, called, locked, onTap }: { n: number; marked: boolean; called: boolean; locked: boolean; onTap: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      disabled={locked}
      onClick={onTap}
      aria-pressed={marked}
      aria-label={`${n}${marked ? ", marked" : called ? ", called" : ""}`}
      whileTap={locked ? undefined : { scale: 0.92, transition: { duration: dur.pressDown, ease: ease.out } }}
      className={`relative flex aspect-square min-h-12 items-center justify-center rounded-cut border-[1.5px] bg-paper ${called && !marked ? "border-ink" : "border-ink/25"}`}
    >
      {/* The dab: a blot of ink pressed onto the number. */}
      <AnimatePresence initial={false}>
        {marked && (
          <motion.span
            aria-hidden
            className="absolute inset-[3px] rounded-full"
            style={{ background: JAMUN }}
            initial={reduce ? { opacity: 0 } : { scale: 0.2, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1, transition: spring.select }}
            exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.12, ease: ease.in } }}
          />
        )}
      </AnimatePresence>
      <span className={`font-display relative text-[1.375rem] font-extrabold tabular-nums leading-none transition-colors duration-150 ${marked ? "text-paper" : "text-ink"}`}>{n}</span>
      {/* Called but not marked yet: a small flag in the corner. */}
      {called && !marked && <span aria-hidden className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-[1.5px] border-ink bg-turmeric" />}
    </motion.button>
  );
}

function TicketCard({
  me,
  ticket,
  marks,
  called,
  autoMark,
  hostAuto,
  onToggleAuto,
  onMark,
  shake,
}: {
  me: Player;
  ticket: Ticket;
  marks: ReadonlySet<number>;
  called: ReadonlySet<number>;
  autoMark: boolean;
  hostAuto: boolean;
  onToggleAuto: () => void;
  onMark: (n: number, wasMarked: boolean) => void;
  shake: boolean;
}) {
  return (
    <section aria-label="Your ticket" className={`cut-drop ${shake ? "shake" : ""}`}>
      <div className="perforated bg-paper">
        {/* Stub: whose ticket it is, and the auto-mark switch. */}
        <div className="flex items-center gap-3 px-5 py-2.5" style={{ background: JAMUN, color: CREAM }}>
          <Sticker id={me.avatar} size={34} tilt={-6} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="font-display truncate text-p-body font-extrabold">{me.name} ka ticket</div>
            <div className="text-p-note font-semibold opacity-80">{autoMark ? "Numbers apne aap mark honge" : "Number sunte hi tap karo"}</div>
          </div>
          <button
            role="switch"
            aria-checked={autoMark}
            aria-label="Apne aap mark karo (auto-mark)"
            disabled={hostAuto}
            onClick={onToggleAuto}
            className="flex min-h-11 shrink-0 flex-col items-center justify-center gap-0.5 disabled:opacity-70"
          >
            <span className={`relative h-6 w-11 rounded-full border-[1.5px] border-paper transition-colors duration-200 ${autoMark ? "bg-turmeric" : "bg-transparent"}`}>
              <span
                className="absolute top-[2px] h-4 w-4 rounded-full bg-paper transition-[left] duration-200"
                style={{ left: autoMark ? 22 : 3, transitionTimingFunction: "cubic-bezier(0.2,0,0,1)" }}
              />
            </span>
            <span className="text-[0.6875rem] font-bold uppercase tracking-[0.1em]">Auto</span>
          </button>
        </div>

        <div className="px-4 pb-3 pt-1">
          {[0, 1, 2].map((r) => (
            <div key={r} className={`flex items-center gap-2 py-2 ${r ? "border-t-[1.5px] border-dashed border-ink/25" : ""}`}>
              <span aria-hidden className="w-4 shrink-0 rotate-180 text-center text-[0.6875rem] font-bold uppercase leading-none tracking-[0.08em] text-muted [writing-mode:vertical-rl]">
                {ROW_NAMES[r]}
              </span>
              <div role="group" aria-label={`${ROW_NAMES[r]} line`} className="grid min-w-0 flex-1 grid-cols-5 gap-1.5">
                {rowNumbers(ticket, r).map((n) => (
                  <Cell key={n} n={n} marked={marks.has(n)} called={called.has(n)} locked={autoMark} onTap={() => onMark(n, marks.has(n))} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Claims: tear-off coupons                                             */
/* ------------------------------------------------------------------ */

function Coupon({
  prize,
  have,
  need,
  winner,
  winnerPlayer,
  mine,
  wide,
  onClaim,
}: {
  prize: (typeof PRIZES)[number];
  have: number;
  need: number;
  winner: { playerId: string; name: string } | undefined;
  winnerPlayer: Player | undefined;
  mine: boolean;
  wide: boolean;
  onClaim: () => void;
}) {
  const ready = !winner && have >= need;
  return (
    <motion.button
      disabled={!!winner}
      onClick={onClaim}
      aria-label={winner ? `${prize.label}: won by ${mine ? "you" : winner.name}` : `Claim ${prize.label}. You have ${have} of ${need}${ready ? ", ready to claim" : ", not ready yet"}`}
      whileTap={winner ? undefined : { scale: 0.96, x: 1, y: 1, transition: { duration: dur.pressDown, ease: ease.out } }}
      animate={{ backgroundColor: winner ? "var(--bg-2)" : ready ? "#f2b632" : "var(--paper)" }}
      transition={{ duration: dur.select, ease: ease.out }}
      className={`relative flex h-[5.25rem] items-stretch overflow-hidden rounded-cut border-[1.5px] text-left ${wide ? "col-span-2" : ""} ${
        winner ? "border-ink/25" : ready ? "border-ink shadow-[2px_2px_0_0_var(--ink)]" : "border-ink/35"
      }`}
    >
      {/* Stub with the points, split off by a tear line. Once won, it carries the seal. */}
      <span className="flex w-11 shrink-0 flex-col items-center justify-center border-r-[1.5px] border-dashed border-ink/40 leading-none">
        {winner ? (
          <span
            aria-hidden
            className="flex h-9 w-9 -rotate-12 items-center justify-center rounded-full border-[2.5px]"
            style={{ color: mine ? "var(--leaf)" : "var(--vermilion)", borderColor: "currentColor", filter: "url(#ink-rough)" }}
          >
            <Check className="h-5 w-5" strokeWidth={3.2} />
          </span>
        ) : (
          <>
            <span className="font-display text-p-lead font-extrabold tabular-nums">{prize.points}</span>
            <span className="mt-0.5 text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-muted">pts</span>
          </>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center px-2">
        <span className={`font-display block truncate text-[0.9375rem] font-extrabold leading-tight min-[380px]:text-p-body ${winner || !ready ? "" : "text-ink"} ${!winner && !ready ? "text-ink/70" : ""}`}>{prize.label}</span>
        {winner ? (
          <span className="mt-1 flex items-center gap-1.5 text-p-note font-bold">
            <Sticker id={winnerPlayer?.avatar} size={22} />
            <span className="truncate">{mine ? (wide ? "Aapne jeeta!" : "Aapka!") : wide ? `${winner.name} ne jeeta` : winner.name}</span>
            {wide && <span className="shrink-0 text-muted">+{prize.points}</span>}
          </span>
        ) : (
          <>
            <span className="block truncate text-p-note font-semibold text-muted">{ready ? "Claim karo!" : prize.hint}</span>
            <span className="mt-1 flex items-center gap-1.5" aria-hidden>
              <span className="flex gap-[3px]">
                {Array.from({ length: need }, (_, i) => (
                  <span key={i} className={`h-1.5 rounded-full ${need > 5 ? "w-1.5" : "w-2.5"} ${i < have ? "bg-ink" : "bg-ink/15"}`} />
                ))}
              </span>
              <span className="text-p-note font-bold tabular-nums">
                {have}/{need}
              </span>
            </span>
          </>
        )}
      </span>
      {winner && wide && (
        <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 -rotate-6 scale-75" aria-hidden>
          <Stamp tone={mine ? "leaf" : "vermilion"}>{mine ? "Jeet!" : "Gaya"}</Stamp>
        </span>
      )}
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Sheets and game over                                                 */
/* ------------------------------------------------------------------ */

function ScoreList({ players, scores, meId }: { players: Player[]; scores: Record<string, number>; meId: string }) {
  const rows = players.filter((p) => p.id in scores).sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
  return (
    <ol className="divide-y-[1.5px] divide-ink/10">
      {rows.map((p, i) => (
        <motion.li key={p.id} layout transition={spring.select} className="flex items-center gap-3 py-2.5">
          <span className="w-5 text-p-body font-semibold text-muted">{i + 1}</span>
          <Sticker id={p.avatar} size={36} />
          <span className="min-w-0 flex-1 truncate text-p-lead font-semibold">
            {p.name} {p.id === meId && <span className="text-p-note font-bold uppercase tracking-wider text-turmeric-ink">you</span>}
          </span>
          <span className="font-display text-p-title font-extrabold tabular-nums">{scores[p.id] ?? 0}</span>
        </motion.li>
      ))}
    </ol>
  );
}

function GameOver({ view, players, me }: { view: Pub; players: Player[]; me: Player }) {
  const top = players.filter((p) => p.id in view.scores).sort((a, b) => (view.scores[b.id] ?? 0) - (view.scores[a.id] ?? 0))[0];
  const iWon = top?.id === me.id && (view.scores[me.id] ?? 0) > 0;
  return (
    <motion.section {...screenIn} aria-label="Game over" className="cut rounded-soft bg-paper p-4">
      <div className="text-p-note font-bold uppercase tracking-[0.16em] text-muted">Khel khatam</div>
      <h2 className="mt-0.5 text-p-title font-extrabold">{iWon ? "Wah! Aap jeet gaye!" : top && (view.scores[top.id] ?? 0) > 0 ? `${top.name} jeet gaye!` : "Sab numbers ho gaye!"}</h2>
      <ul className="mt-3 border-y-[1.5px] border-ink/15">
        {PRIZES.map((p, i) => {
          const w = view.winners[p.id];
          const wp = players.find((x) => x.id === w?.playerId);
          return (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { delay: staggerDelay(i, 0.1), duration: dur.screen, ease: ease.out } }}
              className={`flex min-h-11 items-center gap-2 text-p-body ${i ? "border-t-[1.5px] border-ink/10" : ""}`}
            >
              <span className="flex-1 font-semibold">{p.label}</span>
              {w ? (
                <span className="flex items-center gap-1.5 font-bold">
                  <Sticker id={wp?.avatar} size={26} /> {w.playerId === me.id ? "Aap" : w.name}
                </span>
              ) : (
                <span className="text-muted">kisi ne nahi liya</span>
              )}
              <span className="font-display w-8 text-right font-extrabold tabular-nums text-muted">{w ? `+${p.points}` : ""}</span>
            </motion.li>
          );
        })}
      </ul>
      <div className="mt-3 text-p-note font-bold uppercase tracking-[0.16em] text-muted">Points</div>
      <ScoreList players={players} scores={view.scores} meId={me.id} />
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* The phone view                                                       */
/* ------------------------------------------------------------------ */

export function Phone({ view, priv, me, players, send, now, isHost, hostAct }: PhoneProps<Pub, Priv>) {
  const sfx = useSfx();
  const [sheet, setSheet] = useState<"board" | "scores" | null>(null);
  const [localAuto, setLocalAuto] = useState(false);
  useEffect(() => {
    try {
      setLocalAuto(localStorage.getItem(AUTO_KEY) === "1");
    } catch {}
  }, []);
  const autoMark = view.autoMark || localAuto;

  // Calls are read aloud on the "stage" (host phone / TV), or on every phone when people are apart.
  const { current, call } = view;
  const spoken = useRef<number | null>(current);
  useEffect(() => {
    if (current && spoken.current !== current) {
      spoken.current = current;
      if (!sfx.together || sfx.isStage) speak(call ?? String(current));
    }
  }, [current, call, sfx.together, sfx.isStage]);

  useOnChange(view.current, (n) => {
    if (n) sfx.shared("whoosh");
  });
  const secs = view.nextCallAt && !view.paused ? Math.ceil(Math.max(0, view.nextCallAt - now) / 1000) : null;
  useOnChange(secs, (s) => {
    if (s !== null && s >= 1 && s <= 3 && !view.done) sfx.shared("tick");
  });
  useOnChange(view.lastEvent?.at ?? 0, () => {
    const ev = view.lastEvent;
    if (!ev) return;
    if (ev.kind === "win") {
      if (ev.playerId === me.id) {
        sfx.mine("fanfare", [80, 40, 120]);
        celebrate(["#5b2a6e", "#f2b632", "#c23a22", "#fffdf8"]);
      } else sfx.shared("fanfare");
    } else if (ev.playerId === me.id) sfx.mine("buzz", [200]);
  });
  useOnChange(view.done, (d) => {
    if (d) celebrate(["#5b2a6e", "#f2b632", "#c23a22", "#fffdf8"]);
  });

  const called = useMemo(() => new Set(view.called), [view.called]);
  const marks = useMemo(() => {
    if (!priv) return new Set<number>();
    return new Set(autoMark ? priv.ticket.flat().filter((n) => n && called.has(n)) : priv.marks);
  }, [priv, autoMark, called]);

  if (!priv) {
    return (
      <MotionConfig reducedMotion="user">
        <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
          <p className="breathe font-display text-p-title font-extrabold">Aapka ticket chhap raha hai…</p>
          <p className="mt-2 text-p-body text-muted">Your ticket is being printed. One moment.</p>
        </div>
      </MotionConfig>
    );
  }

  const ev = view.lastEvent && now - view.lastEvent.at < 6000 ? view.lastEvent : null;
  const bogey = !!priv.bogeyAt && now - priv.bogeyAt < 1200;
  const myScore = view.scores[me.id] ?? 0;
  const waiting = called.size > 0 ? priv.ticket.flat().filter((n) => n && called.has(n) && !marks.has(n)).length : 0;

  return (
    <MotionConfig reducedMotion="user">
      <InkDefs />
      <div className="space-y-4">
        {/* Screen readers hear each new number and each win. */}
        <div className="sr-only" aria-live="polite">
          {view.current ? `Number ${view.current}. ${view.call ?? ""}` : ""}
        </div>

        {view.done ? <GameOver view={view} players={players} me={me} /> : <CallCard view={view} now={now} isHost={isHost} hostAct={hostAct} />}

        <div aria-live="polite" className="min-h-0">
          <AnimatePresence>
            {ev && !view.done && (
              <motion.div
                key={ev.at}
                initial={{ opacity: 0, y: -8, rotate: -1 }}
                animate={{ opacity: 1, y: 0, rotate: ev.kind === "win" ? -1 : 0, transition: spring.select }}
                exit={{ opacity: 0, transition: { duration: dur.screenExit, ease: ease.in } }}
                className={`rounded-cut border-[1.5px] px-3 py-2 text-p-body font-bold ${
                  ev.kind === "win"
                    ? ev.playerId === me.id
                      ? "border-ink bg-leaf text-paper shadow-[2px_2px_0_0_var(--ink)]"
                      : "border-ink bg-paper shadow-[2px_2px_0_0_var(--ink)]"
                    : ev.playerId === me.id
                      ? "border-vermilion bg-paper text-vermilion"
                      : "border-ink/20 text-muted"
                }`}
              >
                {ev.kind === "win"
                  ? ev.playerId === me.id
                    ? `Shabash! ${ev.text.replace(/^.*? wins /, "Aapne jeeta: ")}`
                    : ev.text.replace(/^(.*) wins (.*)!$/, "$1 ne $2 jeet liya!")
                  : ev.playerId === me.id
                    ? "Bogey! Abhi poora nahi hua — keep going."
                    : ev.text.replace("Bogey! ", "Bogey: ")}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <TicketCard
          me={me}
          ticket={priv.ticket}
          marks={marks}
          called={called}
          autoMark={autoMark}
          hostAuto={view.autoMark}
          shake={bogey}
          onToggleAuto={() => {
            const next = !localAuto;
            setLocalAuto(next);
            try {
              localStorage.setItem(AUTO_KEY, next ? "1" : "0");
            } catch {}
          }}
          onMark={(n, wasMarked) => {
            send("mark", n);
            if (!wasMarked) sfx.mine("pop", 15);
          }}
        />
        {!view.done && (
          <p className="-mt-1 text-center text-p-note font-semibold text-muted" aria-live="polite">
            {autoMark
              ? view.autoMark
                ? "Host ne auto-mark on kiya hai. Bas claim karna yaad rakho!"
                : "Auto-mark on hai. Bas claim karna yaad rakho!"
              : waiting > 0
                ? `${waiting} number${waiting > 1 ? "s" : ""} bula liye — tap to mark.`
                : "A yellow dot means that number has been called."}
          </p>
        )}

        <section aria-label="Prizes">
          <h2 className="mb-2 flex items-baseline justify-between">
            <span className="text-p-lead font-extrabold">Inaam</span>
            <span className="text-p-note font-semibold text-muted">Line poori hui? Coupon tap karo.</span>
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {PRIZES.map((p) => {
              const w = view.winners[p.id];
              const { have, need } = prizeProgress(priv.ticket, called, p.id);
              return (
                <Coupon
                  key={p.id}
                  prize={p}
                  have={have}
                  need={need}
                  winner={w}
                  winnerPlayer={players.find((x) => x.id === w?.playerId)}
                  mine={w?.playerId === me.id}
                  wide={p.id === "full"}
                  onClaim={() => send("claim", p.id as Prize)}
                />
              );
            })}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <PaperButton tone="paper" onClick={() => setSheet("board")}>
            <Grid3x3 className="h-4 w-4 shrink-0" strokeWidth={2.4} /> <span className="whitespace-nowrap">Sab numbers</span>
          </PaperButton>
          <PaperButton tone="paper" onClick={() => setSheet("scores")}>
            <Trophy className="h-4 w-4" strokeWidth={2.4} /> Points · {myScore}
          </PaperButton>
        </div>
        {view.done && isHost && <p className="text-center text-p-body text-muted">Naya game? Tap the home button at the top to go back to the lobby.</p>}
      </div>

      <PaperSheet open={sheet === "board"} onClose={() => setSheet(null)} title={`${view.called.length} numbers bula liye`}>
        <div className="grid grid-cols-10 gap-1" role="list" aria-label="All numbers, called ones highlighted">
          {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => {
            const isCalled = called.has(n);
            return (
              <div
                key={n}
                role="listitem"
                aria-label={`${n}${isCalled ? ", called" : ""}`}
                className={`font-display flex aspect-square items-center justify-center rounded-full text-p-note font-extrabold tabular-nums ${
                  n === view.current ? "border-[1.5px] border-ink bg-turmeric text-ink" : isCalled ? "text-paper" : "text-ink/30"
                }`}
                style={isCalled && n !== view.current ? { background: JAMUN } : undefined}
              >
                {n}
              </div>
            );
          })}
        </div>
      </PaperSheet>
      <PaperSheet open={sheet === "scores"} onClose={() => setSheet(null)} title="Ab tak ke points">
        <ScoreList players={players} scores={view.scores} meId={me.id} />
      </PaperSheet>
    </MotionConfig>
  );
}
