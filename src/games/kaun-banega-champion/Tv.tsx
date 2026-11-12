"use client";
import { Armchair, Shield, Trophy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { dur, ease, spring, staggerDelay } from "@/components/paper/motion";
import { Stamp } from "@/components/paper/objects";
import { Sticker } from "@/components/paper/Paper";
import { TvBoard, TvFrame, TvLabel, TvPodium, TvStickers, TvTimer } from "@/components/paper/tv-b";
import type { Player, ScreenProps } from "@/lib/types";
import { LADDER, SAFE, type Pub } from "./index";
import { LEVEL_NAME, NAVY, NAVY_DEEP, OPTION_LOOK, ShapeIcon } from "./PaperPhone";

const CREAM = "#fffdf8";

function boardRows(view: Pub, players: Player[]) {
  return players
    .filter((p) => p.id in view.scores || p.connected)
    .map((p) => {
      const played = view.played.includes(p.id);
      const bonus = view.bonus[p.id] ?? 0;
      return {
        p,
        score: view.scores[p.id] ?? 0,
        active: p.id === view.hotSeat && view.phase !== "over",
        note: p.id === view.hotSeat && view.phase !== "over" ? "Hot seat par" : played ? `Level ${view.best[p.id] ?? 0}${bonus ? ` · +${bonus} audience` : ""}` : bonus ? `+${bonus} audience` : "Hot seat baaki",
      };
    });
}

/** Ten rungs from the bottom up, the current one in navy, the safe level with a shield. */
function Ladder({ view }: { view: Pub }) {
  const playing = view.phase === "question" || view.phase === "locked" || view.phase === "reveal";
  return (
    <section aria-label={`Level ${view.rung + 1} of ${LADDER}. Safe level ${SAFE}.`} className="cut flex min-h-0 flex-1 flex-col rounded-soft bg-card px-[2vh] py-[1.6vh]">
      <TvLabel>Seedhi</TvLabel>
      <ol className="mt-[1vh] flex min-h-0 flex-1 flex-col-reverse gap-[0.6vh]">
        {Array.from({ length: LADDER }, (_, i) => {
          const cleared = playing && (i < view.rung || (i === view.rung && view.phase === "reveal" && view.hotAnswer === view.answer));
          const current = playing && i === view.rung;
          return (
            <motion.li
              key={i}
              layout
              transition={spring.select}
              className={`font-display flex min-h-0 flex-1 items-center justify-between rounded-[4px] border-[1.5px] px-[1.2vh] font-extrabold tabular-nums ${
                current ? "border-ink text-paper" : cleared ? "border-ink bg-leaf text-paper" : "border-line text-muted"
              }`}
              style={{ background: current ? NAVY : undefined, boxShadow: current ? "2px 2px 0 0 var(--ink)" : undefined, fontSize: "clamp(0.95rem, 2.3vh, 1.5rem)" }}
            >
              <span>Level {i + 1}</span>
              {i + 1 === LADDER ? <Trophy className="h-[2.4vh] w-[2.4vh]" /> : i + 1 === SAFE ? <Shield className="h-[2.4vh] w-[2.4vh]" /> : null}
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}

function Option({ i, text, view }: { i: number; text: string; view: Pub }) {
  const look = OPTION_LOOK[i];
  const removed = view.removed.includes(i);
  const revealed = view.phase === "reveal" && view.answer !== null;
  const right = revealed && view.answer === i;
  const locked = view.hotAnswer === i && view.phase !== "question";
  const wrongPick = revealed && locked && !right;
  if (removed) {
    return (
      <div className="flex items-center gap-[1.6vh] rounded-cut border-[1.5px] border-dashed border-line px-[2vh] font-semibold text-muted" style={{ fontSize: "clamp(1rem, 2.4vh, 1.6rem)" }}>
        <ShapeIcon shape={look.shape} size={36} fill="transparent" stroke="var(--line)" />
        50:50 ne hataya
      </div>
    );
  }
  return (
    <motion.div
      animate={{ opacity: revealed && !right && !wrongPick ? 0.38 : 1, rotate: locked && !revealed ? -0.6 : 0, scale: right ? 1.02 : 1 }}
      transition={spring.select}
      className="cut relative flex min-h-0 items-center gap-[1.8vh] rounded-cut px-[2vh]"
      style={{ background: look.color, color: look.on, outline: locked ? "4px solid var(--ink)" : undefined, outlineOffset: 3 }}
      aria-label={`${look.name}: ${text}`}
    >
      <span className="flex shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink bg-paper" style={{ width: "clamp(2.8rem, 7vh, 4.6rem)", height: "clamp(2.8rem, 7vh, 4.6rem)" }}>
        <ShapeIcon shape={look.shape} fill={look.color} size={34} />
      </span>
      <span className="font-display min-w-0 flex-1 font-extrabold leading-tight text-balance" style={{ fontSize: "clamp(1.4rem, 4.2vh, 3.2rem)" }}>
        {text}
      </span>
      <AnimatePresence>
        {(locked || right) && (
          <motion.span
            key={right ? "right" : wrongPick ? "wrong" : "lock"}
            className="pointer-events-none shrink-0"
            initial={{ scale: 1.8, opacity: 0, rotate: -18 }}
            animate={{ scale: 1, opacity: 1, rotate: -8, transition: { duration: 0.24, ease: ease.out } }}
          >
            <span className="inline-block rounded-cut bg-paper">
              <Stamp tone={right ? "leaf" : wrongPick ? "vermilion" : "ink"}>{right ? "Sahi" : wrongPick ? "Galat" : "Lock"}</Stamp>
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function FamilyBars({ view }: { view: Pub }) {
  if (!view.family) return null;
  const shown = view.family.map((c, i) => ({ c, i })).filter(({ i }) => !view.removed.includes(i));
  const total = shown.reduce((a, b) => a + b.c, 0);
  return (
    <section aria-label="Family vote" className="cut rounded-soft bg-card px-[2vh] py-[1.4vh]">
      <TvLabel>Family ne kya kaha</TvLabel>
      {total === 0 ? (
        <p className="mt-[0.6vh] font-semibold text-muted" style={{ fontSize: "clamp(0.9rem, 2vh, 1.3rem)" }}>
          Abhi kisi ne vote nahi kiya.
        </p>
      ) : (
        <ul className="mt-[1vh] grid gap-[0.8vh]">
          {shown.map(({ c, i }) => {
            const pct = Math.round((c / total) * 100);
            const look = OPTION_LOOK[i];
            return (
              <li key={i} className="flex items-center gap-[1vh]">
                <ShapeIcon shape={look.shape} fill={look.color} size={24} />
                <div className="h-[2.4vh] flex-1 overflow-hidden rounded-[3px] border-[1.5px] border-ink bg-paper">
                  <motion.div className="h-full" style={{ background: look.color }} initial={{ width: 0 }} animate={{ width: `${pct}%`, transition: { duration: dur.reveal, ease: ease.expo } }} />
                </div>
                <span className="font-display w-[6vh] text-right font-extrabold tabular-nums" style={{ fontSize: "clamp(0.95rem, 2.3vh, 1.5rem)" }}>
                  {pct}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Big screen: read-only. Hot seat pick, the question with colour + shape answers, the ladder, timer and scores. */
export function TvScreen({ view, players, now }: ScreenProps<Pub>) {
  const hot = players.find((p) => p.id === view.hotSeat) ?? null;
  const rows = boardRows(view, players);

  if (view.phase === "final") {
    return (
      <TvFrame
        stage={
          <TvPodium
            rows={players
              .filter((p) => p.id in view.scores)
              .map((p) => ({
                p,
                score: view.scores[p.id] ?? 0,
                sub: [view.played.includes(p.id) ? `Level ${view.best[p.id] ?? 0}` : "Hot seat nahi", view.bonus[p.id] ? `+${view.bonus[p.id]} audience` : ""].filter(Boolean).join(" · "),
              }))}
            headline={(w) => (w ? `${w.name} bane Champion!` : "Khel khatam!")}
            accent={NAVY}
            accentInk={CREAM}
            note="Points = hot seat ka level + audience bonus"
          />
        }
      />
    );
  }

  if (view.phase === "pick" || view.phase === "level" || (view.phase === "over" && view.result)) {
    const stage =
      view.phase === "pick" ? (
        <div className="flex h-full flex-col justify-center gap-[3vh]">
          <div className="cut flex items-center gap-[2.4vh] rounded-soft px-[3vh] py-[2.4vh]" style={{ background: NAVY, color: CREAM }}>
            <Armchair className="breathe shrink-0" style={{ width: "clamp(3rem, 9vh, 6.5rem)", height: "clamp(3rem, 9vh, 6.5rem)" }} strokeWidth={1.6} />
            <div>
              <div className="font-display font-extrabold leading-none" style={{ fontSize: "clamp(2.4rem, 8vh, 6rem)" }}>
                Hot seat par kaun?
              </div>
              <p className="mt-[1vh] opacity-85" style={{ fontSize: "clamp(1rem, 2.6vh, 1.8rem)" }}>
                Host chunenge. Baaki sab audience mein — har sahi jawab pe +1 bonus.
              </p>
            </div>
          </div>
          <TvStickers
            players={players.filter((p) => p.connected)}
            size={84}
            mark={(p) => (
              <span className="font-semibold text-muted" style={{ fontSize: "clamp(0.85rem, 2vh, 1.25rem)" }}>
                {view.played.includes(p.id) ? `Level ${view.best[p.id] ?? 0} tak` : "abhi baaki"}
              </span>
            )}
          />
        </div>
      ) : view.phase === "level" ? (
        <div className="flex h-full flex-col items-center justify-center gap-[2.4vh] text-center">
          <motion.div initial={{ scale: 0.8, rotate: -6, opacity: 0 }} animate={{ scale: 1, rotate: -3, opacity: 1, transition: spring.settle }}>
            <Sticker id={hot?.avatar} size={170} tilt={-4} />
          </motion.div>
          <div className="font-display font-extrabold leading-none" style={{ fontSize: "clamp(2.8rem, 9vh, 7rem)" }}>
            {hot?.name ?? "Koi"} hot seat par!
          </div>
          <p className="font-semibold text-muted" style={{ fontSize: "clamp(1.1rem, 3vh, 2rem)" }}>
            Level chun rahe hain — Kids, Family ya Grown-ups
          </p>
          {hot && !hot.connected && (
            <p className="font-semibold text-vermilion" style={{ fontSize: "clamp(1rem, 2.4vh, 1.6rem)" }}>
              {hot.name} ka phone offline hai — thodi der mein skip hoga.
            </p>
          )}
        </div>
      ) : (
        <ResultStage view={view} players={players} />
      );
    return <TvFrame stage={stage} rail={<TvBoard title="Score board" rows={rows} accent={NAVY} accentInk={CREAM} />} />;
  }

  const q = view.question;
  if (!q) return <TvFrame stage={null} rail={<TvBoard title="Score board" rows={rows} accent={NAVY} accentInk={CREAM} />} />;
  const audience = players.filter((p) => p.connected && p.id !== view.hotSeat).length;
  const stage = (
    <div className="flex h-full min-h-0 flex-col gap-[2vh]">
      <div className="flex items-center gap-[1.6vh]">
        <Sticker id={hot?.avatar} size={56} tilt={-4} />
        <div className="min-w-0 flex-1">
          <div className="font-display truncate font-extrabold leading-none" style={{ fontSize: "clamp(1.6rem, 4.6vh, 3.4rem)" }}>
            {hot?.name ?? "Hot seat"}
          </div>
          <div className="font-semibold text-muted" style={{ fontSize: "clamp(0.9rem, 2.2vh, 1.4rem)" }}>
            {view.level ? `${LEVEL_NAME[view.level]} sawaal` : ""} · Audience: {view.answered.length}/{audience} ne jawab diya
          </div>
        </div>
        <div className="flex gap-[1vh]">
          {[
            { k: "fifty", label: "50:50" },
            { k: "family", label: "Family vote" },
          ].map(({ k, label }) => {
            const used = view.lifelines[k as "fifty" | "family"];
            return (
              <span
                key={k}
                className={`font-display rounded-cut border-[1.5px] px-[1.2vh] py-[0.4vh] font-extrabold ${used ? "border-line text-muted line-through" : "border-ink bg-card"}`}
                style={{ fontSize: "clamp(0.9rem, 2.2vh, 1.4rem)" }}
              >
                {label}
              </span>
            );
          })}
        </div>
      </div>
      <motion.section
        key={q.q}
        aria-label="Question"
        initial={{ rotateX: -18, y: -10, opacity: 0 }}
        animate={{ rotateX: 0, y: 0, opacity: 1, transition: spring.settle }}
        className="cut relative rounded-soft px-[3vh] py-[2.4vh]"
        style={{ background: NAVY, color: CREAM }}
      >
        <div className="font-bold uppercase tracking-[0.2em] opacity-80" style={{ fontSize: "clamp(0.85rem, 2vh, 1.3rem)" }}>
          Sawaal {view.rung + 1}
        </div>
        <h2 className="font-display mt-[0.8vh] font-extrabold leading-tight text-balance" style={{ fontSize: "clamp(1.8rem, 5.6vh, 4.4rem)" }}>
          {q.q}
        </h2>
        <div aria-hidden className="absolute inset-x-[3vh] -bottom-[8px] h-[10px] rounded-b-[4px] border-x-[1.5px] border-b-[1.5px] border-ink" style={{ background: NAVY_DEEP }} />
      </motion.section>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-[1.8vh] pt-[0.6vh]" style={{ gridAutoRows: "minmax(0,1fr)" }}>
        {q.options.map((text, i) => (
          <Option key={`${q.q}-${i}`} i={i} text={text} view={view} />
        ))}
      </div>
    </div>
  );
  const statusText =
    view.phase === "locked"
      ? `${hot?.name ?? "Hot seat"} ne jawab lock kar diya… dil thaam ke baitho!`
      : view.phase === "reveal"
        ? view.timedOut
          ? "Time up!"
          : view.hotAnswer === view.answer
            ? "Sahi jawab!"
            : "Galat jawab"
        : null;
  const rail = (
    <>
      {view.phase === "question" && <TvTimer now={now} deadline={view.deadline} pausedLeft={view.pausedLeft} totalSeconds={view.seconds} label="Jawab do" color={NAVY} />}
      {statusText && (
        <motion.div
          key={statusText}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: dur.screen, ease: ease.out } }}
          className={`cut font-display rounded-soft px-[2vh] py-[1.6vh] font-extrabold leading-tight ${view.phase === "reveal" ? (view.hotAnswer === view.answer && !view.timedOut ? "bg-leaf text-paper" : "bg-vermilion text-paper") : "bg-card"}`}
          style={{ fontSize: "clamp(1.3rem, 3.6vh, 2.6rem)" }}
          aria-live="polite"
        >
          {statusText}
        </motion.div>
      )}
      <FamilyBars view={view} />
      <Ladder view={view} />
    </>
  );
  return <TvFrame stage={stage} rail={rail} />;
}

function ResultStage({ view, players }: { view: Pub; players: Player[] }) {
  const r = view.result!;
  const who = players.find((p) => p.id === r.playerId);
  const title = r.how === "champion" ? `${who?.name ?? "Koi"} Champion!` : r.how === "quit" ? `${who?.name ?? "Koi"} Level ${r.won} pe ruke` : `${who?.name ?? "Koi"} Level ${r.won} tak`;
  const line =
    r.how === "champion" ? "Saare 10 level paar! Kamaal kar diya." : r.how === "quit" ? "Samajhdari se khel chhoda." : r.won ? `Galat jawab, par safe level ${SAFE} ne bacha liya.` : "Galat jawab. Agli baar pakka!";
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[2.4vh] text-center">
      <motion.div className="mb-[1vh]" initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1, transition: spring.settle }}>
        <Sticker id={who?.avatar} size={150} tilt={-5} />
      </motion.div>
      <h1 className="font-display font-extrabold leading-none text-balance" style={{ fontSize: "clamp(2.8rem, 9vh, 7rem)" }} aria-live="polite">
        {title}
      </h1>
      <p className="font-semibold text-muted" style={{ fontSize: "clamp(1.1rem, 3vh, 2rem)" }}>
        {line}
      </p>
      <motion.div initial={{ scale: 1.8, opacity: 0, rotate: -16 }} animate={{ scale: 1.4, opacity: 1, rotate: -6, transition: { delay: 0.35, duration: 0.24, ease: ease.out } }}>
        <Stamp tone={r.how === "champion" ? "leaf" : r.how === "quit" ? "ink" : "vermilion"}>{r.how === "champion" ? "Champion" : r.how === "quit" ? "Ruk gaye" : "Out"}</Stamp>
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: staggerDelay(4, 0.6) } }}
        className="mt-[2vh] font-semibold text-muted"
        style={{ fontSize: "clamp(0.95rem, 2.3vh, 1.5rem)" }}
      >
        Host agla hot seat chunenge…
      </motion.p>
    </div>
  );
}
