"use client";
import { Check, Home, RotateCcw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { isBot } from "@/lib/testBots";
import type { Player } from "@/lib/types";
import { PaperButton, Sticker } from "./paper/Paper";

/**
 * Shown on every phone once a game has reached its end.
 * Rematch is a vote: when everyone in the room has tapped it, the same game starts again.
 * "Lobby" ends the finished game for everyone straight away (nothing is lost: the scorecard shows in the lobby).
 */
export function GameOverBar({
  players,
  meId,
  votes,
  onRematch,
  onLobby,
}: {
  players: Player[];
  meId: string;
  votes: string[];
  onRematch: () => void;
  onLobby: () => void;
}) {
  const reduce = useReducedMotion();
  const people = players.filter((p) => p.connected && !isBot(p.id));
  const voted = people.filter((p) => votes.includes(p.id));
  const mine = votes.includes(meId);
  const waitingOn = people.filter((p) => !votes.includes(p.id));
  return (
    <>
      {/* Room for the bar, so the end of the game screen can scroll above it. */}
      <div aria-hidden className="h-44 shrink-0" />
      <motion.div
        role="region"
        aria-label="Game khatam"
        initial={reduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed inset-x-0 bottom-0 z-[450] border-t-[1.5px] border-ink bg-bg px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
      >
        <div className="mx-auto max-w-lg">
          <div className="mb-2 flex items-center justify-between gap-3" aria-live="polite">
            <span className="text-p-note font-bold text-muted">
              {mine
                ? waitingOn.length
                  ? `Wait — ${waitingOn.map((p) => (p.id === meId ? "aap" : p.name)).slice(0, 3).join(", ")}${waitingOn.length > 3 ? ` +${waitingOn.length - 3}` : ""} ka intezaar`
                  : "Sab ready — shuru ho raha hai…"
                : "Ek aur baar? Sab Rematch dabayein toh game phir shuru."}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <span className="flex -space-x-2">
                {voted.slice(0, 5).map((p) => (
                  <Sticker key={p.id} id={p.avatar} size={24} />
                ))}
              </span>
              <span className="font-display text-p-note font-extrabold tabular-nums">
                {voted.length}/{people.length}
              </span>
            </span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <PaperButton size="lg" tone={mine ? "paper" : "turmeric"} onClick={onRematch} aria-pressed={mine}>
              {mine ? <Check className="h-5 w-5" /> : <RotateCcw className="h-5 w-5" />} {mine ? "Rematch pe haan · wapas lo" : "Rematch"}
            </PaperButton>
            <PaperButton size="lg" tone="paper" onClick={onLobby}>
              <Home className="h-5 w-5" /> Lobby
            </PaperButton>
          </div>
        </div>
      </motion.div>
    </>
  );
}
