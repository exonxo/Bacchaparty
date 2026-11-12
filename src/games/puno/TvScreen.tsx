"use client";
import { motion } from "motion/react";
import { TvLabel, TvPodium, TvStage, tv, type TvRow } from "@/components/paper/tv-a";
import { TvBoard } from "@/components/paper/tv-b";
import type { Player, ScreenProps } from "@/lib/types";
import { CardFace } from "./Cards";
import type { Pub } from "./shared";
import { COLOR_INK } from "./shared";

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
        <h1 className={`font-display text-center font-extrabold text-ink ${tv.title}`}>{winner ? `${winner.name} jeet gaye!` : "Khel khatam"}</h1>
        <TvPodium rows={rows} color="#f2b632" className="min-h-0 flex-1" />
      </TvStage>
    );
  }

  return (
    <TvStage>
      <div className="grid min-h-0 flex-1 gap-[2vh] lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col items-center justify-center gap-[3vh]">
          <div className="flex items-center gap-[4vw]">
            <motion.div animate={{ rotate: view.direction === 1 ? 0 : 180 }} className={`${tv.title} font-display font-extrabold`}>
              ↻
            </motion.div>
            <div className="relative">
              <CardFace card={view.top} wildTint={view.wildColor} />
              {view.lastPlay && now - view.lastPlay.at < 800 && (
                <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute -right-6 -top-6 rounded-full border-2 border-ink bg-leaf px-3 py-1 text-lg font-bold text-paper">
                  {view.lastPlay.jump ? "Jump!" : "Play"}
                </motion.div>
              )}
            </div>
            <div className="cut flex h-[7.25rem] w-[4.75rem] items-center justify-center rounded-[10px] border-[2px] border-dashed border-ink bg-paper/70 font-display text-4xl font-extrabold text-muted">
              Deck
            </div>
          </div>
          {view.stackPending && (
            <div className={`rounded-cut border-[2px] border-vermilion bg-vermilion px-6 py-3 font-display font-extrabold text-paper ${tv.title}`}>
              Stack: {view.stackTotal}
            </div>
          )}
          {note && (
            <p className={`cut max-w-3xl rounded-soft border-[2px] border-ink bg-card px-6 py-3 text-center font-bold ${tv.lead}`}>{note.text}</p>
          )}
          {view.ekBachaSaid.length > 0 && (
            <p className={`font-display font-extrabold text-leaf ${tv.lead}`}>Ek Bacha!</p>
          )}
        </div>
        <aside className="flex min-h-0 flex-col gap-4">
          <TvLabel>Baari</TvLabel>
          <p className={`font-display font-extrabold ${tv.hero}`} style={{ color: COLOR_INK.neel }}>
            {nameOf(players, view.turnPlayerId)}
          </p>
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
