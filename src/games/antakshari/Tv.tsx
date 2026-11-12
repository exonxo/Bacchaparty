"use client";
import { Check, Hand } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { dur, ease, spring } from "@/components/paper/motion";
import { Sticker } from "@/components/paper/Paper";
import { TvFrame, TvLabel, TvSlip, TvStickers, TvTimer } from "@/components/paper/tv-b";
import type { Player, ScreenProps } from "@/lib/types";
import { TEAM_SHORT, other, type Pub, type Team } from "./index";
import { Cassette, TEAM_PAPER } from "./PaperPhone";

/** One team as a big paper card: name, score and members. The singing team is lifted and tagged. */
function TeamCard({ t, view, players }: { t: Team; view: Pub; players: Player[] }) {
  const active = view.turn === t;
  const members = view.teams[t].map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  return (
    <motion.div
      animate={{ rotate: active ? (t ? 1.2 : -1.2) : 0, y: active ? -4 : 0 }}
      transition={spring.select}
      className={`relative flex min-w-0 flex-col rounded-soft px-[2.4vh] py-[1.8vh] text-ink ${active ? "cut" : "border-[1.5px] border-ink/25"}`}
      style={{ background: active ? TEAM_PAPER[t] : `color-mix(in srgb, ${TEAM_PAPER[t]} 26%, var(--paper))` }}
    >
      {active && (
        <span className="font-display absolute -top-[1.6vh] right-[2vh] rounded-cut bg-ink px-[1.2vh] py-[0.4vh] font-extrabold text-bg" style={{ fontSize: "clamp(0.9rem, 2.2vh, 1.4rem)", rotate: "3deg" }}>
          Abhi baari
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <TvLabel className="!text-ink/70">Team</TvLabel>
          <div className="font-display truncate font-extrabold leading-none" style={{ fontSize: "clamp(2rem, 6vh, 4.5rem)" }}>
            {TEAM_SHORT[t]}
          </div>
        </div>
        <motion.span
          key={view.scores[t]}
          initial={{ scale: 1.5 }}
          animate={{ scale: 1 }}
          transition={spring.settle}
          className="font-display font-extrabold leading-none tabular-nums"
          style={{ fontSize: "clamp(3.5rem, 11vh, 8.5rem)" }}
          aria-label={`${TEAM_SHORT[t]}: ${view.scores[t]} points`}
        >
          {view.scores[t]}
        </motion.span>
      </div>
      <div className="mt-[1vh] flex flex-wrap gap-[0.8vh]">
        {members.map((p) => (
          <span key={p.id} className={`flex items-center gap-[0.6vh] rounded-full bg-paper/70 py-[0.3vh] pl-[0.3vh] pr-[1vh] ${p.connected ? "" : "opacity-40"}`}>
            <Sticker id={p.avatar} size={34} />
            <span className="font-display max-w-[9vw] truncate font-bold" style={{ fontSize: "clamp(0.9rem, 2vh, 1.3rem)" }}>
              {p.name}
            </span>
          </span>
        ))}
      </div>
    </motion.div>
  );
}

/** What the room should do right now, in one big line. Never shows the singers' hint. */
function Status({ view, players }: { view: Pub; players: Player[] }) {
  const singers = TEAM_SHORT[view.turn];
  const judges = TEAM_SHORT[other(view.turn)];
  const judgeIds = view.teams[other(view.turn)].filter((id) => players.find((p) => p.id === id)?.connected);
  const voted = judgeIds.filter((id) => view.votes[id]).length;
  const line =
    view.phase === "singing"
      ? { big: `${singers}, gaana shuru karo!`, small: `“${view.letter}” se shuru hone wala koi bhi gaana — kam se kam ek poori line.` }
      : view.phase === "judging"
        ? { big: `${judges}, faisla karo!`, small: `Gaana chalega? Apne phone pe Valid ya Challenge dabao · ${voted}/${judgeIds.length} ne vote kiya` }
        : view.phase === "challenged"
          ? { big: "Challenge!", small: "Host decide karenge ki gaana chalega ya nahi." }
          : { big: `${singers} agla akshar chun rahe hain`, small: "Gaane ka aakhri akshar — wahi agli team ka akshar banega." };
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={`${view.phase}-${view.turn}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { duration: dur.screen, ease: ease.out } }}
        exit={{ opacity: 0, y: -8, transition: { duration: dur.screenExit, ease: ease.in } }}
        className="text-center"
        aria-live="polite"
      >
        <div className={`font-display font-extrabold leading-tight text-balance ${view.phase === "challenged" ? "text-vermilion" : ""}`} style={{ fontSize: "clamp(2rem, 6.2vh, 4.8rem)" }}>
          {line.big}
        </div>
        <p className="mx-auto mt-[0.8vh] max-w-[60vw] font-semibold text-muted text-balance" style={{ fontSize: "clamp(1rem, 2.6vh, 1.8rem)" }}>
          {line.small}
        </p>
      </motion.div>
    </AnimatePresence>
  );
}

function LastEvent({ view, now }: { view: Pub; now: number }) {
  const r = view.lastEvent;
  const visible = !!r && now - r.at < 6000;
  return (
    <AnimatePresence>
      {visible && r && (
        <motion.div key={r.at} exit={{ opacity: 0, transition: { duration: dur.screenExit, ease: ease.in } }} className="flex justify-center">
          {r.kind === "valid" ? (
            <TvSlip tone="leaf">Sahi gaana! {r.team !== undefined ? `+1 ${TEAM_SHORT[r.team]}` : ""}</TvSlip>
          ) : r.kind === "timeout" ? (
            <TvSlip tone="vermilion">Time up! {r.team !== undefined ? `+1 ${TEAM_SHORT[r.team]}` : ""}</TvSlip>
          ) : r.kind === "reject" ? (
            <TvSlip tone="ink">Nahi chalega</TvSlip>
          ) : (
            <TvSlip tone="turmeric">{r.kind === "giveup" ? `Haar maan li — +1 ${r.team !== undefined ? TEAM_SHORT[r.team] : ""}` : "Agli team"}</TvSlip>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Big screen: read-only. Shows teams, the letter on the cassette, the timer and the judges' votes. */
export function TvScreen({ view, players, now }: ScreenProps<Pub>) {
  const judgeTeam = other(view.turn);
  const judges = view.teams[judgeTeam].map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  const showVotes = view.phase === "judging" || view.phase === "challenged";
  const away = view.awaySince !== null && view.phase === "singing";
  const stage = (
    <div className="flex h-full min-h-0 flex-col gap-[2vh]">
      <div className="grid grid-cols-2 gap-[2.4vh]">
        <TeamCard t={0} view={view} players={players} />
        <TeamCard t={1} view={view} players={players} />
      </div>
      <div className="flex min-h-0 flex-1 items-center gap-[4vh]">
        <div className="h-full max-h-full min-h-0 shrink-0" style={{ width: "min(40vw, 62vh)" }}>
          <div className="flex h-full items-center">
            <Cassette letter={view.phase === "next-letter" ? "?" : view.letter} spin={view.phase === "singing" && !view.paused} tv />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[2.4vh]">
          <Status view={view} players={players} />
          <LastEvent view={view} now={now} />
          {away && (
            <p className="font-semibold text-vermilion" style={{ fontSize: "clamp(1rem, 2.4vh, 1.6rem)" }}>
              {TEAM_SHORT[view.turn]} ke saare phone offline hain — baari jaldi aage badhegi.
            </p>
          )}
        </div>
      </div>
    </div>
  );
  const rail = (
    <>
      {view.phase === "singing" && view.seconds > 0 && (
        <TvTimer now={now} deadline={view.deadline} pausedLeft={view.paused ? view.pausedLeft : null} totalSeconds={view.seconds} label="Shuru karo" color="#e2557a" />
      )}
      <section className="cut flex min-h-0 flex-1 flex-col rounded-soft bg-card px-[2vh] py-[1.6vh]">
        <TvLabel>{showVotes ? `${TEAM_SHORT[judgeTeam]} ke judges` : "Ab tak"}</TvLabel>
        {showVotes && (
          <div className="mt-[1vh] flex items-baseline gap-[1vh]">
            <span className="font-display font-extrabold leading-none tabular-nums" style={{ fontSize: "clamp(3rem, 9vh, 7rem)" }}>
              {judges.filter((p) => view.votes[p.id]).length}/{judges.filter((p) => p.connected).length}
            </span>
            <span className="font-semibold text-muted" style={{ fontSize: "clamp(1rem, 2.4vh, 1.6rem)" }}>
              ne vote kiya
            </span>
          </div>
        )}
        {showVotes ? (
          <div className="mt-[2.4vh] flex min-h-0 flex-1 flex-col">
            <TvStickers
              players={judges}
              size={72}
              mark={(p) =>
                view.votes[p.id] === "valid" ? (
                  <span className="flex items-center gap-1 rounded-cut bg-leaf px-[0.8vh] font-bold text-paper" style={{ fontSize: "clamp(0.8rem, 1.8vh, 1.1rem)" }}>
                    <Check className="h-4 w-4" /> Valid
                  </span>
                ) : view.votes[p.id] === "challenge" ? (
                  <span className="flex items-center gap-1 rounded-cut bg-vermilion px-[0.8vh] font-bold text-paper" style={{ fontSize: "clamp(0.8rem, 1.8vh, 1.1rem)" }}>
                    <Hand className="h-4 w-4" /> Challenge
                  </span>
                ) : (
                  <span className="font-semibold text-muted" style={{ fontSize: "clamp(0.8rem, 1.8vh, 1.1rem)" }}>
                    soch rahe hain…
                  </span>
                )
              }
            />
            <p className="mt-auto border-t-[1.5px] border-line pt-[1.2vh] font-semibold text-muted" style={{ fontSize: "clamp(0.9rem, 2vh, 1.3rem)" }}>
              Ab tak {view.songsSung} {view.songsSung === 1 ? "gaana" : "gaane"} · Laddoo {view.scores[0]} – {view.scores[1]} Jalebi
            </p>
          </div>
        ) : (
          <div className="mt-[1.6vh] flex flex-1 flex-col justify-center gap-[1.6vh] text-center">
            <div>
              <div className="font-display font-extrabold leading-none tabular-nums" style={{ fontSize: "clamp(3rem, 10vh, 7.5rem)" }}>
                {view.songsSung}
              </div>
              <div className="font-semibold text-muted" style={{ fontSize: "clamp(1rem, 2.4vh, 1.6rem)" }}>
                {view.songsSung === 1 ? "gaana ho gaya" : "gaane ho gaye"}
              </div>
            </div>
            <p className="font-semibold text-muted" style={{ fontSize: "clamp(0.9rem, 2vh, 1.3rem)" }}>
              Phone pe khelo: gaane wali team “Humne gaaya!” dabaye, doosri team judge kare.
            </p>
          </div>
        )}
      </section>
    </>
  );
  return <TvFrame stage={stage} rail={rail} />;
}
