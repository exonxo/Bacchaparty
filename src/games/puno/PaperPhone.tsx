"use client";
import { ArrowDown, Megaphone, Pointer } from "lucide-react";
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefCallback } from "react";
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
  fanMessyOffset,
  seedDecorativePile,
} from "./Cards";
import { CardFlightLayer, centerOf, throwFromPan, type CardFlightRequest } from "./CardFlight";
import { fanSpring, pileSpring, slapSpring, snapSpring } from "./springs";
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

function DiscardSpread({
  top,
  under,
  wildColor,
  pulse,
  pileRef,
}: {
  top: PunoCard;
  under: PunoCard[];
  wildColor: PunoColor | null;
  pulse?: boolean;
  pileRef: RefCallback<HTMLDivElement>;
}) {
  const layers = useMemo(() => {
    const merged = under.length >= 5 ? under : [...seedDecorativePile(top), ...under];
    return merged.slice(-10);
  }, [top, under]);
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={pileRef}
      className="relative h-[138px] w-[148px]"
      aria-label="Discard pile"
      animate={pulse && !reduce ? { scale: [1, 1.05, 0.98, 1] } : undefined}
      transition={{ duration: 0.38 }}
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
  deckRef,
  pileRef,
}: {
  view: Pub;
  myTurn: boolean;
  turnName: string;
  onDraw?: () => void;
  left: number;
  noteText?: string;
  noteVisible: boolean;
  wildPulse: boolean;
  deckRef: RefCallback<HTMLDivElement>;
  pileRef: RefCallback<HTMLDivElement>;
}) {
  return (
    <div className="relative min-h-0 shrink-0 overflow-visible px-2 pb-0 pt-1">
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
      <AnimatePresence mode="wait">
        {noteVisible && noteText && (
          <motion.div
            key={view.note?.at ?? noteText}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="pointer-events-none absolute left-1/2 top-[34%] z-40 max-w-[90%] -translate-x-1/2 border-[3px] border-ink bg-card px-2 py-1 text-center font-display text-[9px] font-extrabold uppercase shadow-[3px_3px_0_0_var(--ink)]"
          >
            {noteText}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex min-h-[8.25rem] items-end justify-center gap-3 pb-0 pt-3">
        <DeckStack innerRef={deckRef} onClick={onDraw} />
        <DiscardSpread top={view.top} under={view.discardUnder} wildColor={view.wildColor} pulse={wildPulse} pileRef={pileRef} />
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
  setChipRef,
  countPulse,
}: {
  seats: Pub["seats"];
  players: Player[];
  meId: string;
  counts: Record<string, number>;
  turnPlayerId: string;
  ekBacha: Pub["ekBacha"];
  setChipRef: (id: string, el: HTMLDivElement | null) => void;
  countPulse: string | null;
}) {
  return (
    <footer data-testid="puno-footer" className="z-50 mt-auto shrink-0 border-t-[3px] border-ink bg-ink px-2 py-2">
      <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {seats.map((s) => {
          const p = players.find((x) => x.id === s.playerId);
          const on = s.playerId === turnPlayerId;
          const oneLeft = counts[s.playerId] === 1;
          const catchMe = ekBacha?.playerId === s.playerId;
          return (
            <div
              key={s.playerId}
              ref={(el) => setChipRef(s.playerId, el)}
              className={`relative flex min-w-[6rem] shrink-0 items-center gap-2 rounded-md border-[2.5px] bg-paper px-2 py-1.5 ${
                s.playerId === meId ? "border-ink ring-1 ring-ink/20" : on ? "border-turmeric shadow-[0_0_0_2px_var(--turmeric)]" : "border-paper"
              }`}
            >
              <MiniCardBack />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[10px] font-extrabold uppercase leading-tight text-ink">{p?.name ?? "…"}</div>
                <motion.div
                  key={`${s.playerId}-${counts[s.playerId] ?? 0}`}
                  animate={countPulse === s.playerId ? { scale: [1, 1.35, 1] } : undefined}
                  transition={{ duration: 0.35 }}
                  className="font-display text-xs font-extrabold tabular-nums text-ink"
                >
                  {counts[s.playerId] ?? 0}
                </motion.div>
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

function SwipeableCard({
  card,
  playable,
  selected,
  onPick,
  onThrowPan,
  wildTint,
  rotate,
  marginLeft,
  messyY,
  selectedLift,
  resetDrag,
  hidden,
  shellRef,
}: {
  card: PunoCard;
  playable: boolean;
  selected: boolean;
  onPick: () => void;
  onThrowPan: (el: HTMLDivElement, vx: number, vy: number, offsetX: number, offsetY: number) => boolean;
  wildTint?: PunoColor | null;
  rotate: number;
  marginLeft: number;
  messyY: number;
  selectedLift: boolean;
  resetDrag: number;
  hidden: boolean;
  shellRef: RefCallback<HTMLDivElement>;
}) {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const dragRotate = useTransform(y, [-160, 0], [rotate - 8, rotate]);

  useEffect(() => {
    x.set(0);
    y.set(0);
  }, [resetDrag, x, y]);

  const springBack = () => {
    animate(x, 0, reduce ? { duration: 0.14 } : fanSpring);
    animate(y, 0, reduce ? { duration: 0.14 } : fanSpring);
  };

  const onEnd = (_: unknown, info: PanInfo) => {
    if (!selected || hidden) {
      springBack();
      return;
    }
    const el = rootRef.current;
    if (!el) {
      springBack();
      return;
    }
    const ok = onThrowPan(el, info.velocity.x, info.velocity.y, info.offset.x, info.offset.y);
    if (ok) {
      x.set(0);
      y.set(0);
    } else springBack();
  };

  const lift = selected && selectedLift ? -28 : 0;
  const scale = selected ? 1.05 : 1;

  return (
    <motion.div
      ref={(node) => {
        rootRef.current = node;
        shellRef(node);
      }}
      style={{
        x,
        y,
        rotate: reduce ? rotate : dragRotate,
        marginLeft,
        marginTop: messyY,
        zIndex: selected ? 50 : undefined,
        transformOrigin: "50% 92%",
        opacity: hidden ? 0 : 1,
      }}
      className={`shrink-0 ${selected ? "touch-none" : "touch-pan-x"}`}
      drag={selected && !hidden ? "y" : false}
      dragDirectionLock
      dragConstraints={{ top: -200, bottom: 12, left: 0, right: 0 }}
      dragElastic={0.12}
      onDragEnd={onEnd}
      animate={{ scale, y: hidden ? lift : lift }}
      transition={fanSpring}
    >
      <CardFace card={card} wildTint={wildTint} size="fan" dim={!playable} selected={selected && selectedLift} onClick={playable ? onPick : undefined} />
    </motion.div>
  );
}

export function Phone({ view, priv, me, players, send, now }: PhoneProps<Pub, Priv>) {
  const hand = useMemo(() => priv?.hand ?? [], [priv?.hand]);
  const handKey = useMemo(() => hand.map((c) => c.id).join("|"), [hand]);
  const playable = new Set(priv?.playable ?? []);
  const jumpable = new Set(priv?.jumpable ?? []);
  const canPass = priv?.canPass ?? false;
  const myTurn = view.turnPlayerId === me.id;
  const [picked, setPicked] = useState<string | null>(null);
  const [wildPick, setWildPick] = useState<{ cardId: string; mode: "play" | "jump"; vx?: number; vy?: number } | null>(null);
  const [sheet, setSheet] = useState<"help" | null>(null);
  const [scrollHint, setScrollHint] = useState(false);
  const [dragReset, setDragReset] = useState(0);
  const [flights, setFlights] = useState<CardFlightRequest[]>([]);
  const [hiddenCards, setHiddenCards] = useState<Set<string>>(() => new Set());
  const [wildPulse, setWildPulse] = useState(false);
  const [countPulse, setCountPulse] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const deckEl = useRef<HTMLDivElement | null>(null);
  const pileEl = useRef<HTMLDivElement | null>(null);
  const chipEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const cardEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastPlayId = useRef<number | null>(null);
  const lastDrawKey = useRef("");
  const prevHandIds = useRef<string[]>([]);
  const pendingSelfDraw = useRef(false);
  const reduce = useReducedMotion();
  const sfx = useSfx();
  const left = Math.max(0, Math.ceil((view.deadline - now) / 1000));
  const turnName = nameOf(players, view.turnPlayerId);
  const overlap = fanOverlap(hand.length);

  const deckRef: RefCallback<HTMLDivElement> = useCallback((el) => {
    deckEl.current = el;
  }, []);
  const pileRef: RefCallback<HTMLDivElement> = useCallback((el) => {
    pileEl.current = el;
  }, []);

  const setChipRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) chipEls.current.set(id, el);
    else chipEls.current.delete(id);
  }, []);

  const enqueue = useCallback((req: CardFlightRequest) => {
    setFlights((q) => [...q, req]);
  }, []);

  const popFlight = useCallback((key: string) => {
    setFlights((q) => q.filter((x) => x.key !== key));
  }, []);

  const fanCenter = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width * 0.45, y: r.bottom - 48 };
  }, []);

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

  // Inbound plays from other players
  useEffect(() => {
    const lp = view.lastPlay;
    if (!lp || lp.playerId === me.id) return;
    if (lastPlayId.current === lp.id) return;
    lastPlayId.current = lp.id;
    const from = centerOf(chipEls.current.get(lp.playerId) ?? null);
    const to = centerOf(pileEl.current);
    if (!from || !to) return;
    const vx = (to.x - from.x) * 0.65;
    const vy = -720 - Math.abs(to.x - from.x) * 0.2;
    enqueue({
      key: `inbound-${lp.id}`,
      kind: "inbound",
      card: lp.card,
      wildTint: lp.wildColor,
      from,
      to,
      vx,
      vy,
      size: "pile",
      onComplete: () => setWildPulse(true),
    });
    window.setTimeout(() => setWildPulse(false), 420);
  }, [view.lastPlay, me.id, enqueue]);

  // Other players drawing
  useEffect(() => {
    const n = view.note;
    if (!n || n.kind !== "draw" || n.playerId === me.id) return;
    const key = `${n.at}-${n.playerId}`;
    if (lastDrawKey.current === key) return;
    lastDrawKey.current = key;
    const from = centerOf(deckEl.current);
    const to = centerOf(chipEls.current.get(n.playerId) ?? null);
    if (!from || !to) return;
    enqueue({
      key: `draw-other-${key}`,
      kind: "draw-other",
      from,
      to,
      vx: (to.x - from.x) * 0.4,
      vy: 520,
      size: "pile",
      onComplete: () => {
        setCountPulse(n.playerId);
        window.setTimeout(() => setCountPulse(null), 380);
      },
    });
  }, [view.note, me.id, enqueue]);

  // Self draw: animate new card from deck into fan
  useEffect(() => {
    const ids = hand.map((c) => c.id);
    const prev = new Set(prevHandIds.current);
    const added = ids.filter((id) => !prev.has(id));
    prevHandIds.current = ids;

    if (!pendingSelfDraw.current || added.length === 0) return;
    pendingSelfDraw.current = false;
    const card = hand.find((c) => c.id === added[added.length - 1]);
    if (!card) return;
    const from = centerOf(deckEl.current);
    if (!from) return;
    const flyIn = () => {
      const el = cardEls.current.get(card.id);
      const scroller = scrollRef.current;
      if (el && scroller) {
        const target = el.offsetLeft - scroller.clientWidth / 2 + el.clientWidth / 2;
        scroller.scrollTo({ left: Math.max(0, target), behavior: reduce ? "auto" : "smooth" });
      }
      const launch = () => {
        const slot = centerOf(cardEls.current.get(card.id) ?? null) ?? fanCenter();
        if (!slot) return;
        enqueue({
          key: `draw-self-${card.id}`,
          kind: "draw-self",
          card,
          from,
          to: slot,
          flip: true,
          vy: -200,
          size: "fan",
        });
      };
      window.setTimeout(launch, reduce ? 60 : 300);
    };
    requestAnimationFrame(flyIn);
  }, [hand, handKey, enqueue, fanCenter, reduce]);

  useEffect(() => {
    if (lastPlayId.current === null && view.lastPlay) lastPlayId.current = view.lastPlay.id;
  }, [view.lastPlay]);

  const ekGlow = myTurn && hand.length === 2;
  const catchTarget = view.ekBacha && view.ekBacha.playerId !== me.id && !view.ekBachaSaid.includes(view.ekBacha.playerId);
  const jumpReady = !myTurn && jumpable.size > 0;
  const noteVisible = !!(view.note && now - view.note.at < 3800);
  const noteText = view.note?.text;

  const result = useMemo(() => (view.phase === "over" ? summarizeGame("puno", view, players, now) : null), [view, players, now]);

  const sendPlay = (cardId: string, mode: "play" | "jump", wildColor?: PunoColor) => {
    send(mode, { cardId, wildColor });
    setPicked(null);
    setHiddenCards((s) => {
      const n = new Set(s);
      n.delete(cardId);
      return n;
    });
    sfx.mine("whoosh");
    vibrate(20);
  };

  const queueThrow = (card: PunoCard, mode: "play" | "jump", vx: number, vy: number, el: HTMLDivElement, wildColor?: PunoColor) => {
    const from = centerOf(el);
    const to = centerOf(pileEl.current);
    if (!from || !to) return;
    const req = throwFromPan(
      vx,
      vy,
      0,
      -72,
      from,
      to,
      fanAngle(hand.length, hand.findIndex((c) => c.id === card.id)),
      card,
      wildColor ?? view.wildColor,
      () => sendPlay(card.id, mode, wildColor),
    );
    if (!req) return;
    setHiddenCards((s) => new Set(s).add(card.id));
    enqueue(req);
  };

  const onThrowPan = (cardId: string, el: HTMLDivElement | null, vx: number, vy: number, offsetX: number, offsetY: number): boolean => {
    if (!el) return false;
    const mode: "play" | "jump" = jumpable.has(cardId) && !myTurn ? "jump" : "play";
    const card = hand.find((c) => c.id === cardId);
    if (!card) return false;

    const from = centerOf(el);
    const to = centerOf(pileEl.current);
    if (!from || !to) return false;

    if (card.color === "wild") {
      const qualifies =
        offsetY < -76 ||
        (offsetY < -40 && vy < -260) ||
        (offsetY < -52 && Math.hypot(vx, vy) > 480) ||
        (Math.hypot(vx, vy) > 620 && offsetY < -34);
      if (qualifies) {
        setWildPick({ cardId, mode, vx, vy });
        setDragReset((n) => n + 1);
      }
      return false;
    }

    const startRot = fanAngle(hand.length, hand.findIndex((c) => c.id === cardId));
    const req = throwFromPan(vx, vy, offsetX, offsetY, from, to, startRot, card, view.wildColor, () => sendPlay(cardId, mode, undefined));
    if (!req) return false;
    setHiddenCards((s) => new Set(s).add(cardId));
    enqueue(req);
    return true;
  };

  const handleDraw = () => {
    if (!myTurn) return;
    pendingSelfDraw.current = true;
    send("draw");
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
      <motion.div {...screenIn} className="flex h-full min-h-0 w-full max-w-[393px] flex-col overflow-hidden bg-bg-2 pb-0">
        <div className="relative grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden" style={TABLE_GRID}>
          <PlayTable
            view={view}
            myTurn={myTurn}
            turnName={turnName}
            onDraw={myTurn ? handleDraw : undefined}
            left={left}
            noteText={noteText}
            noteVisible={noteVisible && !myTurn}
            wildPulse={wildPulse}
            deckRef={deckRef}
            pileRef={pileRef}
          />

          {jumpReady && (
            <p className="pointer-events-none absolute left-0 right-0 top-[32%] z-20 py-0.5 text-center text-[9px] font-extrabold uppercase tracking-wide text-ink/80">
              Jump · tap match
            </p>
          )}

          <div className="z-20 flex shrink-0 flex-col gap-1.5 px-2 py-1">
            {canPass && (
              <NeoButton className="!min-h-8 w-full !px-2 !text-[10px]" variant="ink" onClick={() => send("pass")}>
                Pass
              </NeoButton>
            )}
            {ekGlow && (
              <NeoButton className="!min-h-8 w-full !px-2 !text-[10px]" variant="turmeric" onClick={() => send("ek-bacha")}>
                <Megaphone className="mr-0.5 inline h-3.5 w-3.5" /> Ek Bacha!
              </NeoButton>
            )}
            {catchTarget && (
              <NeoButton className="!min-h-8 w-full !px-2 !text-[10px]" variant="vermilion" onClick={() => send("pakdo", { who: view.ekBacha!.playerId })}>
                <Pointer className="mr-0.5 inline h-3.5 w-3.5" /> Pakdo!
              </NeoButton>
            )}
            <button type="button" className="w-fit text-left text-[9px] font-bold uppercase text-ink underline" onClick={() => setSheet("help")}>
              Hint
            </button>
          </div>

          <section aria-label="Your cards" className="relative z-10 min-h-0 overflow-hidden">
          <div
            ref={scrollRef}
            className="flex h-full w-full touch-pan-x items-end overflow-x-auto overflow-y-visible overscroll-x-contain px-3 pb-2 pt-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <motion.div
              className="mx-auto flex items-end justify-start pl-2 pr-20"
              style={{ minWidth: hand.length > 4 ? `${hand.length * (FAN_CARD.w + overlap + 14)}px` : "100%" }}
              animate={reduce ? undefined : { rotate: [0, 0.32, 0, -0.32, 0] }}
              transition={reduce ? undefined : { duration: 6.8, repeat: Infinity, ease: "easeInOut" }}
            >
              {hand.map((card, i) => {
                const can = playable.has(card.id) || jumpable.has(card.id);
                const messy = fanMessyOffset(card.id, i);
                const rot = fanAngle(hand.length, i) + messy.rotate;
                const shellRef: RefCallback<HTMLDivElement> = (el) => {
                  if (el) cardEls.current.set(card.id, el);
                  else cardEls.current.delete(card.id);
                };
                return (
                  <SwipeableCard
                    key={card.id}
                    card={card}
                    playable={can}
                    selected={picked === card.id}
                    wildTint={view.wildColor}
                    rotate={rot}
                    marginLeft={(i === 0 ? 0 : overlap) + messy.x}
                    messyY={messy.y}
                    selectedLift={!hiddenCards.has(card.id)}
                    resetDrag={dragReset}
                    hidden={hiddenCards.has(card.id)}
                    shellRef={shellRef}
                    onPick={() => setPicked((p) => (p === card.id ? null : card.id))}
                    onThrowPan={(el, vx, vy, ox, oy) => onThrowPan(card.id, el, vx, vy, ox, oy)}
                  />
                );
              })}
            </motion.div>
          </div>

          {scrollHint && overflowN > 0 && (
            <span className="pointer-events-none absolute right-3 top-0 z-20 border-2 border-ink bg-paper px-1.5 py-0.5 text-[9px] font-extrabold shadow-[2px_2px_0_0_var(--ink)]">
              +{overflowN} · swipe
            </span>
          )}
        </section>
        </div>

        <PlayerFooter
          seats={view.seats}
          players={players}
          meId={me.id}
          counts={view.counts}
          turnPlayerId={view.turnPlayerId}
          ekBacha={view.ekBacha}
          setChipRef={setChipRef}
          countPulse={countPulse}
        />

        <CardFlightLayer queue={flights} pop={popFlight} />

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
            const card = hand.find((x) => x.id === wildPick.cardId);
            const el = cardEls.current.get(wildPick.cardId);
            if (card && el) {
              queueThrow(card, wildPick.mode, wildPick.vx ?? 0, wildPick.vy ?? -800, el, c);
            } else if (card) {
              sendPlay(card.id, wildPick.mode, c);
            }
            setWildPulse(true);
            window.setTimeout(() => setWildPulse(false), 420);
            setWildPick(null);
          }}
        />
      </motion.div>
    </MotionConfig>
  );
}
