"use client";
import { ArrowDown, Megaphone, Pointer } from "lucide-react";
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
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
  CardFace,
  ColorSwatch,
  DeckStack,
  FAN_CARD,
  MiniCardBack,
  NeoButton,
  TAG_CAPS,
  radialPose,
} from "./Cards";
import { fanSpring, pileSpring, slapSpring, snapSpring, throwSpring } from "./springs";
import type { Priv, Pub, PunoColor } from "./shared";

const nameOf = (players: Player[], id: string) => players.find((p) => p.id === id)?.name ?? "Khiladi";

const TABLE_GRID: CSSProperties = {
  backgroundColor: "var(--bg-2)",
  backgroundImage: `
    linear-gradient(color-mix(in srgb, var(--ink) 8%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--ink) 8%, transparent) 1px, transparent 1px)
  `,
  backgroundSize: "20px 20px",
};

function Sparkle({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className={className} aria-hidden>
      <path fill="currentColor" d="M8 0 L9.2 6.8 L16 8 L9.2 9.2 L8 16 L6.8 9.2 L0 8 L6.8 6.8 Z" />
    </svg>
  );
}

function DiscardSpread({ top, under, wildColor, pulse }: { top: PunoCard; under: PunoCard[]; wildColor: PunoColor | null; pulse?: boolean }) {
  const layers = under.slice(-9);
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="relative h-[138px] w-[148px]"
      aria-label="Discard pile"
      animate={pulse && !reduce ? { scale: [1, 1.04, 1] } : undefined}
      transition={{ duration: 0.35 }}
    >
      {layers.map((c, i) => {
        const pose = radialPose(c.id, i, layers.length + 1);
        return (
          <motion.div
            key={c.id}
            layout={false}
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            initial={false}
            animate={{ x: pose.x, y: pose.y, rotate: pose.rotate, scale: pose.scale }}
            transition={pileSpring}
            style={{ zIndex: pose.zIndex }}
          >
            <CardFace card={c} wildTint={wildColor} size="pile" />
          </motion.div>
        );
      })}
      <div className="absolute left-1/2 top-1/2 z-[30] -translate-x-1/2 -translate-y-1/2">
        <CardFace card={top} wildTint={wildColor} size="pile" />
      </div>
    </motion.div>
  );
}

function TurnSticker({ myTurn }: { myTurn: boolean }) {
  const reduce = useReducedMotion();
  if (!myTurn) return null;
  return (
    <motion.div
      key="my-turn"
      initial={reduce ? { opacity: 0 } : { rotate: -18, scale: 0.7, opacity: 0 }}
      animate={reduce ? { opacity: 1 } : { rotate: -7, scale: 1, opacity: 1 }}
      transition={slapSpring}
      className="absolute right-2 top-2 z-30 border-[3px] border-ink bg-vermilion px-3 py-1.5 font-display text-xs font-extrabold uppercase tracking-wide text-ink shadow-[5px_5px_0_0_var(--ink)]"
    >
      Teri baari!
    </motion.div>
  );
}

function StackBadge({ total }: { total: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={total}
      initial={reduce ? undefined : { scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={slapSpring}
      className="absolute bottom-2 right-[18%] z-30 border-[3px] border-ink bg-vermilion px-2.5 py-1 font-display text-xs font-extrabold uppercase text-paper shadow-[4px_4px_0_0_var(--ink)]"
    >
      +{total}
    </motion.div>
  );
}

function PlayTable({
  view,
  myTurn,
  turnName,
  onDraw,
  left,
  noteText,
  noteVisible,
  wildPulse,
}: {
  view: Pub;
  myTurn: boolean;
  turnName: string;
  onDraw?: () => void;
  left: number;
  noteText?: string;
  noteVisible: boolean;
  wildPulse: boolean;
}) {
  return (
    <div className="relative min-h-0 flex-[0.42] overflow-hidden border-b-[3px] border-ink px-2 pb-3 pt-2" style={TABLE_GRID}>
      <Sparkle className="absolute left-2 top-2 z-20 text-ink" />
      <Sparkle className="absolute right-[38%] top-1 z-20 text-ink opacity-80" />
      <TurnSticker myTurn={myTurn} />
      {!myTurn && (
        <div className="absolute right-2 top-2 z-20 max-w-[44%] border-[3px] border-ink bg-paper px-2 py-1 text-right font-display text-[9px] font-extrabold uppercase leading-tight shadow-[4px_4px_0_0_var(--ink)]">
          {turnName}
        </div>
      )}
      <div
        className={`absolute left-2 top-9 border-[3px] border-ink px-2 py-0.5 font-display text-[11px] font-extrabold tabular-nums shadow-[3px_3px_0_0_var(--ink)] ${
          left <= 5 ? "bg-vermilion text-paper" : "bg-paper text-ink"
        }`}
        role="timer"
      >
        0:{String(left).padStart(2, "0")}
      </div>
      <motion.div
        animate={{ rotate: view.direction === 1 ? 0 : 180 }}
        transition={snapSpring}
        className="absolute bottom-2 left-2 rounded-md border-[3px] border-ink bg-turmeric p-1.5 text-ink shadow-[3px_3px_0_0_var(--ink)]"
        aria-label="Direction"
      >
        <ArrowDown className="h-4 w-4" strokeWidth={3} />
      </motion.div>
      <AnimatePresence>
        {noteVisible && noteText && (
          <motion.div
            key={noteText}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute left-1/2 top-[38%] z-40 max-w-[92%] -translate-x-1/2 border-[3px] border-ink bg-card/95 px-2 py-1 text-center font-display text-[9px] font-extrabold uppercase shadow-[3px_3px_0_0_var(--ink)]"
          >
            {noteText}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex h-full items-end justify-center gap-4 pb-1 pt-12">
        <DeckStack onClick={onDraw} />
        <DiscardSpread top={view.top} under={view.discardUnder} wildColor={view.wildColor} pulse={wildPulse} />
      </div>
      {view.stackPending && view.stackTotal > 0 && <StackBadge total={view.stackTotal} />}
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
    <footer className="z-50 shrink-0 border-t-[3px] border-ink bg-ink px-2 py-2.5">
      <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {others.map((s) => {
          const p = players.find((x) => x.id === s.playerId);
          const on = s.playerId === turnPlayerId;
          const oneLeft = counts[s.playerId] === 1;
          const catchMe = ekBacha?.playerId === s.playerId;
          return (
            <div
              key={s.playerId}
              className={`relative flex min-w-[6.5rem] shrink-0 items-center gap-2 rounded-md border-[2.5px] bg-paper px-2 py-1.5 ${
                on ? "border-turmeric shadow-[0_0_0_2px_var(--turmeric)]" : "border-paper"
              }`}
            >
              <MiniCardBack />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[10px] font-extrabold uppercase leading-tight text-ink">{p?.name ?? "…"}</div>
                <div className="font-display text-xs font-extrabold tabular-nums text-ink">{counts[s.playerId] ?? 0}</div>
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
  const reduce = useReducedMotion();
  return (
    <PaperSheet open={open} onClose={onClose} title="RANG CHUNO">
      <motion.div
        initial={reduce ? undefined : { y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={snapSpring}
        className="grid grid-cols-1 gap-3 p-1"
      >
        {colors.map((c) => (
          <ColorSwatch key={c} color={c} label={TAG_CAPS[c]} onClick={() => onPick(c)} />
        ))}
      </motion.div>
    </PaperSheet>
  );
}

function fanAngle(n: number, i: number) {
  if (n <= 1) return 0;
  const t = i / (n - 1);
  return -20 + t * 40;
}

function fanOverlap(n: number) {
  if (n <= 4) return -FAN_CARD.w * 0.52;
  if (n <= 7) return -FAN_CARD.w * 0.58;
  return -FAN_CARD.w * 0.62;
}

type FlyState = { cardId: string; mode: "play" | "jump"; wildColor?: PunoColor } | null;

function SwipeableCard({
  card,
  playable,
  selected,
  onPick,
  onBeginThrow,
  wildTint,
  rotate,
  marginLeft,
  selectedLift,
  resetDrag,
  flying,
}: {
  card: PunoCard;
  playable: boolean;
  selected: boolean;
  onPick: () => void;
  onBeginThrow: (vx: number, vy: number) => void;
  wildTint?: PunoColor | null;
  rotate: number;
  marginLeft: number;
  selectedLift: boolean;
  resetDrag: number;
  flying: boolean;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const dragRotate = useTransform(y, [-160, 0], [rotate - 6, rotate]);

  useEffect(() => {
    x.set(0);
    y.set(0);
  }, [resetDrag, x, y]);

  const onEnd = (_: unknown, info: PanInfo) => {
    if (!selected || flying) {
      animate(y, 0, reduce ? { duration: 0.15 } : throwSpring);
      return;
    }
    const speed = Math.hypot(info.velocity.x, info.velocity.y);
    if (info.offset.y < -64 || (info.velocity.y < -420 && info.offset.y < -28)) {
      onBeginThrow(info.velocity.x, info.velocity.y);
      return;
    }
    animate(y, 0, reduce ? { duration: 0.15 } : fanSpring);
    if (speed > 80) animate(x, 0, fanSpring);
  };

  const lift = selected && selectedLift ? -28 : 0;
  const scale = selected ? 1.04 : 1;

  return (
    <motion.div
      style={{ x, y, rotate: reduce ? rotate : dragRotate, marginLeft, zIndex: selected ? 50 : undefined, transformOrigin: "50% 115%" }}
      className="shrink-0"
      drag={selected && !flying ? true : false}
      dragConstraints={{ top: -200, bottom: 12, left: -40, right: 40 }}
      dragElastic={0.14}
      onDragEnd={onEnd}
      animate={
        flying
          ? reduce
            ? { opacity: 0 }
            : { y: -240, x: 110, rotate: rotate + 18, scale: 0.78, opacity: 0.35 }
          : { scale, y: lift }
      }
      transition={flying ? throwSpring : fanSpring}
    >
      <CardFace card={card} wildTint={wildTint} size="fan" dim={!playable} selected={selected && selectedLift} onClick={playable ? onPick : undefined} />
    </motion.div>
  );
}

export function Phone({ view, priv, me, players, send, now }: PhoneProps<Pub, Priv>) {
  const hand = priv?.hand ?? [];
  const playable = new Set(priv?.playable ?? []);
  const jumpable = new Set(priv?.jumpable ?? []);
  const canPass = priv?.canPass ?? false;
  const myTurn = view.turnPlayerId === me.id;
  const [picked, setPicked] = useState<string | null>(null);
  const [wildPick, setWildPick] = useState<{ cardId: string; mode: "play" | "jump" } | null>(null);
  const [sheet, setSheet] = useState<"help" | null>(null);
  const [scrollHint, setScrollHint] = useState(false);
  const [dragReset, setDragReset] = useState(0);
  const [fly, setFly] = useState<FlyState>(null);
  const [wildPulse, setWildPulse] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fanX = useMotionValue(0);
  const reduce = useReducedMotion();
  const sfx = useSfx();
  const left = Math.max(0, Math.ceil((view.deadline - now) / 1000));
  const turnName = nameOf(players, view.turnPlayerId);
  const overlap = fanOverlap(hand.length);

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
    if (wildPick) setDragReset((n) => n + 1);
  }, [wildPick]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setScrollHint(el.scrollWidth > el.clientWidth + 4);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hand.length]);

  const ekGlow = myTurn && hand.length === 2;
  const catchTarget = view.ekBacha && view.ekBacha.playerId !== me.id && !view.ekBachaSaid.includes(view.ekBacha.playerId);
  const jumpReady = !myTurn && jumpable.size > 0;
  const noteVisible = !!(view.note && now - view.note.at < 3800);
  const noteText = view.note?.text;

  const result = useMemo(() => (view.phase === "over" ? summarizeGame("puno", view, players, now) : null), [view, players, now]);

  const completeThrow = (cardId: string, mode: "play" | "jump", wildColor?: PunoColor) => {
    send(mode, { cardId, wildColor });
    setPicked(null);
    setFly(null);
    sfx.mine("whoosh");
    vibrate(20);
  };

  const throwCard = (cardId: string, mode: "play" | "jump", wildColor?: PunoColor) => {
    const card = hand.find((c) => c.id === cardId);
    if (!card) return;
    if (card.color === "wild" && !wildColor && !wildPick) {
      setWildPick({ cardId, mode });
      return;
    }
    setFly({ cardId, mode, wildColor });
    window.setTimeout(() => completeThrow(cardId, mode, wildColor), reduce ? 120 : 420);
  };

  const onBeginThrow = (cardId: string, vx: number, vy: number) => {
    const mode: "play" | "jump" = jumpable.has(cardId) && !myTurn ? "jump" : "play";
    const card = hand.find((c) => c.id === cardId);
    if (!card) return;
    if (card.color === "wild") {
      setWildPick({ cardId, mode });
      return;
    }
    throwCard(cardId, mode);
    void vx;
    void vy;
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

  const overflowN = Math.max(0, hand.length - Math.floor(393 / (FAN_CARD.w + overlap)));

  return (
    <MotionConfig transition={spring.settle}>
      <InkDefs />
      <motion.div {...screenIn} className="flex h-full min-h-0 w-full max-w-[393px] flex-col overflow-hidden bg-bg">
        <PlayTable
          view={view}
          myTurn={myTurn}
          turnName={turnName}
          onDraw={myTurn ? () => send("draw") : undefined}
          left={left}
          noteText={noteText}
          noteVisible={noteVisible}
          wildPulse={wildPulse}
        />

        {jumpReady && (
          <p className="shrink-0 bg-turmeric/35 py-0.5 text-center text-[9px] font-extrabold uppercase tracking-wide">Jump · tap match</p>
        )}

        <section aria-label="Your hand" className="relative z-10 -mb-[72px] min-h-0 flex-[0.48] overflow-hidden">
          <motion.div
            ref={scrollRef}
            className="flex h-full w-full items-end overflow-x-auto overflow-y-visible pb-[78px] pt-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            drag={hand.length > 5 ? "x" : false}
            dragConstraints={{ left: -Math.max(0, hand.length * 48 - 360), right: 0 }}
            style={{ x: fanX }}
            dragElastic={0.08}
          >
            <div className="mx-auto flex items-end justify-start px-3 pr-24" style={{ minWidth: hand.length > 5 ? `${hand.length * (FAN_CARD.w + overlap + 8)}px` : "100%" }}>
              {hand.map((card, i) => {
                const can = playable.has(card.id) || jumpable.has(card.id);
                const rot = fanAngle(hand.length, i);
                const isFlying = fly?.cardId === card.id;
                return (
                  <SwipeableCard
                    key={card.id}
                    card={card}
                    playable={can}
                    selected={picked === card.id}
                    wildTint={view.wildColor}
                    rotate={rot}
                    marginLeft={i === 0 ? 0 : overlap}
                    selectedLift={!isFlying}
                    resetDrag={dragReset}
                    flying={isFlying}
                    onPick={() => setPicked((p) => (p === card.id ? null : card.id))}
                    onBeginThrow={(vx, vy) => onBeginThrow(card.id, vx, vy)}
                  />
                );
              })}
            </div>
          </motion.div>

          {scrollHint && overflowN > 0 && (
            <span className="pointer-events-none absolute bottom-[86px] left-2 border-2 border-ink bg-paper px-1.5 py-0.5 text-[10px] font-extrabold shadow-[3px_3px_0_0_var(--ink)]">
              +{overflowN} · swipe
            </span>
          )}

          <div className="pointer-events-none absolute bottom-[82px] right-1 z-50 flex flex-col items-end gap-1.5">
            <div className="pointer-events-auto flex flex-col items-stretch gap-1.5">
              {canPass && (
                <NeoButton className="!min-h-9 !px-3 !text-[11px]" variant="ink" onClick={() => send("pass")}>
                  Pass
                </NeoButton>
              )}
              <NeoButton className="!min-h-9 !px-2 !text-[10px]" variant={ekGlow ? "turmeric" : "paper"} onClick={() => send("ek-bacha")}>
                <Megaphone className="mr-0.5 inline h-3.5 w-3.5" /> Ek Bacha!
              </NeoButton>
              {catchTarget && (
                <NeoButton className="!min-h-9 !px-2 !text-[10px]" variant="vermilion" onClick={() => send("pakdo", { who: view.ekBacha!.playerId })}>
                  <Pointer className="mr-0.5 inline h-3.5 w-3.5" /> Pakdo!
                </NeoButton>
              )}
              <button type="button" className="self-end text-[9px] font-bold uppercase text-ink underline" onClick={() => setSheet("help")}>
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
            <li>Match colour or number. Stack Do Le / Chaar Le or draw full stack.</li>
            <li>Tap card, swipe up to play. Deck to draw. Pass after draw if nothing fits.</li>
            <li>Ek Bacha! at one card; Pakdo! if someone forgets.</li>
          </ul>
        </PaperSheet>

        <ColorPicker
          open={!!wildPick}
          onClose={() => {
            setWildPick(null);
            setDragReset((n) => n + 1);
          }}
          onPick={(c) => {
            if (!wildPick) return;
            setWildPulse(true);
            window.setTimeout(() => setWildPulse(false), 400);
            throwCard(wildPick.cardId, wildPick.mode, c);
            setWildPick(null);
          }}
        />
      </motion.div>
    </MotionConfig>
  );
}
