"use client";
import { Megaphone, Pointer, RotateCw } from "lucide-react";
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
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
      className="relative h-[138px] w-[148px] select-none [-webkit-tap-highlight-color:transparent]"
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
    <div className="relative flex h-full min-h-0 flex-col justify-end overflow-visible px-2 pb-0 pt-1">
      <Sparkle className="absolute left-2 top-2 z-20 text-ink" />
      <Sparkle className="absolute right-[38%] top-1 z-20 text-ink opacity-80" />
      <TurnSticker myTurn={myTurn} />
      {!myTurn && (
        <div className="absolute right-2 top-2 z-20 max-w-[44%] border-[3px] border-ink bg-paper px-2 py-1 text-right font-display text-[11px] font-extrabold uppercase leading-tight shadow-[4px_4px_0_0_var(--ink)]">
          {turnName} ki baari
        </div>
      )}
      <div
        className={`absolute left-2 top-9 z-20 flex min-h-[26px] items-center border-[3px] border-ink px-2 py-0.5 font-display text-[11px] font-extrabold tabular-nums shadow-[3px_3px_0_0_var(--ink)] ${
          left <= 5 ? "bg-vermilion text-paper" : "bg-paper text-ink"
        }`}
        role="timer"
      >
        0:{String(left).padStart(2, "0")}
      </div>
      <div
        className="absolute left-2 top-[4.25rem] z-20 flex items-center gap-1 rounded-full bg-ink/10 py-1 pl-1.5 pr-2.5 font-display text-[11px] font-extrabold uppercase tracking-wider text-ink/75"
        role="img"
        aria-label={view.direction === 1 ? "Chaal seedhi" : "Chaal ulti"}
      >
        <motion.span animate={{ scaleX: view.direction === 1 ? 1 : -1 }} transition={snapSpring} className="flex">
          <RotateCw className="h-3.5 w-3.5" strokeWidth={3} />
        </motion.span>
        {view.direction === 1 ? "Seedha" : "Ulta"}
      </div>
      <AnimatePresence mode="wait">
        {noteVisible && noteText && (
          <motion.div
            key={view.note?.at ?? noteText}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="pointer-events-none absolute left-1/2 top-[34%] z-40 max-w-[90%] -translate-x-1/2 border-[3px] border-ink bg-card px-2 py-1 text-center font-display text-[11px] font-extrabold uppercase shadow-[3px_3px_0_0_var(--ink)]"
          >
            {noteText}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex min-h-[7.5rem] flex-1 items-end justify-center gap-3 pb-0 pt-2">
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
    <footer data-testid="puno-footer" className="relative z-[400] mt-auto shrink-0 border-t-[3px] border-ink bg-ink px-1.5 py-1.5">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, seats.length)}, minmax(0, 1fr))` }}
      >
        {seats.map((s) => {
          const p = players.find((x) => x.id === s.playerId);
          const on = s.playerId === turnPlayerId;
          const oneLeft = counts[s.playerId] === 1;
          const catchMe = ekBacha?.playerId === s.playerId;
          return (
            <div
              key={s.playerId}
              ref={(el) => setChipRef(s.playerId, el)}
              className={`relative flex min-w-0 items-center gap-1 rounded-md border-[2px] bg-paper px-1 py-1 ${
                s.playerId === meId ? "border-ink ring-1 ring-ink/20" : on ? "border-turmeric shadow-[0_0_0_1px_var(--turmeric)]" : "border-paper"
              }`}
            >
              <MiniCardBack className="!h-7 !w-5" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[11px] font-extrabold uppercase leading-tight text-ink">{p?.name ?? "…"}</div>
                <motion.div
                  key={`${s.playerId}-${counts[s.playerId] ?? 0}`}
                  animate={countPulse === s.playerId ? { scale: [1, 1.35, 1] } : undefined}
                  transition={{ duration: 0.35 }}
                  className="font-display text-sm font-extrabold tabular-nums text-ink"
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
  // A gentle fan: big angles make neighbouring cards cover each other's tap area.
  return -9 + t * 18;
}

/** Horizontal distance between cards so the hand fits the phone when it can. */
function fanStep(n: number, width: number) {
  if (n <= 1) return 0;
  const fit = (width - 24 - FAN_CARD.w) / (n - 1);
  return Math.max(48, Math.min(FAN_CARD.w * 0.62, fit));
}

/**
 * One card in your hand. Gestures:
 *  - swipe up (or a quick upward flick) on a playable card throws it on the pile
 *  - sideways movement is left to the browser, which scrolls the hand
 *  - tap lifts the card; tapping the lifted card again plays it
 *  - a card you can't play shakes and the reason is shown
 */
function HandCard({
  card,
  canPlay,
  selected,
  onTap,
  onReject,
  onFling,
  wildTint,
  rotate,
  marginLeft,
  messyY,
  hidden,
  shaking,
  shellRef,
  label,
}: {
  card: PunoCard;
  canPlay: boolean;
  selected: boolean;
  onTap: () => void;
  onReject: () => void;
  onFling: (el: HTMLDivElement, vx: number, vy: number, offsetX: number, offsetY: number) => boolean;
  wildTint?: PunoColor | null;
  rotate: number;
  marginLeft: number;
  messyY: number;
  hidden: boolean;
  shaking: boolean;
  shellRef: RefCallback<HTMLDivElement>;
  label: string;
}) {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const dragRotate = useTransform(y, [-160, 0], [rotate - 6, rotate]);
  const gesture = useRef<{ id: number; x0: number; y0: number; mode: "idle" | "drag" | "pan"; samples: { x: number; y: number; t: number }[] } | null>(null);

  const springBack = () => {
    animate(x, 0, reduce ? { duration: 0.14 } : fanSpring);
    animate(y, 0, reduce ? { duration: 0.14 } : fanSpring);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (hidden) return;
    const t = performance.now();
    gesture.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, mode: "idle", samples: [{ x: e.clientX, y: e.clientY, t }] };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    g.samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (g.samples.length > 6) g.samples.shift();
    if (g.mode === "idle") {
      if (dy < -8 && Math.abs(dy) > Math.abs(dx) * 1.1) {
        if (!canPlay) {
          g.mode = "pan";
          onReject();
          return;
        }
        g.mode = "drag";
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
      } else if (Math.abs(dx) > 10) {
        g.mode = "pan";
        return;
      }
    }
    if (g.mode === "drag") {
      x.set(dx * 0.3);
      y.set(Math.min(14, dy));
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (g.mode === "drag") {
      const a = g.samples[0];
      const b = g.samples[g.samples.length - 1];
      const dt = Math.max(1, b.t - a.t);
      const vx = ((b.x - a.x) / dt) * 1000;
      const vy = ((b.y - a.y) / dt) * 1000;
      const flung = dy < -70 || (dy < -28 && vy < -500);
      if (flung && rootRef.current && onFling(rootRef.current, vx, vy, dx, dy)) {
        x.set(0);
        y.set(0);
      } else springBack();
      return;
    }
    if (g.mode === "idle" && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      if (canPlay) onTap();
      else onReject();
    }
  };

  const onPointerCancel = () => {
    if (gesture.current?.mode === "drag") springBack();
    gesture.current = null;
  };

  return (
    <motion.div
      ref={(node) => {
        rootRef.current = node;
        shellRef(node);
      }}
      role="button"
      tabIndex={hidden ? -1 : 0}
      aria-label={label}
      aria-pressed={selected}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (canPlay) onTap();
          else onReject();
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        marginLeft,
        marginTop: messyY,
        zIndex: selected ? 50 : undefined,
        opacity: hidden ? 0 : 1,
        // Sideways pans scroll the hand (browser); upward swipes come to us. No long-press menu.
        touchAction: "pan-x",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
      className="shrink-0 rounded-[18px] outline-offset-4"
      animate={{ y: selected ? -26 : 0, scale: selected ? 1.05 : 1 }}
      transition={fanSpring}
    >
      <motion.div
        style={{ x, y, rotate: reduce ? rotate : dragRotate, transformOrigin: "50% 92%" }}
        animate={shaking && !reduce ? { x: [0, -8, 8, -5, 5, 0] } : undefined}
        transition={{ duration: 0.36 }}
      >
        <CardFace card={card} wildTint={wildTint} size="fan" dim={!canPlay} selected={selected} />
      </motion.div>
    </motion.div>
  );
}

function cardLabel(card: PunoCard) {
  const colour = card.color === "wild" ? "" : `${TAG_CAPS[card.color]} `;
  const value = card.kind === "number" ? String(card.value) : String(card.value).replace("-", " ");
  return `${colour}${value}`.toLowerCase();
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
  const [handWidth, setHandWidth] = useState(360);
  const [shake, setShake] = useState<{ id: string; at: number } | null>(null);
  const [hint, setHint] = useState<{ text: string; at: number } | null>(null);
  const [, setDragReset] = useState(0);
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
  const step = fanStep(hand.length, handWidth);

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
    const check = () => setHandWidth(el.clientWidth);
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

  // Call Ek Bacha before your second-last card goes, or right after, until someone catches you.
  const ekGlow = !view.ekBachaSaid.includes(me.id) && ((myTurn && hand.length === 2) || view.ekBacha?.playerId === me.id);
  const catchTarget = view.ekBacha && view.ekBacha.playerId !== me.id && !view.ekBachaSaid.includes(view.ekBacha.playerId);
  const jumpReady = !myTurn && jumpable.size > 0;
  const pickedCard = picked ? hand.find((c) => c.id === picked && (playable.has(c.id) || jumpable.has(c.id))) ?? null : null;
  const hintVisible = !!(hint && now - hint.at < 2600);
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

  /** Plays a card: from a swipe (with its speed) or from a tap/button (default upward toss). */
  const playCard = (cardId: string, el: HTMLDivElement | null, vx = 0, vy = -900, offsetX = 0, offsetY = -100): boolean => {
    const mode: "play" | "jump" = jumpable.has(cardId) && !myTurn ? "jump" : "play";
    const card = hand.find((c) => c.id === cardId);
    if (!card) return false;
    if (card.color === "wild") {
      // The card stays in the hand until a colour is chosen.
      setWildPick({ cardId, mode, vx, vy });
      setDragReset((n) => n + 1);
      return false;
    }
    if (!el) {
      sendPlay(cardId, mode, undefined);
      return true;
    }
    const from = centerOf(el);
    const to = centerOf(pileEl.current);
    if (!from || !to) {
      sendPlay(cardId, mode, undefined);
      return true;
    }
    const startRot = fanAngle(hand.length, hand.findIndex((c) => c.id === cardId));
    const req = throwFromPan(vx, vy, offsetX, Math.min(offsetY, -90), from, to, startRot, card, view.wildColor, () => sendPlay(cardId, mode, undefined));
    if (!req) return false;
    setHiddenCards((st) => new Set(st).add(cardId));
    enqueue(req);
    return true;
  };

  /** A card that can't be played right now: shake it and say why. */
  const rejectCard = (cardId: string) => {
    const text = !myTurn
      ? jumpable.size
        ? "Jump sirf bilkul same patte se"
        : `Abhi ${turnName} ki baari hai`
      : view.stackPending
        ? `+${view.stackTotal} chal raha hai — Do Le / Chaar Le daalo ya deck se lo`
        : "Ye nahi chalega — rang ya number milao";
    setShake({ id: cardId, at: now });
    setHint({ text, at: now });
    vibrate(40);
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

  return (
    <MotionConfig transition={spring.settle}>
      <InkDefs />
      <motion.div {...screenIn} className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg-2 pb-0">
        <div className="relative grid min-h-0 flex-1 grid-rows-[minmax(0,1.05fr)_auto_minmax(0,1.25fr)] overflow-hidden" style={TABLE_GRID}>
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


          <div className="z-20 flex shrink-0 flex-wrap items-center gap-2 px-2 py-1">
            {pickedCard && (
              <NeoButton
                className="!min-h-12 flex-1 !px-3 !text-sm"
                variant="turmeric"
                onClick={() => playCard(pickedCard.id, cardEls.current.get(pickedCard.id) ?? null)}
              >
                Phenko ↑ {cardLabel(pickedCard)}
              </NeoButton>
            )}
            {canPass && (
              <NeoButton className="!min-h-12 flex-1 !px-3 !text-sm" variant="ink" onClick={() => send("pass")}>
                Pass
              </NeoButton>
            )}
            {ekGlow && (
              <NeoButton className="!min-h-12 flex-1 !px-3 !text-sm" variant="turmeric" onClick={() => send("ek-bacha")}>
                <Megaphone className="mr-1 inline h-4 w-4" /> Ek Bacha!
              </NeoButton>
            )}
            {catchTarget && (
              <NeoButton className="!min-h-12 flex-1 !px-3 !text-sm" variant="vermilion" onClick={() => send("pakdo", { who: view.ekBacha!.playerId })}>
                <Pointer className="mr-1 inline h-4 w-4" /> Pakdo!
              </NeoButton>
            )}
            {hintVisible && (
              <p role="status" className="w-full text-center font-display text-xs font-extrabold text-vermilion">
                {hint!.text}
              </p>
            )}
            {!pickedCard && !canPass && !ekGlow && !catchTarget && !hintVisible && (myTurn || jumpReady) && (
              <p className="w-full text-center font-display text-xs font-extrabold text-ink/70">
                {myTurn ? "Patta upar swipe karo · ya tap karke Phenko · deck se lo" : "Same patta hai? Upar swipe karke jump karo!"}
              </p>
            )}
          </div>

          <section aria-label="Your cards" className="relative z-10 min-h-0 overflow-hidden">
          <div
            ref={scrollRef}
            className="flex h-full w-full touch-pan-x items-end overflow-x-auto overflow-y-visible overscroll-x-contain pb-3 pl-7 pr-4 pt-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <motion.div
              className="mx-auto flex items-end justify-start pl-2 pr-20"
              style={{ minWidth: `${FAN_CARD.w + step * Math.max(0, hand.length - 1) + 8}px` }}
              animate={reduce ? undefined : { rotate: [0, 0.32, 0, -0.32, 0] }}
              transition={reduce ? undefined : { duration: 6.8, repeat: Infinity, ease: "easeInOut" }}
            >
              {hand.map((card, i) => {
                const can = playable.has(card.id) || jumpable.has(card.id);
                const messy = fanMessyOffset(card.id, i);
                const rot = fanAngle(hand.length, i) + messy.rotate * 0.4;
                const shellRef: RefCallback<HTMLDivElement> = (el) => {
                  if (el) cardEls.current.set(card.id, el);
                  else cardEls.current.delete(card.id);
                };
                return (
                  <HandCard
                    key={card.id}
                    card={card}
                    canPlay={can}
                    selected={picked === card.id}
                    wildTint={view.wildColor}
                    rotate={rot}
                    marginLeft={i === 0 ? 0 : step - FAN_CARD.w}
                    messyY={messy.y}
                    hidden={hiddenCards.has(card.id)}
                    shaking={shake?.id === card.id && now - shake.at < 600}
                    shellRef={shellRef}
                    label={`${cardLabel(card)}${can ? "" : ", abhi nahi chalega"}`}
                    onTap={() => {
                      if (picked === card.id) playCard(card.id, cardEls.current.get(card.id) ?? null);
                      else setPicked(card.id);
                    }}
                    onReject={() => rejectCard(card.id)}
                    onFling={(el, vx, vy, ox, oy) => {
                      setPicked(null);
                      return playCard(card.id, el, vx, vy, ox, oy);
                    }}
                  />
                );
              })}
            </motion.div>
          </div>

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
