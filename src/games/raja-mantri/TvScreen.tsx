"use client";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { dur, ease, spring, staggerDelay } from "@/components/paper/motion";
import { InkDefs, VerdictSlip } from "@/components/paper/objects";
import { CountUp, Sticker } from "@/components/paper/Paper";
import { TvCard, TvFrame, TvLeaderboard, TvPeople, TvPerson, TvTimer, tv, useTvScale } from "@/components/paper/tv-c";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import type { Player, ScreenProps } from "@/lib/types";
import { PICK_MS, ROLE_INFO, type Pub } from "./index";
import { FoldedChitArt, MAT, ROLE_PAPER, RoleGlyph, SCATTER } from "./PaperPhone";

const findP = (players: Player[], id: string | null | undefined) => players.find((p) => p.id === id);
const nameOf = (players: Player[], id: string | null | undefined) => findP(players, id)?.name ?? "Koi";

/** The cloth with four chits; taken chits carry the picker's sticker. Never shows a role. */
function TvChitTable({ view, players }: { view: Pub; players: Player[] }) {
  const k = useTvScale();
  const byChit = new Map<number, string>(Object.entries(view.taken).map(([id, i]) => [i, id]));
  return (
    <div className="cut relative h-full overflow-hidden rounded-soft" style={{ background: MAT }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{ backgroundImage: "repeating-linear-gradient(45deg, #fffdf8 0 1px, transparent 1px 9px), repeating-linear-gradient(-45deg, #fffdf8 0 1px, transparent 1px 9px)" }}
      />
      <div className="relative grid h-full grid-cols-4 place-items-center gap-[3%] px-[4%] py-[5%]">
        {[0, 1, 2, 3].map((i) => {
          const owner = byChit.get(i);
          const spot = SCATTER[i];
          const ownerP = findP(players, owner);
          return (
            <motion.div
              key={i}
              className="relative aspect-[3/2] w-full"
              style={{ marginTop: i % 2 ? "-8%" : "10%" }}
              initial={{ y: -90, opacity: 0, rotate: spot.r * 3 }}
              animate={{ y: owner ? -10 : 0, opacity: owner ? 0.75 : 1, rotate: owner ? spot.r / 3 : spot.r, transition: { ...spring.settle, delay: staggerDelay(i, 0.05) } }}
            >
              <FoldedChitArt />
              <AnimatePresence>
                {owner && (
                  <motion.span
                    className="absolute -bottom-[22%] left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border-[1.5px] border-ink bg-paper py-1 pl-1 pr-3 text-ink shadow-[2px_2px_0_0_var(--ink)]"
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1, transition: spring.select }}
                    exit={{ opacity: 0, transition: { duration: dur.screenExit, ease: ease.in } }}
                  >
                    <Sticker id={ownerP?.avatar} size={Math.round(48 * k)} />
                    <span className="max-w-[8ch] truncate text-[clamp(1rem,2.4vh,1.6rem)] font-bold">{ownerP?.name ?? "Koi"}</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/** Result: all four chits unfolded with roles and this round's points. */
function Unfolded({ view, players }: { view: Pub; players: Player[] }) {
  const k = useTvScale();
  return (
    <div className="grid min-h-0 flex-1 grid-cols-4 items-center gap-[clamp(0.75rem,1.5vw,1.5rem)] px-2 py-3" style={{ perspective: 900 }}>
      {view.seats.map((id, i) => {
        const role = view.roles?.[id];
        if (!role) return <div key={id} />;
        const paper = ROLE_PAPER[role];
        const pts = view.lastPoints[id] ?? 0;
        return (
          <motion.div
            key={id}
            className="cut mx-auto flex aspect-[3/4] max-h-full w-full flex-col items-center justify-center rounded-cut px-2 py-[clamp(0.75rem,2vh,1.5rem)] text-center"
            style={{ background: paper.bg, color: paper.fg }}
            initial={{ rotateX: 80, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1, rotate: [-2, 1.5, -1, 2][i], transition: { duration: dur.reveal, ease: ease.out, delay: 0.15 + i * 0.12 } }}
          >
            <RoleGlyph role={role} size={Math.round(64 * k)} />
            <div className="font-display mt-1 text-[clamp(1.8rem,5vh,3.5rem)] font-extrabold leading-none">{ROLE_INFO[role].label}</div>
            <div className="mt-[clamp(0.5rem,1.5vh,1rem)] flex max-w-full items-center gap-2">
              <Sticker id={findP(players, id)?.avatar} size={Math.round(48 * k)} />
              <span className="min-w-0 truncate text-[clamp(1.05rem,2.6vh,1.75rem)] font-bold">{nameOf(players, id)}</span>
            </div>
            <div className="font-display mt-[clamp(0.5rem,1.5vh,1rem)] text-[clamp(2.25rem,7vh,4.75rem)] font-extrabold leading-none tabular-nums">
              +<CountUp from={0} to={pts} delay={0.6 + i * 0.12} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/** Big-screen view. Shows only what everyone may know: who picked, who announced, and the result. */
export function Screen({ view, players, now }: ScreenProps<Pub>) {
  const sfx = useSfx();
  useOnChange(view.phase, (p) => {
    if (p === "result") sfx.shared("reveal");
  });
  const raja = findP(players, view.rajaId);
  const mantri = findP(players, view.mantriId);
  const picked = Object.keys(view.taken).length;

  let main;
  if (view.phase === "pick") {
    main = (
      <div className="flex min-h-0 flex-1 flex-col gap-[clamp(0.75rem,2vh,1.5rem)]">
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <div className={tv.label}>Round {view.round}</div>
            <h2 className={tv.headline}>Ek chit uthao!</h2>
            <p className={`${tv.lead} text-muted`}>Raja, Mantri, Chor ya Sipahi — andar likha hai. {picked}/4 ne utha li.</p>
          </div>
          <div className="w-[clamp(14rem,24vw,22rem)] shrink-0">
            <TvTimer deadline={view.pickDeadline} total={PICK_MS} now={now} label="Chit uthane ka time" compact />
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <TvChitTable view={view} players={players} />
        </div>
      </div>
    );
  } else if (view.phase === "raja") {
    main = (
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-[clamp(1rem,5vh,3.5rem)] text-center">
        <div>
          <div className={tv.label}>Round {view.round}</div>
          <h2 className={tv.headline}>Raja kaun hai?</h2>
          <p className={`${tv.lead} mt-2 text-muted`}>Sabne chit utha li. Raja, phone pe bolo: “Main Raja hoon!”</p>
        </div>
        <TvPeople className="!flex-nowrap">
          {view.seats.map((id) => {
            const p = findP(players, id);
            return <TvPerson key={id} player={p} size="md" status="chit li ✓" dim={p?.connected === false} />;
          })}
        </TvPeople>
      </div>
    );
  } else if (view.phase === "mantri") {
    main = (
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-[clamp(1rem,3.5vh,2.5rem)]">
        <div className="flex items-center justify-center gap-[clamp(1rem,3vw,3rem)]">
          <TvCard className="flex items-center gap-4 px-6 py-3" style={{ background: ROLE_PAPER.raja.bg }} tilt={-1.5}>
            <RoleGlyph role="raja" size={44} />
            <div>
              <div className="text-[clamp(0.85rem,1.9vh,1.3rem)] font-bold uppercase tracking-[0.18em] opacity-70">Raja</div>
              <div className="font-display text-[clamp(1.6rem,4.4vh,3rem)] font-extrabold leading-none">{raja?.name ?? "Koi"}</div>
            </div>
          </TvCard>
          <TvCard className="flex items-center gap-4 px-6 py-3" style={{ background: ROLE_PAPER.mantri.bg, color: ROLE_PAPER.mantri.fg }} tilt={1.2}>
            <RoleGlyph role="mantri" size={44} />
            <div>
              <div className="text-[clamp(0.85rem,1.9vh,1.3rem)] font-bold uppercase tracking-[0.18em] opacity-80">Mantri</div>
              <div className="font-display text-[clamp(1.6rem,4.4vh,3rem)] font-extrabold leading-none">{mantri?.name ?? "Koi"}</div>
            </div>
          </TvCard>
        </div>
        <div className="text-center">
          <h2 className={tv.headline}>“Chor kaun hai?”</h2>
          <p className={`${tv.lead} mt-1 text-muted`}>{mantri?.name ?? "Mantri"} soch rahe hain — in dono mein se ek Chor hai.</p>
        </div>
        <TvPeople className="!flex-nowrap !gap-[clamp(3rem,8vw,8rem)]">
          {view.suspects.map((id) => (
            <TvPerson key={id} player={findP(players, id)} size="lg" />
          ))}
        </TvPeople>
      </div>
    );
  } else {
    const caught = !!view.correct;
    main = (
      <div className="flex min-h-0 flex-1 flex-col gap-[clamp(0.75rem,2vh,1.5rem)]">
        <div className="flex items-center justify-between gap-6">
          <div className="min-w-0">
            <div className={tv.label}>Round {view.round} · result</div>
            <h2 className={tv.title}>{caught ? `${mantri?.name ?? "Mantri"} ne Chor ko pakad liya!` : `Chor bach nikle! ${mantri?.name ?? "Mantri"} ke 800 Chor ko.`}</h2>
          </div>
          <motion.div className="shrink-0 pt-3" initial={{ scale: 1.7, opacity: 0, rotate: -14 }} animate={{ scale: 1, opacity: 1, rotate: -5, transition: { ...spring.settle, delay: 0.9 } }}>
            <VerdictSlip tone={caught ? "leaf" : "vermilion"} seed={view.round * 7}>
              {caught ? "Pakde gaye!" : "Bach nikle!"}
            </VerdictSlip>
          </motion.div>
        </div>
        <Unfolded view={view} players={players} />
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <InkDefs />
      <div className="sr-only" aria-live="polite">
        {view.phase === "result" ? (view.correct ? "Chor pakde gaye" : "Chor bach nikle") : view.phase === "mantri" ? `${raja?.name ?? "Raja"} Raja hain. ${mantri?.name ?? "Mantri"} Chor dhoondh rahe hain.` : ""}
      </div>
      <TvFrame side={<TvLeaderboard players={players} scores={view.scores} ids={view.seats} gains={view.phase === "result" ? view.lastPoints : undefined} title="Kul points" />}>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${view.round}-${view.phase}`}
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: dur.screen, ease: ease.out } }}
            exit={{ opacity: 0, y: -8, transition: { duration: dur.screenExit, ease: ease.in } }}
          >
            {main}
          </motion.div>
        </AnimatePresence>
      </TvFrame>
    </MotionConfig>
  );
}
