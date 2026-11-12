"use client";
import { motion } from "motion/react";
import { TvLabel, TvPodium, TvStage, tv, type TvRow } from "@/components/paper/tv-a";
import { TvBoard } from "@/components/paper/tv-b";
import type { Player, ScreenProps } from "@/lib/types";
import { CardFace, DeckStack } from "./Cards";
import type { Pub } from "./shared";

const nameOf = (players: Player[], id: string) => players.find((p) => p.id === id)?.name ?? "Khiladi";

export function TvScreen({ view, players, now }: ScreenProps<Pub>) {
  const note = view.note && now - view.note.at < 6000 ? view.note : null;
  if (view.phase === "over") {
    const rows: TvRow[] = view.ranking.flatMap((id, i) => {
      const p = players.find((x) => x.id === id);
      return p ? [{ p, s: view.ranking.length - i, sub: `${view.counts[id] ?? 0} cards bachi` }] : [];
    });
    const winner = players.find((p) => p.id === view.winner);
    return (
      <TvStage className="grid-rows-[auto_1fr]">
        <h1 className={`font-display text-center font-extrabold uppercase text-ink ${tv.title}`}>{winner ? `${winner.name} jeet gaye!` : "Khel khatam"}</h1>
        <TvPodium rows={rows} color="#f2b632" className="min-h-0 flex-1" />
      </TvStage>
    );
  }

  return (
    <TvStage>
      <div className="grid min-h-0 flex-1 gap-[2vh] lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col items-center justify-center gap-[3vh]">
          <div className="flex items-end gap-[4vw]">
            <motion.div
              animate={{ rotate: view.direction === 1 ? 0 : 180 }}
              className={`rounded-md border-[5px] border-ink bg-turmeric px-[1.5vw] py-[1vh] font-display font-extrabold shadow-[8px_8px_0_0_var(--ink)] ${tv.lead}`}
            >
              ↻
            </motion.div>
            <div className="relative">
              <CardFace card={view.top} wildTint={view.wildColor} size="tv" />
              {view.lastPlay && now - view.lastPlay.at < 800 && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute -right-[2vw] -top-[2vh] border-[4px] border-ink bg-leaf px-[1.2vw] py-[0.6vh] font-display text-lg font-extrabold uppercase text-paper shadow-[6px_6px_0_0_var(--ink)]"
                >
                  {view.lastPlay.jump ? "Jump!" : "Play!"}
                </motion.div>
              )}
            </div>
            <DeckStack size="tv" />
          </div>
          {view.stackPending && (
            <div className={`border-[5px] border-ink bg-vermilion px-[2vw] py-[1vh] font-display font-extrabold uppercase text-paper shadow-[8px_8px_0_0_var(--ink)] ${tv.title}`}>
              Stack {view.stackTotal}
            </div>
          )}
          {note && (
            <p className={`max-w-3xl border-[4px] border-ink bg-card px-[2vw] py-[1.2vh] text-center font-extrabold uppercase shadow-[6px_6px_0_0_var(--ink)] ${tv.lead}`}>{note.text}</p>
          )}
          {view.ekBachaSaid.length > 0 && (
            <p className={`border-[4px] border-ink bg-turmeric px-[2vw] py-[1vh] font-display font-extrabold uppercase shadow-[6px_6px_0_0_var(--ink)] ${tv.lead}`}>
              Ek Bacha!
            </p>
          )}
        </div>
        <aside className="flex min-h-0 flex-col gap-4">
          <TvLabel>Baari</TvLabel>
          <p className={`font-display font-extrabold uppercase text-[var(--blue)] ${tv.hero}`}>{nameOf(players, view.turnPlayerId)}</p>
          <div
            className={`inline-flex w-fit items-center gap-2 border-[4px] border-ink px-[1.2vw] py-[0.5vh] font-display font-extrabold tabular-nums shadow-[5px_5px_0_0_var(--ink)] ${tv.lead} ${
              view.paused ? "bg-turmeric text-ink" : "bg-paper text-ink"
            }`}
            role="timer"
          >
            {view.paused ? (
              <span className="uppercase">
                Paused 0:
                {String(
                  Math.max(0, Math.ceil((view.pauseRemainingMs ?? 0) / 1000)),
                ).padStart(2, "0")}{" "}
                · {nameOf(players, view.pausedBy ?? "")} ne roka
              </span>
            ) : (
              <span>0:{String(Math.max(0, Math.ceil((view.deadline - now) / 1000))).padStart(2, "0")}</span>
            )}
          </div>
          <TvBoard
            title="Cards bachi"
            rows={view.seats
              .map((s) => players.find((p) => p.id === s.playerId))
              .filter((p): p is Player => !!p)
              .map((p) => ({ p, score: view.counts[p.id] ?? 0, active: p.id === view.turnPlayerId, note: "cards" }))}
            max={10}
          />
        </aside>
      </div>
    </TvStage>
  );
}
