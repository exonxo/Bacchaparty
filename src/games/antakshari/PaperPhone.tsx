"use client";
import { Check, Flag, Hand, Lightbulb, Mic, Pause, Play, Shuffle, SkipForward, Timer, Users, WifiOff, X } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { dur, ease, screenIn, spring } from "@/components/paper/motion";
import { InkDefs, VerdictSlip } from "@/components/paper/objects";
import { PaperButton, Sticker, tornClip } from "@/components/paper/Paper";
import { celebrate } from "@/lib/celebrate";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import type { PhoneProps, Player } from "@/lib/types";
import { AWAY_MS, LETTERS, TEAM_NAMES, TEAM_SHORT, other, teamOf, type Pub, type Team } from "./index";

const INK = "#1e1a17";
/** Cassette shell (the game's colour) and the two team papers (same as Dumb Charades). */
const ROSE = "#e2557a";
const ROSE_DARK = "#b83a5c";
const TEAM_PAPER: Record<Team, string> = { 0: "#f2b632", 1: "#ec7a3c" };

/* ------------------------------------------------------------------ */
/* Small pieces                                                         */
/* ------------------------------------------------------------------ */

/** Two paper team cards with score and members. The team singing now sits tilted with a tag. */
function TeamCards({ view, players, me }: { view: Pub; players: Player[]; me: Player }) {
  return (
    <div className="grid grid-cols-2 gap-3" aria-label="Teams and scores">
      {([0, 1] as Team[]).map((t) => {
        const active = view.turn === t;
        const mine = view.teams[t].includes(me.id);
        const members = view.teams[t].map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
        return (
          <motion.div
            key={t}
            animate={{ rotate: active ? (t ? 1.5 : -1.5) : 0, y: active ? -2 : 0 }}
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
                <span key={p.id} className={p.connected ? "" : "opacity-40"} title={p.name}>
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

/** One cassette reel: hub with spokes. Turns while a team is singing (static with reduced motion). */
function Reel({ cx, cy, spin }: { cx: number; cy: number; spin: boolean }) {
  return (
    <motion.g
      style={{ originX: `${cx}px`, originY: `${cy}px`, transformBox: "view-box" }}
      animate={spin ? { rotate: 360 } : { rotate: 0 }}
      transition={spin ? { duration: 2.4, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
    >
      <circle cx={cx} cy={cy} r={13} fill="#fffdf8" stroke={INK} strokeWidth={2} />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <rect key={deg} x={cx - 1.75} y={cy - 11} width={3.5} height={6} rx={1.2} fill={INK} transform={`rotate(${deg} ${cx} ${cy})`} />
      ))}
      <circle cx={cx} cy={cy} r={3.5} fill={INK} />
    </motion.g>
  );
}

/**
 * The cassette: rose shell and a paper label with the letter written on it
 * by hand, like a mixtape. The letter is HTML over the label so it uses the
 * display font; everything else is one SVG.
 */
function Cassette({ letter, spin, caption, compact = false }: { letter: string; spin: boolean; caption?: string; compact?: boolean }) {
  return (
    <div className={`mx-auto w-full ${compact ? "max-w-[11.5rem]" : "max-w-[22rem]"}`}>
      <div className="relative" style={{ transform: "rotate(-1.2deg)" }}>
        <svg viewBox="0 0 320 200" className="block w-full drop-shadow-[2px_2px_0_var(--ink)]" aria-hidden>
          <rect x={4} y={4} width={312} height={192} rx={14} fill={ROSE} stroke={INK} strokeWidth={2.5} />
          {[18, 302].map((x) => [18, 182].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={4} fill={ROSE_DARK} stroke={INK} strokeWidth={1.5} />))}
          {/* paper label */}
          <rect x={24} y={16} width={272} height={128} rx={6} fill="#fffdf8" stroke={INK} strokeWidth={2} />
          <path d="M30 34 H290" stroke={ROSE_DARK} strokeOpacity={0.5} strokeWidth={1.5} />
          <path d="M44 94 H276" stroke={INK} strokeOpacity={0.14} strokeWidth={1.5} />
          {/* reel window */}
          <rect x={84} y={102} width={152} height={30} rx={15} fill="#fbf6ee" stroke={INK} strokeWidth={2} />
          <Reel cx={112} cy={117} spin={spin} />
          <Reel cx={208} cy={117} spin={spin} />
          <path d="M125 122 Q160 130 195 122" stroke="#6b3a22" strokeWidth={4} fill="none" opacity={0.75} />
          {/* bottom bridge */}
          <path d="M72 196 L86 158 H234 L248 196" fill={ROSE_DARK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          {[120, 143, 177, 200].map((x) => (
            <circle key={x} cx={x} cy={178} r={4} fill="#fbf6ee" stroke={INK} strokeWidth={1.5} />
          ))}
        </svg>
        {!compact && (
          <div className="pointer-events-none absolute inset-x-[10%] top-[9.5%] flex justify-between text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-ink/60">
            <span>Side A</span>
            <span>Antakshari</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-[18%] flex h-[29%] items-center justify-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={letter}
              initial={{ y: -14, opacity: 0, rotate: -10 }}
              animate={{ y: 0, opacity: 1, rotate: -4, transition: spring.settle }}
              exit={{ y: 10, opacity: 0, transition: { duration: dur.screenExit, ease: ease.in } }}
              className={`font-display font-extrabold leading-none text-ink ${compact ? "text-[2rem]" : "text-[3.75rem]"}`}
              aria-label={letter === "?" ? "Next letter coming" : `Letter ${letter}`}
            >
              {letter}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
      {caption && <p className="mt-3 text-center font-display text-p-lead font-extrabold text-balance">{caption}</p>}
    </div>
  );
}

/** Countdown to start singing, visible to everyone. */
function TimerStrip({ view, now }: { view: Pub; now: number }) {
  if (!view.seconds || view.phase !== "singing") return null;
  const total = view.seconds * 1000;
  const leftMs = view.paused ? (view.pausedLeft ?? total) : view.deadline ? Math.max(0, view.deadline - now) : total;
  const left = Math.ceil(leftMs / 1000);
  const urgent = !view.paused && left <= 5;
  const pct = Math.max(0, Math.min(100, (leftMs / total) * 100));
  return (
    <div role="timer" aria-live="off" aria-label={view.paused ? "Timer paused" : `${left} seconds to start singing`} className="px-0.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-1.5 text-p-body font-semibold text-ink/80">
          {view.paused ? <Pause className="h-4 w-4" strokeWidth={2.4} /> : <Timer className="h-4 w-4" strokeWidth={2.4} />}
          {view.paused ? "Host ne roka hai — paused" : "Gaana shuru karne ka time"}
        </span>
        <span className={`font-display text-p-title font-extrabold tabular-nums ${urgent ? "text-vermilion" : ""}`}>{left}s</span>
      </div>
      <div className="mt-1.5 h-3 overflow-hidden rounded-full border-[1.5px] border-ink bg-paper">
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            background: urgent ? "var(--vermilion)" : ROSE,
            opacity: view.paused ? 0.4 : 1,
            transition: "width 0.25s linear, background-color 0.2s",
          }}
        />
      </div>
    </div>
  );
}

/** A torn song slip with a suggested song (title and film only). */
function SongSlip({ hint, letter, onAnother }: { hint: { title: string; source: string } | null; letter: string; onAnother?: () => void }) {
  const clip = useMemo(() => tornClip((hint?.title.length ?? 3) * 17 + letter.charCodeAt(0), { top: true, bottom: true }, 3), [hint, letter]);
  return (
    <div className="flex items-start gap-2">
      <div className="cut-drop min-w-0 flex-1" style={{ transform: "rotate(0.8deg)" }}>
        <div className="paper-rule bg-[#fff3a8] px-4 py-3 text-[#1e1a17]" style={{ clipPath: clip }}>
          <div className="flex items-center gap-1.5 text-p-note font-bold uppercase tracking-[0.16em]">
            <Lightbulb className="h-3.5 w-3.5" strokeWidth={2.6} /> Song slip
          </div>
          {hint ? (
            <>
              <div className="mt-0.5 font-display text-p-lead font-extrabold leading-tight">{hint.title}</div>
              <div className="text-p-note font-semibold text-ink/70">{hint.source}</div>
            </>
          ) : (
            <div className="mt-0.5 text-p-body font-semibold">“{letter}” se koi hint nahi — apne dum pe!</div>
          )}
        </div>
      </div>
      {onAnother && (
        <button type="button" onClick={onAnother} className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tint" aria-label="Another song hint">
          <Shuffle className="h-4 w-4" strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}

/** Letter tiles, styled like the room-code tiles. */
function LetterTiles({ onPick }: { onPick: (l: string) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-6 gap-2" role="group" aria-label="Last letter of your song">
      {LETTERS.map((l, i) => (
        <motion.button
          key={l}
          type="button"
          disabled={!!picked}
          whileTap={{ scale: 0.92, transition: { duration: dur.pressDown, ease: ease.out } }}
          animate={picked === l ? { rotate: -6, scale: 1.12 } : { rotate: [-1.5, 1, -0.8, 1.6, -1.2, 0.6][i % 6] }}
          transition={spring.select}
          onClick={() => {
            setPicked(l);
            onPick(l);
          }}
          className={`cut flex aspect-[4/5] min-h-12 items-center justify-center rounded-cut font-display text-p-title font-extrabold ${picked === l ? "bg-turmeric" : "bg-paper"} ${
            picked && picked !== l ? "opacity-40" : ""
          }`}
        >
          {l}
        </motion.button>
      ))}
    </div>
  );
}

/** Two-tap confirm (no browser dialogs). */
function ConfirmButton({ label, confirmLabel, onConfirm, icon, now, tone = "paper", size = "md" }: { label: string; confirmLabel: string; onConfirm: () => void; icon: ReactNode; now: number; tone?: "paper" | "vermilion"; size?: "md" | "lg" }) {
  const [armedAt, setArmedAt] = useState<number | null>(null);
  const armed = armedAt !== null && now - armedAt < 3000;
  return (
    <PaperButton
      tone={armed ? "vermilion" : tone}
      size={size}
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

function StickerRow({ ids, players, mark }: { ids: string[]; players: Player[]; mark?: (id: string) => ReactNode }) {
  const list = ids.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  return (
    <ul className="flex flex-wrap justify-center gap-x-3 gap-y-2">
      {list.map((p) => (
        <li key={p.id} className={`flex flex-col items-center gap-0.5 ${p.connected ? "" : "opacity-40"}`}>
          <span className="relative">
            <Sticker id={p.avatar} size={40} />
            {mark?.(p.id)}
          </span>
          <span className="max-w-[4.5rem] truncate text-p-note font-semibold">{p.name}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Stage by role                                                        */
/* ------------------------------------------------------------------ */

function Card({ children, band }: { children: ReactNode; band?: string }) {
  return (
    <div className="cut relative overflow-hidden rounded-soft bg-paper px-4 pb-5 pt-4 text-center">
      {band && <div className="absolute inset-x-0 top-0 h-2" style={{ background: band }} aria-hidden />}
      {children}
    </div>
  );
}

function Stage({ view, players, me, now, send, hintSlot }: { view: Pub; players: Player[]; me: Player; now: number; send: (t: string, p?: unknown) => void; hintSlot?: ReactNode }) {
  const myTeam = teamOf(view, me.id);
  const singingTeam = view.turn;
  const judgeTeam = other(singingTeam);
  const singingNow = myTeam === singingTeam;
  const connected = new Set(players.filter((p) => p.connected).map((p) => p.id));
  const judges = view.teams[judgeTeam].filter((id) => connected.has(id));
  const voted = judges.filter((id) => view.votes[id]).length;
  const awayLeft = view.awaySince ? Math.max(0, Math.ceil((view.awaySince + AWAY_MS - now) / 1000)) : null;

  if (myTeam === null) {
    return (
      <Card>
        <Users className="mx-auto h-8 w-8 text-muted" />
        <h2 className="mt-2 font-display text-p-title font-extrabold">Team mein jagah ban rahi hai…</h2>
        <p className="mt-1 text-p-body text-muted">You’ll join a team in a moment.</p>
      </Card>
    );
  }

  if (view.phase === "singing") {
    return (
      <Card band={TEAM_PAPER[singingTeam]}>
        <Cassette
          letter={view.letter}
          spin={!view.paused}
          caption={singingNow ? `Aapki baari! “${view.letter}” se gaana gaao` : `${TEAM_SHORT[singingTeam]} “${view.letter}” se gaa rahe hain`}
        />
        {singingNow ? (
          <div className="mt-4 space-y-3 text-left">
            {hintSlot}
            <p className="text-center text-p-body text-muted">Sing at least one full line together, then tap the button.</p>
            <PaperButton size="lg" className="w-full !bg-leaf !text-paper" onClick={() => send("sang")}>
              <Mic className="h-5 w-5" strokeWidth={2.6} /> Humne gaaya!
            </PaperButton>
            <ConfirmButton label="Give up" confirmLabel="Pakka? Doosri team ko point" icon={<Flag className="h-4 w-4" strokeWidth={2.4} />} now={now} onConfirm={() => send("giveup")} />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-p-lead font-semibold text-ink/85 text-balance">Dhyaan se suno — aap judge karoge. Apna agla gaana bhi socho!</p>
            <StickerRow ids={view.teams[singingTeam]} players={players} />
          </div>
        )}
        {awayLeft !== null && (
          <div role="status" className="mt-4 flex items-center justify-center gap-2 rounded-cut border-[1.5px] border-vermilion/50 px-3 py-2 text-p-body font-semibold text-vermilion">
            <WifiOff className="h-4 w-4 shrink-0" /> {TEAM_SHORT[singingTeam]} offline hai — turn moves in {awayLeft}s
          </div>
        )}
      </Card>
    );
  }

  if (view.phase === "judging") {
    const mine = view.votes[me.id];
    const isJudge = myTeam === judgeTeam;
    return (
      <Card band={TEAM_PAPER[judgeTeam]}>
        <div className="mb-3">
          <Cassette letter={view.letter} spin={false} compact />
        </div>
        <div className="text-p-note font-bold uppercase tracking-[0.18em] text-turmeric-ink">Faisla</div>
        <h2 className="mt-1 font-display text-p-title font-extrabold text-balance">
          {isJudge ? `${TEAM_SHORT[singingTeam]} ka gaana chalega?` : `${TEAM_SHORT[judgeTeam]} faisla kar rahe hain…`}
        </h2>
        <p className="mt-1 text-p-body text-muted">
          Letter “{view.letter}” · {voted} of {judges.length} judges voted
        </p>
        {isJudge && <p className="mt-2 text-p-body font-semibold text-ink/85">Gaana “{view.letter}” se shuru hua? Kam se kam ek poori line gaayi?</p>}
        {isJudge ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <PaperButton size="lg" aria-pressed={mine === "valid"} className={`w-full !px-3 ${mine === "valid" ? "!bg-leaf !text-paper" : "!bg-paper"}`} onClick={() => send("vote", "valid")}>
              <Check className="h-5 w-5" strokeWidth={3} /> Valid
            </PaperButton>
            <PaperButton size="lg" aria-pressed={mine === "challenge"} className={`w-full !px-3 ${mine === "challenge" ? "!bg-vermilion !text-paper" : "!bg-paper"}`} onClick={() => send("vote", "challenge")}>
              <Hand className="h-5 w-5" strokeWidth={2.4} /> Challenge
            </PaperButton>
          </div>
        ) : (
          <div className="mt-4">
            <StickerRow
              ids={view.teams[judgeTeam]}
              players={players}
              mark={(id) =>
                view.votes[id] ? (
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-ink bg-leaf text-paper" aria-label="voted">
                    <Check className="h-3 w-3" strokeWidth={3.4} />
                  </span>
                ) : null
              }
            />
          </div>
        )}
      </Card>
    );
  }

  if (view.phase === "challenged") {
    return (
      <Card band="var(--vermilion)">
        <VerdictSlip tone="vermilion" seed={view.letter.charCodeAt(0)} tilt={-3}>
          Challenge!
        </VerdictSlip>
        <h2 className="mt-3 font-display text-p-title font-extrabold">Host decide karega</h2>
        <p className="mt-1 text-p-body text-muted">Did {TEAM_SHORT[singingTeam]}’s song really start with “{view.letter}”?</p>
      </Card>
    );
  }

  // next-letter
  return (
    <Card band={TEAM_PAPER[singingTeam]}>
      {singingNow ? (
        <>
          <div className="text-p-note font-bold uppercase tracking-[0.18em] text-turmeric-ink">Agla akshar</div>
          <h2 className="mt-1 font-display text-p-title font-extrabold text-balance">Aapke gaane ka aakhri akshar?</h2>
          <p className="mb-4 mt-1 text-p-body text-muted">The last letter of your song — {TEAM_SHORT[judgeTeam]} sings from it next.</p>
          <LetterTiles onPick={(l) => send("letter", l)} />
        </>
      ) : (
        <>
          <div className="mb-3">
            <Cassette letter="?" spin compact />
          </div>
          <div className="text-p-note font-bold uppercase tracking-[0.18em] text-turmeric-ink">Agla akshar</div>
          <h2 className="mt-1 font-display text-p-title font-extrabold text-balance">{TEAM_SHORT[singingTeam]} agla akshar chun rahe hain…</h2>
          <p className="mt-1 text-p-body text-muted">{myTeam === judgeTeam ? "Get ready — aapki baari aa rahi hai!" : "Wait a moment."}</p>
        </>
      )}
      {awayLeft !== null && (
        <div role="status" className="mt-4 flex items-center justify-center gap-2 rounded-cut border-[1.5px] border-vermilion/50 px-3 py-2 text-p-body font-semibold text-vermilion">
          <WifiOff className="h-4 w-4 shrink-0" /> {TEAM_SHORT[singingTeam]} offline hai — turn moves in {awayLeft}s
        </div>
      )}
    </Card>
  );
}

/** What just happened: stamped slip for a valid song or a timeout, a quiet note otherwise. */
function ResultNote({ view, now }: { view: Pub; now: number }) {
  const r = view.lastEvent;
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
          {r.kind === "valid" ? (
            <>
              <VerdictSlip tone="leaf" seed={r.at % 97} tilt={r.team === 0 ? -3 : 3}>
                Sahi gaana!
              </VerdictSlip>
              <p className="mt-1 text-p-body font-semibold">{r.team !== undefined ? `${TEAM_NAMES[r.team]} · +1` : r.text}</p>
            </>
          ) : r.kind === "timeout" ? (
            <>
              <VerdictSlip tone="vermilion" seed={r.at % 89} tilt={-2}>
                Time up!
              </VerdictSlip>
              <p className="mt-1 text-p-body font-semibold">{r.team !== undefined ? `+1 ${TEAM_NAMES[r.team]}` : r.text}</p>
            </>
          ) : (
            <p className="rounded-cut border-[1.5px] border-ink/20 bg-paper px-3 py-2 text-p-body font-semibold text-ink/80">{r.text}</p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Phone view                                                           */
/* ------------------------------------------------------------------ */

export function Phone({ view, me, players, send, now, isHost, hostAct }: PhoneProps<Pub, undefined>) {
  const { shared, mine } = useSfx();
  const myTeam = teamOf(view, me.id);
  const singingNow = myTeam === view.turn && view.phase === "singing";
  const left = view.phase === "singing" && view.deadline && !view.paused ? Math.ceil((view.deadline - now) / 1000) : null;

  useOnChange(`${view.turn}-${view.phase}`, () => {
    if (view.phase === "singing" && myTeam === view.turn) mine("turn", [60, 40, 60]);
    if (view.phase === "judging" && myTeam === other(view.turn)) mine("pop", 30);
  });
  useOnChange(left, (n) => {
    if (n !== null && n > 0 && n <= 5) shared("tick");
  });
  useOnChange(view.lastEvent?.at ?? 0, () => {
    const r = view.lastEvent;
    if (!r) return;
    if (r.kind === "valid") {
      if (r.team === myTeam) {
        mine("fanfare", [60, 40, 60]);
        celebrate([r.team !== undefined ? TEAM_PAPER[r.team] : ROSE, ROSE, INK, "#fffdf8"]);
      } else shared("ding");
    } else if (r.kind === "timeout") shared("buzz");
    else if (r.kind === "giveup" && r.team === myTeam) mine("ding", 40);
  });

  const liveText = view.lastEvent?.text ?? "";
  const showHint = view.hintsOn && view.phase === "singing" && (myTeam === view.turn || isHost);
  const hintSlot = showHint ? <SongSlip hint={view.hint} letter={view.letter} onAnother={isHost ? () => hostAct("hint") : undefined} /> : null;
  // The singing team sees the slip inside their card; a host on the other team sees it below.
  const hintBelow = showHint && myTeam !== view.turn;

  return (
    <MotionConfig reducedMotion="user">
      <InkDefs />
      <div className="relative z-10 space-y-5 text-ink">
        <div aria-live="polite" className="sr-only">
          {liveText}
        </div>
        <TeamCards view={view} players={players} me={me} />

        <TimerStrip view={view} now={now} />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={`${view.turn}-${view.phase}`} {...screenIn}>
            <Stage view={view} players={players} me={me} now={now} send={send} hintSlot={hintSlot} />
          </motion.div>
        </AnimatePresence>

        {hintBelow && hintSlot}

        <ResultNote view={view} now={now} />

        {isHost && (
          <section aria-label="Host controls" className="border-t-[1.5px] border-dashed border-ink/25 pt-4">
            <div className="mb-2 text-p-note font-semibold uppercase tracking-[0.14em] text-muted">Host ke controls</div>
            {(view.phase === "judging" || view.phase === "challenged") && (
              <div className="mb-3 grid grid-cols-2 gap-3">
                <PaperButton className="w-full !bg-leaf !text-paper" onClick={() => hostAct("accept")}>
                  <Check className="h-4 w-4" strokeWidth={3} /> Valid hai
                </PaperButton>
                <PaperButton tone="vermilion" className="w-full" onClick={() => hostAct("reject")}>
                  <X className="h-4 w-4" strokeWidth={3} /> Nahi chalega
                </PaperButton>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {view.seconds > 0 && (
                <PaperButton tone="paper" className="w-full" onClick={() => hostAct("pause")} aria-label={view.paused ? "Resume the timer" : "Pause the timer"}>
                  {view.paused ? <Play className="h-4 w-4" strokeWidth={2.4} /> : <Pause className="h-4 w-4" strokeWidth={2.4} />} {view.paused ? "Chalu karo" : "Roko"}
                </PaperButton>
              )}
              {view.phase === "singing" && (
                <PaperButton tone="paper" className="w-full" onClick={() => hostAct("newLetter")}>
                  <Shuffle className="h-4 w-4" strokeWidth={2.4} /> Naya akshar
                </PaperButton>
              )}
              <PaperButton tone="paper" className="w-full" aria-pressed={view.hintsOn} onClick={() => hostAct("toggleHints")}>
                <Lightbulb className="h-4 w-4" strokeWidth={2.4} /> {view.hintsOn ? "Hints band" : "Hints chalu"}
              </PaperButton>
              <ConfirmButton
                label="Agli team"
                confirmLabel="Pakka?"
                icon={<SkipForward className="h-4 w-4" strokeWidth={2.4} />}
                now={now}
                onConfirm={() => hostAct("skipTurn")}
              />
            </div>
          </section>
        )}

        <p className="text-center text-p-note text-muted">
          {view.songsSung} {view.songsSung === 1 ? "gaana" : "gaane"} ho gaye · {singingNow ? "Sur lagao!" : "Antakshari chalu hai"}
        </p>
      </div>
    </MotionConfig>
  );
}
