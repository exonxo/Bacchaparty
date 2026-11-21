"use client";
import { Check, FlipHorizontal2, Hand, RotateCw, SkipForward, WifiOff } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { screenIn } from "@/components/paper/motion";
import { InkDefs, Stamp } from "@/components/paper/objects";
import { PaperButton } from "@/components/paper/Paper";
import { TONE_INFO } from "@/content/spin-bottle";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import type { PhoneProps } from "@/lib/types";
import { REACTIONS, type Priv, type Pub } from "./logic";
import { BottleCircle, KIND_PAPER, PromptCard, ReactionFloat, ReportButton, findP, nameOf } from "./parts";
import { useBottleRefill } from "./refill";

function useWidth() {
  const [w, setW] = useState(320);
  useEffect(() => {
    const on = () => setW(Math.min(window.innerWidth - 32, 420));
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

export function Phone({ view, priv, me, players, send, now, isHost, hostAct }: PhoneProps<Pub, Priv>) {
  const { shared, mine } = useSfx();
  const width = useWidth();
  useBottleRefill(view, isHost, hostAct);

  const isTarget = view.target === me.id;
  const holderHere = !!view.holder && players.some((p) => p.id === view.holder && p.connected);
  const canSpin = view.phase === "ready" && (view.holder === me.id || !holderHere || isHost);
  const targetName = nameOf(players, view.target);
  const targetGone = !!view.target && (view.phase === "choose" || view.phase === "card") && !findP(players, view.target)?.connected;
  const onlineCount = players.filter((p) => p.connected).length;

  useOnChange(view.phase, (ph) => {
    if (ph === "spinning") shared("shuffle");
    if (ph === "choose") {
      shared("reveal");
      if (isTarget) mine("turn", [60, 40, 60]);
    }
    if (ph === "card") shared("rustle");
  });

  let stage: ReactNode;
  if (view.phase === "ready") {
    const o = view.outcome;
    stage = (
      <div className="space-y-3 text-center">
        {o && (
          <div className="flex justify-center">
            <Stamp tone={o.result === "done" ? "leaf" : "ink"}>
              {nameOf(players, o.target)}: {o.result === "done" ? (o.kind === "dare" ? "Himmat dikhayi! ✅" : "Sach bola! ✅") : "Pass 🙅 — koi baat nahi"}
            </Stamp>
          </div>
        )}
        {onlineCount < 2 ? (
          <p className="text-p-body text-muted">Kam se kam 2 log chahiye. Doston ko room code bhejo!</p>
        ) : canSpin ? (
          <PaperButton
            size="lg"
            className="w-full"
            onClick={() => {
              mine("whoosh", 20);
              send("spin");
            }}
          >
            <RotateCw className="h-5 w-5" strokeWidth={2.4} /> Bottle ghumao!
          </PaperButton>
        ) : (
          <p className="font-display text-p-lead font-extrabold">{nameOf(players, view.holder)} bottle ghumayenge…</p>
        )}
      </div>
    );
  } else if (view.phase === "spinning") {
    stage = <p className="text-center font-display text-p-lead font-extrabold">Ghoom rahi hai… 🍾</p>;
  } else if (view.phase === "choose") {
    stage = isTarget ? (
      <div className="space-y-3">
        <h2 className="text-center font-display text-p-show font-extrabold">Bottle aap pe ruki! 😈</h2>
        <div className="grid grid-cols-2 gap-3">
          {(["truth", "dare"] as const).map((k) => (
            <motion.button
              key={k}
              type="button"
              whileTap={{ scale: 0.95 }}
              className="cut min-h-28 rounded-cut font-display text-p-title font-extrabold"
              style={{ background: KIND_PAPER[k].bg, color: KIND_PAPER[k].fg }}
              onClick={() => {
                mine("pop", 25);
                send("pick", k);
              }}
            >
              {KIND_PAPER[k].label}
              <div className="text-p-note font-semibold opacity-80">{KIND_PAPER[k].sub}</div>
            </motion.button>
          ))}
        </div>
      </div>
    ) : (
      <p className="text-center font-display text-p-lead font-extrabold">{targetName} soch rahe hain: Sach ya Himmat?</p>
    );
  } else {
    stage = (
      <div className="space-y-3">
        <p className="text-center text-p-body font-semibold">{isTarget ? "Aapka card:" : `${targetName} ka card:`}</p>
        <PromptCard view={view} players={players} />
        {isTarget ? (
          <div className="space-y-2">
            <PaperButton size="lg" tone="ink" className="w-full" onClick={() => { mine("ding", 30); send("done"); }}>
              <Check className="h-5 w-5" strokeWidth={2.6} /> Ho gaya!
            </PaperButton>
            <div className="grid grid-cols-2 gap-2">
              <PaperButton tone="paper" onClick={() => { mine("rustle", 12); send("flip"); }}>
                <FlipHorizontal2 className="h-4 w-4" /> Palat do
              </PaperButton>
              <PaperButton tone="paper" onClick={() => send("pass")}>
                <Hand className="h-4 w-4" /> Pass
              </PaperButton>
            </div>
            <p className="text-center text-p-note text-muted">“Palat do” shows the other side of the card. Pass is always free — no points, no judging.</p>
          </div>
        ) : (
          <ReactRow onReact={(e) => send("react", e)} />
        )}
        <div className="flex justify-center">
          <ReportButton onReport={() => send("report")} />
        </div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <InkDefs />
      <div className="relative space-y-4 pb-4">
        <div className="flex items-center justify-between text-p-note font-bold uppercase tracking-[0.14em] text-muted">
          <span>
            {TONE_INFO[view.tone].emoji} {TONE_INFO[view.tone].label}
          </span>
          <span>Turn {Math.max(1, view.n)}</span>
        </div>

        <div className="relative">
          <BottleCircle view={view} players={players} me={me.id} size={Math.min(width, 340)} now={now} />
          <ReactionFloat reactions={view.reactions} players={players} />
        </div>

        {targetGone && (
          <div role="status" className="flex items-start gap-2 rounded-cut border-[1.5px] border-vermilion/60 bg-paper px-3 py-2.5 text-p-body font-semibold text-vermilion">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{targetName} ka phone offline hai. {isHost ? "Neeche se bottle wapas lo." : "Host bottle wapas le sakte hain."}</span>
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={`${view.n}-${view.phase}`} {...screenIn}>
            {stage}
          </motion.div>
        </AnimatePresence>

        {view.phase !== "card" && view.phase !== "choose" && <ReactRow onReact={(e) => send("react", e)} />}

        {view.adult && (
          <label className="flex items-center justify-between gap-3 rounded-cut border-[1.5px] border-ink/15 bg-paper px-3 py-2.5 text-p-body">
            <span>
              <span className="font-semibold">📱 Social dares for me</span>
              <span className="block text-p-note text-muted">Rare, only about you. Only you can see this switch.</span>
            </span>
            <input
              type="checkbox"
              className="h-6 w-6 accent-[#1e1a17]"
              checked={!priv?.noSocial}
              onChange={(e) => send("social", e.target.checked)}
            />
          </label>
        )}

        {isHost && (view.phase === "choose" || view.phase === "card") && (
          <section aria-label="Host controls" className="space-y-2 border-t-[1.5px] border-dashed border-ink/25 pt-4">
            <div className="text-p-note font-bold uppercase tracking-[0.16em] text-muted">Host ke controls{targetGone ? ` · ${targetName} ki taraf se` : ""}</div>
            {view.phase === "choose" && !isTarget && targetGone && (
              <div className="grid grid-cols-2 gap-2">
                <PaperButton tone="paper" onClick={() => hostAct("pick", "truth")}>Sach chuno</PaperButton>
                <PaperButton tone="paper" onClick={() => hostAct("pick", "dare")}>Himmat chuno</PaperButton>
              </div>
            )}
            {view.phase === "card" && !isTarget && targetGone && (
              <div className="grid grid-cols-3 gap-2">
                <PaperButton tone="paper" onClick={() => hostAct("done")}>Ho gaya</PaperButton>
                <PaperButton tone="paper" onClick={() => hostAct("flip")}>Palat do</PaperButton>
                <PaperButton tone="paper" onClick={() => hostAct("pass")}>Pass</PaperButton>
              </div>
            )}
            <PaperButton tone="paper" className="w-full" onClick={() => hostAct("skip")}>
              <SkipForward className="h-4 w-4" /> Bottle wapas lo (no result)
            </PaperButton>
          </section>
        )}

        <div className="sr-only" aria-live="polite">
          {view.phase === "choose" ? `The bottle stopped at ${targetName}.` : view.phase === "card" && view.card ? `${targetName}'s card: ${view.card.text}` : ""}
        </div>
      </div>
    </MotionConfig>
  );
}

function ReactRow({ onReact }: { onReact: (emoji: string) => void }) {
  return (
    <div className="flex justify-center gap-1.5" role="group" aria-label="React">
      {REACTIONS.map((e) => (
        <motion.button
          key={e}
          type="button"
          whileTap={{ scale: 1.3 }}
          className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-ink/20 bg-paper text-2xl"
          onClick={() => onReact(e)}
          aria-label={`React ${e}`}
        >
          {e}
        </motion.button>
      ))}
    </div>
  );
}
