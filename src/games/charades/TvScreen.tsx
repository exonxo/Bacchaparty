"use client";
/**
 * Dumb Charades on the big screen: who is acting, a stopwatch (no countdown),
 * the two teams and their scores. The movie only appears after a team guesses
 * it or the turn ends — never while someone is acting, and never for a pass.
 */
import { SkipForward, Timer, UserRoundCog, WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { PaperButton, Sticker } from "@/components/paper/Paper";
import { dur, ease, spring } from "@/components/paper/motion";
import { VerdictSlip } from "@/components/paper/objects";
import { TvLabel, TvNumber, TvStage, mmss, tv } from "@/components/paper/tv-a";
import type { Player, ScreenProps } from "@/lib/types";
import { AWAY_MS, TEAM_NAMES, type Pub, type Team } from "./index";

const INK = "#1e1a17";
const CHIT = "#3e8e5a";
const TEAM_PAPER: Record<Team, string> = { A: "#f2b632", B: "#ec7a3c" };
const TEAM_SHORT: Record<Team, string> = { A: "Laddoo", B: "Jalebi" };

/** The leaf-green bowl of chits. Decorative. */
function Bowl({ wobble }: { wobble: boolean }) {
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
      className="h-[18vh] w-auto"
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

function TeamCard({ t, view, players, index }: { t: Team; view: Pub; players: Player[]; index: number }) {
  const active = view.turnTeam === t;
  const members = view.teams[t].map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  return (
    <motion.div
      animate={{ rotate: active ? (index ? 1.2 : -1.2) : 0, scale: active ? 1 : 0.97 }}
      transition={spring.select}
      className={`relative flex min-h-0 flex-col justify-between rounded-soft p-[2.2vh] text-ink ${active ? "cut" : "border-[2px] border-ink/25"}`}
      style={{ background: active ? TEAM_PAPER[t] : `color-mix(in srgb, ${TEAM_PAPER[t]} 25%, var(--paper))` }}
    >
      {active && (
        <span className={`absolute -top-[1.6vh] right-[1.4vw] rounded-cut bg-ink px-[0.8vw] py-[0.4vh] font-bold leading-none text-bg ${tv.body}`} style={{ transform: "rotate(4deg)" }}>
          Abhi baari
        </span>
      )}
      <div className="flex items-start justify-between gap-[1vw]">
        <div className="min-w-0 leading-tight">
          <TvLabel className="!text-ink/70">Team</TvLabel>
          <div className={`font-display truncate font-extrabold ${tv.title}`}>{TEAM_SHORT[t]}</div>
          <div className={`font-semibold text-ink/75 ${tv.body}`}>{members.length} log</div>
        </div>
        <motion.span key={view.scores[t]} initial={{ scale: 1.5 }} animate={{ scale: 1 }} transition={spring.settle} className={`font-display font-extrabold ${tv.giant}`}>
          <TvNumber value={view.scores[t]} />
        </motion.span>
      </div>
      <ul className="mt-[1.4vh] flex flex-wrap gap-x-[1.2vw] gap-y-[1vh]">
        {members.slice(0, 8).map((p) => (
          <li key={p.id} className={`flex w-[clamp(4.5rem,6.5vw,7.5rem)] flex-col items-center ${p.connected ? "" : "opacity-40"}`}>
            <Sticker id={p.avatar} size={p.id === view.actorId ? 64 : 54} tilt={p.id === view.actorId ? -6 : 0} />
            <span className={`mt-[0.4vh] w-full truncate text-center font-bold ${tv.body}`}>{p.name}</span>
          </li>
        ))}
        {members.length > 8 && <li className={`self-center font-bold ${tv.body}`}>+{members.length - 8}</li>}
      </ul>
    </motion.div>
  );
}

function ResultNote({ view, now }: { view: Pub; now: number }) {
  const r = view.lastResult;
  const visible = !!r && now - r.at < 6000;
  return (
    <AnimatePresence>
      {visible && r && (
        <motion.div
          key={r.at}
          className="flex flex-col items-center gap-[1vh] text-center"
          initial={{ opacity: 0, scale: 1.3 }}
          animate={{ opacity: 1, scale: 1, transition: spring.settle }}
          exit={{ opacity: 0, transition: { duration: dur.screenExit, ease: ease.in } }}
        >
          {r.kind === "got" ? (
            <>
              <VerdictSlip tone="leaf" seed={r.at % 97} tilt={r.team === "A" ? -3 : 3}>
                <span className="text-[clamp(1.8rem,5.4vh,4rem)]">Pakad liya!</span>
              </VerdictSlip>
              <p className={`font-semibold ${tv.lead}`}>
                {TEAM_NAMES[r.team]} · “{r.movie}” · +1
              </p>
            </>
          ) : (
            <p className={`rounded-cut border-[1.5px] border-ink/20 bg-paper px-[1.4vw] py-[1vh] font-semibold text-ink/80 ${tv.lead}`}>
              {r.kind === "pass" ? "Pass — chit wapas bowl mein" : r.kind === "reveal" ? `Turn khatam — movie thi “${r.movie}”` : r.text}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stage({ view, players, now }: { view: Pub; players: Player[]; now: number }) {
  const actor = players.find((p) => p.id === view.actorId) ?? null;
  const teamName = TEAM_NAMES[view.turnTeam];
  const secs = view.turnStart ? Math.max(0, Math.floor((now - view.turnStart) / 1000)) : 0;
  const awayLeft = view.actorAwaySince ? Math.max(0, Math.ceil((view.actorAwaySince + AWAY_MS - now) / 1000)) : null;
  const showResult = !!view.lastResult && now - view.lastResult.at < 6000;
  return (
    <div className="cut relative flex min-h-0 flex-col items-center justify-center gap-[2.4vh] overflow-hidden rounded-soft bg-paper px-[2vw] py-[2.4vh] text-center">
      <div className="absolute inset-x-0 top-0 h-[1.4vh]" style={{ background: TEAM_PAPER[view.turnTeam] }} aria-hidden />
      {!actor ? (
        <>
          <h2 className={`font-display font-extrabold ${tv.title}`}>{TEAM_SHORT[view.turnTeam]} mein koi nahi</h2>
          <p className={`text-ink/70 ${tv.lead}`}>No one from {teamName} is here right now.</p>
        </>
      ) : (
        <>
          <motion.span
            animate={view.phase === "acting" ? { y: [0, -10, 0], rotate: [0, -4, 4, 0] } : { y: 0 }}
            transition={{ duration: 1.8, repeat: view.phase === "acting" ? Infinity : 0, ease: "easeInOut" }}
          >
            <Sticker id={actor.avatar} size={150} tilt={-4} />
          </motion.span>
          <div>
            <TvLabel>{teamName}</TvLabel>
            <h2 className={`mt-[0.6vh] font-display font-extrabold text-balance ${tv.hero}`}>
              {view.phase === "ready" ? `${actor.name} chit nikaal rahe hain…` : `${actor.name} act kar rahe hain!`}
            </h2>
            <p className={`mt-[1vh] text-ink/75 ${tv.lead}`}>{view.phase === "ready" ? "Taiyaar ho jao!" : "Bolna mana hai — sirf ishaare. Team, guess karo!"}</p>
          </div>
          {showResult ? (
            <div className="flex min-h-[18vh] items-center">
              <ResultNote view={view} now={now} />
            </div>
          ) : view.phase === "ready" ? (
            <Bowl wobble />
          ) : (
            <div className="flex items-center gap-[1.6vw]" aria-label={`Acting for ${Math.floor(secs / 60)} minutes ${secs % 60} seconds`}>
              <span className="cut flex items-center gap-[0.8vw] rounded-cut bg-paper px-[1.4vw] py-[0.8vh]" style={{ transform: "rotate(1.2deg)" }}>
                <Timer className="h-[4.4vh] w-[4.4vh]" strokeWidth={2.4} />
                <span className={`font-display font-extrabold tabular-nums ${tv.title}`}>{mmss(secs)}</span>
              </span>
              {view.passes > 0 && <span className={`font-semibold text-ink/60 ${tv.lead}`}>{view.passes} pass</span>}
            </div>
          )}
          {awayLeft !== null && (
            <div role="status" className={`flex items-center gap-2 rounded-cut border-[2px] border-vermilion/50 px-[1.2vw] py-[0.8vh] font-semibold text-vermilion ${tv.lead}`}>
              <WifiOff className="h-[1em] w-[1em] shrink-0" /> {actor.name} ka phone offline hai — agla actor {awayLeft}s mein
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function TvScreen({ view, players, act, now, spectator }: ScreenProps<Pub>) {
  return (
    <TvStage className={spectator ? "grid-rows-[1fr]" : "grid-rows-[1fr_auto]"}>
      <div className="grid min-h-0 grid-cols-[1.45fr_1fr] gap-[2.4vw]">
        <Stage view={view} players={players} now={now} />
        <div className="grid min-h-0 grid-rows-[1fr_1fr_auto] gap-[3vh] pt-[1.6vh]">
          {(["A", "B"] as Team[]).map((t, i) => (
            <TeamCard key={t} t={t} view={view} players={players} index={i} />
          ))}
          <p className={`text-center text-ink/60 ${tv.body}`}>Koi timer nahi — aaram se khelo · Turn {view.turns + 1}</p>
        </div>
      </div>
      {!spectator && (
        <div className="flex justify-end gap-3">
          <PaperButton tone="paper" onClick={() => act("skipActor")}>
            <UserRoundCog className="h-4 w-4" /> Doosra actor
          </PaperButton>
          <PaperButton onClick={() => act("nextTurn")}>
            <SkipForward className="h-4 w-4" /> Agli team
          </PaperButton>
        </div>
      )}
    </TvStage>
  );
}
