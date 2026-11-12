"use client";
import { ArrowDown, Hand, Megaphone, Pointer } from "lucide-react";
import { MotionConfig, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { screenIn, spring } from "@/components/paper/motion";
import { InkDefs } from "@/components/paper/objects";
import { PaperButton, PaperSheet, Sticker } from "@/components/paper/Paper";
import { ResultsCard } from "@/components/ResultsCard";
import { summarizeGame } from "@/lib/results";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import { vibrate } from "@/lib/sfx";
import type { PhoneProps, Player } from "@/lib/types";
import { CardFace } from "./Cards";
import type { Priv, Pub, PunoColor } from "./shared";
import { COLOR_INK, COLOR_LABEL } from "./shared";

const nameOf = (players: Player[], id: string) => players.find((p) => p.id === id)?.name ?? "Khiladi";

function TableStrip({ view, players, meId }: { view: Pub; players: Player[]; meId: string }) {
  return (
    <section className="cut paper-rule rounded-soft bg-paper p-3">
      <div className="flex items-center justify-between gap-2">
        <motion.div layout className="flex items-center gap-2">
          <CardFace card={view.top} wildTint={view.wildColor} small />
          <motion.div animate={{ rotate: view.direction === 1 ? 0 : 180 }} className="text-ink" aria-label="Direction">
            <ArrowDown className="h-6 w-6" strokeWidth={2.4} />
          </motion.div>
        </motion.div>
        {view.stackPending && (
          <div className="rounded-cut border-[1.5px] border-vermilion bg-vermilion/10 px-3 py-1 font-display text-p-lead font-extrabold text-vermilion">
            Stack: {view.stackTotal}
          </div>
        )}
      </div>
      <ul className="mt-3 space-y-1 text-p-note">
        {view.seats.map((s) => {
          const p = players.find((x) => x.id === s.playerId);
          const mine = s.playerId === meId;
          return (
            <li key={s.playerId} className={`flex items-center justify-between gap-2 rounded-cut px-2 py-1 ${view.turnPlayerId === s.playerId ? "bg-turmeric/30 font-bold" : ""}`}>
              <span className="flex min-w-0 items-center gap-2 truncate">
                {p && <Sticker id={p.avatar} size={26} />}
                {nameOf(players, s.playerId)}
                {mine && " (tum)"}
              </span>
              <span className="font-display tabular-nums">{view.counts[s.playerId] ?? 0} cards</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ColorPicker({ open, onPick, onClose }: { open: boolean; onPick: (c: PunoColor) => void; onClose: () => void }) {
  const colors: PunoColor[] = ["haldi", "sindoor", "mehndi", "neel"];
  return (
    <PaperSheet open={open} onClose={onClose} title="Rang chuno">
      <div className="grid grid-cols-2 gap-3 p-1">
        {colors.map((c) => (
          <PaperButton key={c} tone="paper" className="w-full" onClick={() => onPick(c)}>
            <span className="mr-2 inline-block h-4 w-4 rounded-full border border-ink" style={{ background: COLOR_INK[c] }} />
            {COLOR_LABEL[c]}
          </PaperButton>
        ))}
      </div>
    </PaperSheet>
  );
}

function SwipeableCard({
  card,
  playable,
  selected,
  onPick,
  onThrow,
  wildTint,
}: {
  card: Pub["top"];
  playable: boolean;
  selected: boolean;
  onPick: () => void;
  onThrow: () => void;
  wildTint?: PunoColor | null;
}) {
  const y = useMotionValue(0);
  const scale = useTransform(y, [-120, 0], [0.92, 1]);
  const opacity = useTransform(y, [-140, -40], [0.35, 1]);
  const onEnd = (_: unknown, info: PanInfo) => {
    if (selected && info.offset.y < -80) onThrow();
    else y.set(0);
  };
  return (
    <motion.div style={{ y, scale, opacity }} drag={selected ? "y" : false} dragConstraints={{ top: -160, bottom: 0 }} dragElastic={0.2} onDragEnd={onEnd}>
      <CardFace card={card} wildTint={wildTint} dim={!playable} selected={selected} onClick={playable ? onPick : undefined} />
    </motion.div>
  );
}

export function Phone({ view, priv, me, players, send, now, tvOn = false }: PhoneProps<Pub, Priv>) {
  const hand = priv?.hand ?? [];
  const playable = new Set(priv?.playable ?? []);
  const jumpable = new Set(priv?.jumpable ?? []);
  const myTurn = view.turnPlayerId === me.id;
  const showTable = !tvOn;
  const [picked, setPicked] = useState<string | null>(null);
  const [wildPick, setWildPick] = useState<{ cardId: string; mode: "play" | "jump" } | null>(null);
  const [sheet, setSheet] = useState<"help" | null>(null);
  const sfx = useSfx();
  const left = Math.max(0, Math.ceil((view.deadline - now) / 1000));

  useOnChange(view.turnPlayerId, (id) => {
    if (id === me.id) {
      vibrate([30, 40, 30]);
      sfx.mine("pop");
    }
  });

  useEffect(() => {
    if (!myTurn) setPicked(null);
  }, [myTurn, view.turn]);

  const ekGlow = myTurn && hand.length === 2;
  const catchTarget = view.ekBacha && view.ekBacha.playerId !== me.id && !view.ekBachaSaid.includes(view.ekBacha.playerId);

  const result = useMemo(() => (view.phase === "over" ? summarizeGame("puno", view, players, now) : null), [view, players, now]);

  const throwCard = (cardId: string, mode: "play" | "jump", wildColor?: PunoColor) => {
    send(mode, { cardId, wildColor });
    setPicked(null);
    sfx.mine("whoosh");
    vibrate(20);
  };

  const onThrowPicked = () => {
    if (!picked) return;
    const card = hand.find((c) => c.id === picked);
    if (!card) return;
    const mode: "play" | "jump" = jumpable.has(picked) && !myTurn ? "jump" : "play";
    if (card.color === "wild" && !wildPick) {
      setWildPick({ cardId: picked, mode });
      return;
    }
    throwCard(picked, mode);
  };

  if (view.phase === "over") {
    return (
      <motion.div {...screenIn} className="space-y-4">
        <InkDefs />
        <ResultsCard result={result} />
        <p className="text-center text-p-body text-muted">Host lobby mein agla game chun sakte hain.</p>
      </motion.div>
    );
  }

  return (
    <MotionConfig transition={spring.settle}>
      <InkDefs />
      <motion.div {...screenIn} className="mx-auto flex w-full max-w-[393px] flex-col gap-3 pb-6">
        <header className="flex items-center justify-between gap-2">
          <motion.div animate={myTurn ? { scale: [1, 1.03, 1] } : {}} transition={{ duration: 1.2, repeat: myTurn ? Infinity : 0 }}>
            <span className={`font-display text-p-title font-extrabold ${myTurn ? "text-leaf" : "text-ink"}`}>{myTurn ? "Tumhari baari" : `${nameOf(players, view.turnPlayerId)} ki baari`}</span>
          </motion.div>
          <div className={`cut rounded-cut px-2 py-1 font-display text-p-lead font-bold tabular-nums ${left <= 5 ? "bg-vermilion text-paper" : "bg-paper"}`} role="timer" aria-label={`${left} seconds`}>
            0:{String(left).padStart(2, "0")}
          </div>
        </header>

        {view.note && now - view.note.at < 5000 && (
          <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="cut rounded-cut border border-ink bg-card px-3 py-2 text-p-note font-bold">
            {view.note.text}
          </motion.p>
        )}

        {showTable && <TableStrip view={view} players={players} meId={me.id} />}

        <section aria-label="Your hand" className="relative">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-p-note font-bold uppercase tracking-widest text-muted">Tumhare cards ({hand.length})</span>
            <button type="button" className="text-p-note font-bold text-muted underline" onClick={() => setSheet("help")}>
              Hint
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-3 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {hand.map((card) => {
              const can = playable.has(card.id) || jumpable.has(card.id);
              return (
                <SwipeableCard
                  key={card.id}
                  card={card}
                  playable={can}
                  selected={picked === card.id}
                  wildTint={view.wildColor}
                  onPick={() => setPicked((p) => (p === card.id ? null : card.id))}
                  onThrow={onThrowPicked}
                />
              );
            })}
          </div>
          <p className="text-center text-p-note text-muted">Card chuno, phir upar swipe karke pile par daalo.</p>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <PaperButton tone="paper" disabled={!myTurn} onClick={() => send("draw")} className="w-full">
            <Hand className="mr-1 inline h-4 w-4" /> Deck se lo
          </PaperButton>
          <PaperButton
            tone={ekGlow ? "turmeric" : "paper"}
            className={`w-full ${ekGlow ? "shadow-[0_0_0_3px_var(--leaf)]" : ""}`}
            onClick={() => send("ek-bacha")}
          >
            <Megaphone className="mr-1 inline h-4 w-4" /> Ek Bacha!
          </PaperButton>
        </div>

        {catchTarget && (
          <PaperButton tone="vermilion" className="w-full" onClick={() => send("pakdo", { who: view.ekBacha!.playerId })}>
            <Pointer className="mr-1 inline h-4 w-4" /> Pakdo! ({nameOf(players, view.ekBacha!.playerId)})
          </PaperButton>
        )}

        {!myTurn && jumpable.size > 0 && (
          <p className="cut rounded-cut bg-turmeric/25 px-3 py-2 text-center text-p-note font-bold">Jump-in: identical card chuno aur swipe karo</p>
        )}

        <PaperSheet open={sheet === "help"} onClose={() => setSheet(null)} title="Puno">
          <ul className="list-disc space-y-2 pl-5 text-p-note">
            <li>Rang ya number match karo. Stack chal raha ho to Do Le / Chaar Le stack karo ya poora kheench lo.</li>
            <li>1 card par aa kar &quot;Ek Bacha!&quot; bulana mat bhoolna.</li>
            <li>Same card jump-in kar sakte ho jab kisi aur ki baari ho.</li>
          </ul>
        </PaperSheet>

        <ColorPicker
          open={!!wildPick}
          onClose={() => setWildPick(null)}
          onPick={(c) => {
            if (!wildPick) return;
            throwCard(wildPick.cardId, wildPick.mode, c);
            setWildPick(null);
          }}
        />
      </motion.div>
    </MotionConfig>
  );
}
