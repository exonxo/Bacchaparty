"use client";
/** Chor Kaun? on the big screen: public information only — never the word, never who the Chor is before the reveal. */
import { Gavel, SkipForward, Tag } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { PaperButton, Sticker } from "@/components/paper/Paper";
import { dur, ease, spring } from "@/components/paper/motion";
import { MaskGlyph, VerdictSlip, WaxSeal } from "@/components/paper/objects";
import { TvBoard, TvCard, TvLabel, TvPeople, TvStage, TvTimer, rankRows, tv } from "@/components/paper/tv-a";
import type { Player, ScreenProps } from "@/lib/types";
import { chorWon, resultText, roundGains } from "./helpers";
import type { Pub } from "./index";

const TURMERIC = "#f2b632";

/** A big sealed envelope, drawn for the TV. Decorative. */
function BigEnvelope({ open }: { open: boolean }) {
  return (
    <div className="relative mx-auto aspect-[320/200] h-full max-h-full" style={{ transform: "rotate(-1.5deg)" }} aria-hidden>
      <svg viewBox="0 0 330 210" className="absolute inset-0 h-full w-full overflow-visible">
        <rect x="6" y="6" width="320" height="200" rx="7" fill="#1e1a17" />
        <rect x="1" y="1" width="320" height="200" rx="7" fill={open ? "#fff6dd" : TURMERIC} stroke="#1e1a17" strokeWidth="2" />
        <path d="M1 7V194a7 7 0 0 0 7 7h306a7 7 0 0 0 7-7V7L170 114a14 14 0 0 1-18 0Z" fill={TURMERIC} stroke="#1e1a17" strokeWidth="2" strokeLinejoin="round" />
        <path d="M4 198 140 104M318 198 182 104" stroke="#1e1a17" strokeOpacity="0.28" strokeWidth="2" strokeLinecap="round" />
        {!open && <path d="M1 2h320L171 115a14 14 0 0 1-20 0Z" fill="#e2a425" stroke="#1e1a17" strokeWidth="2" strokeLinejoin="round" />}
        {open && <path d="M1 2h320L171 -100a14 14 0 0 0-20 0Z" fill="#e2a425" stroke="#1e1a17" strokeWidth="2" strokeLinejoin="round" />}
      </svg>
      {!open && (
        <div className="absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2">
          <WaxSeal size={64} />
        </div>
      )}
    </div>
  );
}

function Playing({ view, players, now }: { view: Pub; players: Player[]; now: number }) {
  const parts = view.participants.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  const asker = players.find((p) => p.id === view.firstAsker);
  const voted = new Set(view.voted);
  return (
    <div className="grid min-h-0 grid-cols-[1.2fr_1fr] gap-[2.4vw]">
      <TvCard className="flex flex-col" style={{ background: "var(--paper)" }}>
        <div className="flex items-center justify-between gap-4">
          <TvLabel>Round {view.round}</TvLabel>
          <span className={`inline-flex items-center gap-2 rounded-cut border-[1.5px] border-ink px-3 py-1 font-bold ${tv.body}`} style={{ background: TURMERIC }}>
            <Tag className="h-[1em] w-[1em]" strokeWidth={2.4} /> {view.topicLabel}
          </span>
        </div>
        <h2 className={`mt-[1.6vh] font-display font-extrabold ${tv.title}`}>Apna lifafa chupke se dekho</h2>
        <div className="min-h-0 flex-1 py-[2.4vh]">
          <BigEnvelope open={false} />
        </div>
        <div className="flex items-end justify-between gap-[2vw]">
          {asker && (
            <div className="flex items-center gap-[1vw]">
              <Sticker id={asker.avatar} size={64} tilt={-4} />
              <div>
                <TvLabel>Pehla sawaal</TvLabel>
                <div className={`font-display font-extrabold ${tv.lead}`}>{asker.name}</div>
              </div>
            </div>
          )}
          <TvTimer deadline={view.deadline} total={view.roundMs} now={now} label="Round khatam hone mein" urgentAt={30} format="mmss" className="w-[48%]" />
        </div>
      </TvCard>

      <div className="grid min-h-0 grid-rows-[auto_auto_1fr] gap-[2.4vh]">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className={`font-display font-extrabold ${tv.title}`}>Kaun hai chor?</h2>
            <span className={`font-bold tabular-nums text-ink/70 ${tv.lead}`}>
              {voted.size}/{parts.length} vote
            </span>
          </div>
          <p className={`mt-[0.6vh] text-ink/60 ${tv.body}`}>Votes chhupe rahenge — result pe khulenge.</p>
        </div>
        <TvCard className="min-h-0">
          <TvPeople
            people={parts}
            size={parts.length > 8 ? 52 : 72}
            status={(p) => (voted.has(p.id) ? { text: "vote de diya", done: true, tone: "leaf" } : { text: "soch rahe hain…" })}
          />
        </TvCard>
        <TvBoard rows={rankRows(players, view.scores, view.participants)} max={6} className="min-h-0" />
      </div>
    </div>
  );
}

function Reveal({ view, players }: { view: Pub; players: Player[] }) {
  const reveal = view.reveal!;
  const r = reveal.result;
  const won = chorWon(r);
  const verdict = r.reason === "guess" && r.chorGuessCorrect ? "Sahi jawab!" : won ? "Bhaag gaye!" : "Pakde gaye!";
  const gains = roundGains(reveal, view.participants);
  const chor = players.find((p) => p.id === reveal.chorId);
  const rows = rankRows(players, view.scores, view.participants).map((row) => ({
    ...row,
    gain: gains[row.p.id] ?? 0,
    highlight: row.p.id === reveal.chorId,
    sub:
      row.p.id === reveal.chorId ? (
        <span className="inline-flex items-center gap-1 text-vermilion">
          <MaskGlyph size={26} /> Chor
        </span>
      ) : view.voteCounts[row.p.id] ? (
        `${view.voteCounts[row.p.id]} vote`
      ) : undefined,
  }));
  return (
    <div className="grid min-h-0 grid-cols-[1.2fr_1fr] gap-[2.4vw]">
      <motion.div className="min-h-0" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.screen, ease: ease.out }}>
        <TvCard className="flex h-full flex-col items-center justify-center gap-[2.6vh] text-center" style={{ background: TURMERIC }}>
          <TvLabel className="!text-ink/75">Shabd tha · {reveal.topicLabel}</TvLabel>
          <div className="relative">
            <motion.div
              className={`paper-rule cut max-w-[min(100%,46vw)] rounded-cut bg-paper px-[3.5vw] py-[3vh] font-display font-extrabold text-balance ${reveal.majorityWord.length > 12 ? tv.hero : tv.giant}`}
              initial={{ y: 80, opacity: 0, rotate: 0 }}
              animate={{ y: 0, opacity: 1, rotate: -1.5 }}
              transition={{ ...spring.sheet, delay: 0.15 }}
            >
              {reveal.majorityWord}
            </motion.div>
            <motion.div
              className="absolute -bottom-[5vh] right-[1vw]"
              initial={{ scale: 1.7, opacity: 0, rotate: -14 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ ...spring.settle, delay: 0.6 }}
            >
              <VerdictSlip tone={won ? "vermilion" : "leaf"} seed={view.round * 7} tilt={-5}>
                <span className="text-[clamp(1.6rem,4.6vh,3.4rem)]">{verdict}</span>
              </VerdictSlip>
            </motion.div>
          </div>
          <div className={`mt-[4vh] flex items-center gap-[1vw] ${tv.lead}`}>
            {chor && <Sticker id={chor.avatar} size={64} tilt={-4} />}
            <span className="text-left">
              Chor: <b>{chor?.name ?? "?"}</b> · unka shabd: <b>{reveal.chorWord}</b>
            </span>
          </div>
          <p className={`max-w-[90%] font-semibold text-ink/85 ${tv.lead}`}>{resultText(r, players, reveal.chorId)}</p>
        </TvCard>
      </motion.div>
      <div className="grid min-h-0 grid-rows-[auto_1fr] gap-[2vh]">
        <h2 className={`font-display font-extrabold ${tv.title}`}>Kaun kya tha</h2>
        <TvBoard rows={rows} title="Is round ke points" max={8} size={rows.length <= 6 ? "lg" : "md"} />
      </div>
    </div>
  );
}

export function TvScreen({ view, players, act, now, spectator }: ScreenProps<Pub>) {
  return (
    <TvStage className={spectator ? "grid-rows-[1fr]" : "grid-rows-[1fr_auto]"}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view.phase === "reveal" ? `r${view.round}` : `p${view.round}`}
          className="grid min-h-0"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { duration: dur.screen, ease: ease.out } }}
          exit={{ opacity: 0, y: -8, transition: { duration: dur.screenExit, ease: ease.in } }}
        >
          {view.phase === "reveal" && view.reveal ? <Reveal view={view} players={players} /> : <Playing view={view} players={players} now={now} />}
        </motion.div>
      </AnimatePresence>
      {!spectator && (
        <div className="flex justify-end gap-3">
          {view.phase === "playing" ? (
            <PaperButton tone="paper" onClick={() => act("end")}>
              <Gavel className="h-4 w-4" /> Bas! Count the votes
            </PaperButton>
          ) : (
            <PaperButton onClick={() => act("next")}>
              <SkipForward className="h-4 w-4" /> Chalo, next round
            </PaperButton>
          )}
        </div>
      )}
    </TvStage>
  );
}

