"use client";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import { CardBack, CardFace, FAN_CARD, TABLE_CARD } from "./Cards";
import { fanSpring, throwSpring } from "./springs";
import type { PunoCard, PunoColor } from "./shared";

export type FlightKind = "throw" | "inbound" | "draw-self" | "draw-other";

export interface CardFlightRequest {
  key: string;
  kind: FlightKind;
  card?: PunoCard;
  wildTint?: PunoColor | null;
  from: { x: number; y: number };
  to: { x: number; y: number };
  startRotate?: number;
  vx?: number;
  vy?: number;
  flip?: boolean;
  size?: "fan" | "pile";
  onComplete?: () => void;
}

function flightTransition(speed: number, reduce: boolean): Transition {
  if (reduce) return { duration: 0.12 };
  const clamped = Math.min(1400, Math.max(280, speed || 700));
  return {
    type: "spring",
    stiffness: 300 + clamped * 0.16,
    damping: 22 + clamped * 0.012,
    mass: 0.85,
  };
}

function spinFromVelocity(vx: number, vy: number, base: number) {
  const spin = vx * 0.045 + vy * 0.018;
  return base + Math.max(-72, Math.min(72, spin));
}

function OneFlight({ spec, onDone }: { spec: CardFlightRequest; onDone: () => void }) {
  const reduce = useReducedMotion();
  const speed = Math.hypot(spec.vx ?? 0, spec.vy ?? -650);
  const w = spec.size === "fan" ? FAN_CARD.w : TABLE_CARD.w;
  const h = spec.size === "fan" ? FAN_CARD.h : TABLE_CARD.h;
  const spin = spinFromVelocity(spec.vx ?? 0, spec.vy ?? 0, spec.startRotate ?? 0);
  const landSpin = spin + (spec.kind === "inbound" ? ((spec.card?.id.charCodeAt(0) ?? 0) % 15) - 7 : 14);
  const needsBounce = spec.kind === "inbound" || spec.kind === "throw";

  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-[300]"
      style={{ width: w, height: h, perspective: 900 }}
      initial={
        reduce
          ? { opacity: 1, x: spec.from.x - w / 2, y: spec.from.y - h / 2 }
          : {
              x: spec.from.x - w / 2,
              y: spec.from.y - h / 2,
              rotate: spec.startRotate ?? 0,
              scale: spec.size === "fan" ? 1.05 : 1,
              opacity: 1,
            }
      }
      animate={
        reduce
          ? { opacity: 0 }
          : {
              x: spec.to.x - w / 2,
              y: spec.to.y - h / 2,
              rotate: landSpin,
              scale: spec.kind === "throw" ? 0.84 : spec.kind === "draw-other" ? 0.52 : 0.96,
            }
      }
      transition={flightTransition(speed, !!reduce)}
      onAnimationComplete={onDone}
    >
      <motion.div
        className="h-full w-full"
        animate={needsBounce && !reduce ? { y: [0, -4, 0] } : undefined}
        transition={needsBounce && !reduce ? { delay: 0.28, duration: 0.2, times: [0, 0.5, 1] } : undefined}
      >
        <FaceOrBack spec={spec} reduce={!!reduce} />
      </motion.div>
    </motion.div>
  );
}

function FaceOrBack({ spec, reduce }: { spec: CardFlightRequest; reduce: boolean }) {
  if (spec.flip && !reduce) {
    return (
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        initial={{ rotateY: 0 }}
        animate={{ rotateY: 180 }}
        transition={{ duration: 0.38, ease: [0.35, 0.9, 0.35, 1], delay: 0.12 }}
      >
        <motion.div className="absolute inset-0 h-full w-full" style={{ backfaceVisibility: "hidden" }}>
          <CardBack size="pile" />
        </motion.div>
        <div className="absolute inset-0 h-full w-full" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          {spec.card ? <CardFace card={spec.card} wildTint={spec.wildTint} size={spec.size ?? "fan"} /> : <CardBack size="pile" />}
        </div>
      </motion.div>
    );
  }
  if (spec.card && (spec.kind === "inbound" || spec.kind === "throw" || spec.kind === "draw-self")) {
    return <CardFace card={spec.card} wildTint={spec.wildTint} size={spec.size ?? "pile"} />;
  }
  return <CardBack size="pile" />;
}

export function CardFlightLayer({ queue, pop }: { queue: CardFlightRequest[]; pop: (key: string) => void }) {
  const active = queue[0];
  return (
    <AnimatePresence>
      {active && (
        <OneFlight
          key={active.key}
          spec={active}
          onDone={() => {
            active.onComplete?.();
            pop(active.key);
          }}
        />
      )}
    </AnimatePresence>
  );
}

export function throwFromPan(
  vx: number,
  vy: number,
  offsetX: number,
  offsetY: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  startRotate: number,
  card: PunoCard,
  wildTint: PunoColor | null | undefined,
  onComplete: () => void,
): CardFlightRequest | null {
  const speed = Math.hypot(vx, vy);
  const far = offsetY < -76;
  const flickUp = offsetY < -40 && vy < -260;
  const slingshot = offsetY < -52 && speed > 480;
  const powerFlick = speed > 620 && offsetY < -34;
  if (!(far || flickUp || slingshot || powerFlick)) return null;

  const dirX = vx * 0.065 + offsetX * 0.28;
  const dirY = vy * 0.05 + offsetY * 0.42;
  const tx = to.x + Math.max(-32, Math.min(38, dirX * 0.14));
  const ty = to.y + Math.max(-22, Math.min(26, dirY * 0.1));
  return {
    key: `throw-${card.id}-${Date.now()}`,
    kind: "throw",
    card,
    wildTint,
    from,
    to: { x: tx, y: ty },
    startRotate,
    vx,
    vy,
    size: "fan",
    onComplete,
  };
}

export function centerOf(el: HTMLElement | null) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export { fanSpring, throwSpring };
