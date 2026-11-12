"use client";
import { ArrowDown, Megaphone, Pointer } from "lucide-react";
import { MotionConfig, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { screenIn, spring } from "@/components/paper/motion";
import { InkDefs } from "@/components/paper/objects";
import { PaperSheet } from "@/components/paper/Paper";
import { ResultsCard } from "@/components/ResultsCard";
import { summarizeGame } from "@/lib/results";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import { vibrate } from "@/lib/sfx";
import type { PhoneProps, Player } from "@/lib/types";
import type { PunoCard } from "./shared";
import {
  CardBack,
  CardFace,
  ColorSwatch,
  MiniCardBack,
  NeoButton,
  TAG_CAPS,
  pilePose,
} from "./Cards";
import type { Priv, Pub, PunoColor } from "./shared";

const nameOf = (players: Player[], id: string) => players.find((p) => p.id === id)?.name ?? "Khiladi";

const TABLE_GRID: CSSProperties = {
  backgroundColor: "var(--bg-2)",
  backgroundImage: `
    linear-gradient(color-mix(in srgb, var(--ink) 7%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--ink) 7%, transparent) 1px, transparent 1px)
  `,
  backgroundSize: "22px 22px",
};

function DiscardSpread({ top, under, wildColor }: { top: PunoCard; under: PunoCard[]; wildColor: PunoColor | null }) {
  const layers = under.slice(-5);
  return (
    <div className="relative h-[108px] w-[130px]" aria-label="Discard pile">
      {layers.map((c, i) => {
        const pose = pilePose(c.id, i + 1);
        return (
          <div
            key={c.id}
            className="pointer-events-none absolute left-1/2 top-1/2"
            style={{
              transform: `translate(calc(-50% + ${pose.x}px), calc(-50% + ${pose.y}px)) rotate(${pose.rotate}deg) scale(${pose.scale})`,
              zIndex: i + 1,
            }}
          >
            <CardFace card={c} wildTint={wildColor} size="pile" />
          </div>
        );
      })}
      <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
        <CardFace card={top} wildTint={wildColor} size="pile" />
      </div>
    </div>
  );
}

function TurnSticker({ myTurn, name }: { myTurn: boolean; name: string }) {
  if (myTurn) {
    return (
      <motion.div
        initial={{ rotate: -6 }}
        animate={{ rotate: [-6, -4, -6] }}
        transition={{ duration: 2.2, repeat: Infinity }}
        className="absolute right-2 top-2 z-30 border-[3px] border-ink bg-vermilion px-3 py-2 font-display text-sm font-extrabold uppercase tracking-wide text-ink shadow-[5px_5px_0_0_var(--ink)]"
      >
        Teri baari!
      </motion.div>
    );
  }
  return (
    <div className="absolute right-2 top-2 z-30 max-w-[48%] border-[3px] border-ink bg-paper px-2 py-1.5 text-right font-display text-[10px] font-extrabold uppercase leading-tight tracking-wide shadow-[4px_4px_0_0_var(--ink)]">
      {name}
    </div>
  );
}

function PlayTable({
  view,
  myTurn,
  turnName,
  onDraw,
  left,
}: {
  view: Pub;
  myTurn: boolean;
  turnName: string;
  onDraw?: () => void;
  left: number;
}) {
  return (
    <div className="relative min-h-[200px] shrink-0 overflow-hidden border-b-[3px] border-ink px-3 pb-4 pt-3" style={TABLE_GRID}>
      <TurnSticker myTurn={myTurn} name={turnName} />
      <div
        className={`absolute left-3 top-3 border-[3px] border-ink px-2 py-0.5 font-display text-xs font-extrabold tabular-nums shadow-[3px_3px_0_0_var(--ink)] ${
          left <= 5 ? "bg-vermilion text-paper" : "bg-paper text-ink"
        }`}
        role="timer"
      >
        0:{String(left).padStart(2, "0")}
      </div>
      <motion.div
        animate={{ rotate: view.direction === 1 ? 0 : 180 }}
        className="absolute left-3 bottom-3 rounded-md border-[3px] border-ink bg-turmeric p-1.5 text-ink shadow-[3px_3px_0_0_var(--ink)]"
        aria-label="Direction"
      >
        <ArrowDown className="h-4 w-4" strokeWidth={3} />
      </motion.div>
      <div className="flex items-end justify-center gap-6 pt-10">
        <CardBack size="pile" onClick={onDraw} />
        <DiscardSpread top={view.top} under={view.discardUnder} wildColor={view.wildColor} />
      </div>
      {view.stackPending && (
        <div className="absolute bottom-3 right-1/4 z-30 border-[3px] border-ink bg-vermilion px-2 py-1 font-display text-[10px] font-extrabold uppercase text-paper shadow-[4px_4px_0_0_var(--ink)]">
          +{view.stackTotal}
        </div>
      )}
    </div>
  );
}

function PlayerFooter({
  seats,
  players,
  meId,
  counts,
  turnPlayerId,
  ekBacha,
}: {
  seats: Pub["seats"];
  players: Player[];
  meId: string;
  counts: Record<string, number>;
  turnPlayerId: string;
  ekBacha: Pub["ekBacha"];
}) {
  const others = seats.filter((s) => s.playerId !== meId);
  return (
    <footer className="shrink-0 border-t-[3px] border-ink bg-ink px-2 py-2">
      <div className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {others.map((s) => {
          const p = players.find((x) => x.id === s.playerId);
          const on = s.playerId === turnPlayerId;
          const oneLeft = counts[s.playerId] === 1;
          const catchMe = ekBacha?.playerId === s.playerId;
          return (
            <div
              key={s.playerId}
              className={`relative flex min-w-[5.5rem] shrink-0 items-center gap-1.5 border-[2px] bg-paper px-1.5 py-1 ${
                on ? "border-turmeric shadow-[0_0_0_2px_var(--turmeric)]" : "border-ink"
              }`}
            >
              <MiniCardBack />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[10px] font-extrabold uppercase leading-tight">{p?.name ?? "…"}</div>
                <div className="font-display text-[11px] font-extrabold tabular-nums">{counts[s.playerId] ?? 0}</div>
              </div>
              {(oneLeft || catchMe) && (
                <span className="absolute -top-2 right-0 border border-ink bg-turmeric px-1 text-[7px] font-extrabold uppercase text-ink">Ek!</span>
              )}
            </div>
          );
        })}
      </div>
    </footer>
  );
}

function ColorPicker({ open, onPick, onClose }: { open: boolean; onPick: (c: PunoColor) => void; onClose: () => void }) {
  const colors: PunoColor[] = ["haldi", "sindoor", "mehndi", "neel"];
  return (
    <PaperSheet open={open} onClose={onClose} title="RANG CHUNO">
      <div className="grid grid-cols-1 gap-3 p-1">
        {colors.map((c) => (
          <ColorSwatch key={c} color={c} label={TAG_CAPS[c]} onClick={() => onPick(c)} />
        ))}
      </div>
    </PaperSheet>
  );
}

function fanLayout(n: number, i: number) {
  const spread = n <= 5 ? 11 : n <= 8 ? 7.5 : n <= 11 ? 5.5 : 4;
  const start = -((n - 1) * spread) / 2;
  const rot = start + i * spread;
  const tuck = n <= 7 ? -22 : n <= 10 ? -18 : -14;
  return { rot, tuck };
}

function SwipeableCard({
  card,
  playable,
  selected,
  onPick,
  onThrow,
  wildTint,
  rotate,
  marginLeft,
}: {
  card: PunoCard;
  playable: boolean;
  selected: boolean;
  onPick: () => void;
  onThrow: () => void;
  wildTint?: PunoColor | null;
  rotate: number;
  marginLeft: number;
}) {
  const y = useMotionValue(0);
  const scale = useTransform(y, [-140, 0], [0.9, 1]);
  const onEnd = (_: unknown, info: PanInfo) => {
    if (selected && info.offset.y < -72) onThrow();
    else y.set(0);
  };
  return (
    <motion.div
      style={{ y, scale, rotate, marginLeft, zIndex: selected ? 40 : undefined, transformOrigin: "50% 120%" }}
      className="shrink-0"
      drag={selected ? "y" : false}
      dragConstraints={{ top: -180, bottom: 0 }}
      dragElastic={0.12}
      onDragEnd={onEnd}
    >
      <CardFace card={card} wildTint={wildTint} size="hero" dim={!playable} selected={selected} onClick={playable ? onPick : undefined} />
    </motion.div>
  );
}

export function Phone({ view, priv, me, players, send, now }: PhoneProps<Pub, Priv>) {
  const hand = priv?.hand ?? [];
  const playable = new Set(priv?.playable ?? []);
  const jumpable = new Set(priv?.jumpable ?? []);
  const myTurn = view.turnPlayerId === me.id;
  const [picked, setPicked] = useState<string | null>(null);
  const [wildPick, setWildPick] = useState<{ cardId: string; mode: "play" | "jump" } | null>(null);
  const [sheet, setSheet] = useState<"help" | null>(null);
  const [scrollHint, setScrollHint] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sfx = useSfx();
  const left = Math.max(0, Math.ceil((view.deadline - now) / 1000));
  const turnName = nameOf(players, view.turnPlayerId);
  const tuck = fanLayout(hand.length, 0).tuck;

  useOnChange(view.turnPlayerId, (id) => {
    if (id === me.id) {
      vibrate([30, 40, 30]);
      sfx.mine("pop");
    }
  });

  useEffect(() => {
    if (!myTurn) setPicked(null);
  }, [myTurn, view.turn]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setScrollHint(el.scrollWidth > el.clientWidth + 8);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hand.length]);

  const ekGlow = myTurn && hand.length === 2;
  const catchTarget = view.ekBacha && view.ekBacha.playerId !== me.id && !view.ekBachaSaid.includes(view.ekBacha.playerId);
  const jumpReady = !myTurn && jumpable.size > 0;

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
      <motion.div {...screenIn} className="space-y-4 p-3">
        <InkDefs />
        <ResultsCard result={result} />
        <p className="text-center text-p-body text-muted">Host lobby mein agla game chun sakte hain.</p>
      </motion.div>
    );
  }

  return (
    <MotionConfig transition={spring.settle}>
      <InkDefs />
      <motion.div {...screenIn} className="mx-auto flex min-h-dvh w-full max-w-[393px] flex-col bg-bg">
        {view.note && now - view.note.at < 4000 && (
          <div className="shrink-0 border-b-[3px] border-ink bg-card px-3 py-1.5 text-center text-[10px] font-extrabold uppercase">{view.note.text}</div>
        )}

        <PlayTable view={view} myTurn={myTurn} turnName={turnName} onDraw={myTurn ? () => send("draw") : undefined} left={left} />

        {jumpReady && (
          <p className="shrink-0 bg-turmeric/40 py-1 text-center text-[10px] font-extrabold uppercase tracking-wide">Jump-in · tap matching card</p>
        )}

        <section aria-label="Your hand" className="relative mt-auto min-h-0 flex-1">
          <motion.div
            ref={scrollRef}
            className="relative flex h-full min-h-[42vh] items-end overflow-x-auto overflow-y-visible pb-[18vh] pt-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{
              maskImage: scrollHint
                ? "linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)"
                : undefined,
            }}
          >
            <motion.div className="mx-auto flex items-end justify-start px-4 pr-16" style={{ minWidth: hand.length > 8 ? `${hand.length * 42}px` : "100%" }}>
              {hand.map((card, i) => {
                const can = playable.has(card.id) || jumpable.has(card.id);
                const { rot } = fanLayout(hand.length, i);
                return (
                  <SwipeableCard
                    key={card.id}
                    card={card}
                    playable={can}
                    selected={picked === card.id}
                    wildTint={view.wildColor}
                    rotate={rot}
                    marginLeft={i === 0 ? 0 : tuck}
                    onPick={() => setPicked((p) => (p === card.id ? null : card.id))}
                    onThrow={onThrowPicked}
                  />
                );
              })}
            </motion.div>
          </motion.div>

          {scrollHint && hand.length > 9 && (
            <span className="pointer-events-none absolute bottom-[20vh] right-3 border-2 border-ink bg-paper px-1.5 py-0.5 text-[10px] font-extrabold shadow-[3px_3px_0_0_var(--ink)]">
              +{hand.length - 9}
            </span>
          )}

          <div className="pointer-events-none absolute bottom-[19vh] right-0 z-50 flex flex-col gap-2 p-2">
            <div className="pointer-events-auto flex flex-col gap-2">
              <NeoButton className="!min-h-9 !px-2 !text-[10px]" variant={ekGlow ? "turmeric" : "paper"} onClick={() => send("ek-bacha")}>
                <Megaphone className="mr-0.5 inline h-3.5 w-3.5" /> Ek Bacha!
              </NeoButton>
              {catchTarget && (
                <NeoButton className="!min-h-9 !px-2 !text-[10px]" variant="vermilion" onClick={() => send("pakdo", { who: view.ekBacha!.playerId })}>
                  <Pointer className="mr-0.5 inline h-3.5 w-3.5" /> Pakdo!
                </NeoButton>
              )}
              <button type="button" className="text-right text-[9px] font-bold uppercase text-muted underline" onClick={() => setSheet("help")}>
                Hint
              </button>
            </div>
          </div>
        </section>

        <PlayerFooter
          seats={view.seats}
          players={players}
          meId={me.id}
          counts={view.counts}
          turnPlayerId={view.turnPlayerId}
          ekBacha={view.ekBacha}
        />

        <PaperSheet open={sheet === "help"} onClose={() => setSheet(null)} title="PUNO">
          <ul className="list-disc space-y-2 pl-5 text-p-note font-semibold">
            <li>Match pile colour or number. Stack Do Le / Chaar Le or draw the full stack.</li>
            <li>Tap a card, swipe up to play. Deck (left) to draw on your turn.</li>
            <li>Shout Ek Bacha! at one card; Pakdo! if someone forgets.</li>
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
