"use client";
import { useEffect } from "react";
import { RoomAudioProvider } from "@/lib/roomAudio";
import type { GameModule, Player } from "@/lib/types";

/**
 * Renders a running game on a phone: the phone-first view when the game has
 * one, otherwise the classic controller.
 */
export function GameStage({
  mod,
  view,
  priv,
  me,
  players,
  send,
  now,
  isHost,
  hostAct,
  together,
  tvOn = false,
}: {
  mod: GameModule;
  view: unknown;
  priv: unknown;
  me: Player;
  players: Player[];
  send: (type: string, payload?: unknown) => void;
  now: number;
  isHost: boolean;
  hostAct: (type: string, payload?: unknown) => void;
  together: boolean;
  /** A TV is showing the room (it then plays the shared sounds). */
  tvOn?: boolean;
}) {
  // Games not yet redesigned keep their night look while they're on screen.
  const dark = !mod.paper;
  useEffect(() => {
    if (!dark) return;
    const root = document.documentElement;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevColor = meta?.content;
    root.dataset.theme = "dark";
    if (meta) meta.content = "#0b0b10";
    return () => {
      delete root.dataset.theme;
      if (meta && prevColor) meta.content = prevColor;
    };
  }, [dark]);
  const punoFill = mod.id === "puno" && !!mod.Phone;
  return (
    <div className={punoFill ? "flex min-h-0 min-w-0 flex-1 flex-col" : undefined}>
      <RoomAudioProvider value={{ together, isStage: isHost, tvOn }}>
      {mod.Phone ? (
        <div className={punoFill ? "-mx-4 flex h-full min-h-0 flex-1 flex-col overflow-hidden sm:-mx-0" : undefined}>
          <mod.Phone view={view} priv={priv} me={me} players={players} send={send} now={now} isHost={isHost} hostAct={hostAct} together={together} tvOn={tvOn} />
        </div>
      ) : isHost ? (
        <div className="space-y-6">
          <div className="rounded-xl bg-tint px-4 py-3 text-sm text-muted">
            This game is still in classic mode: the shared view below is made for a big screen. Use <b>TV mode</b> in the header (opens <code>/room/…/tv</code>)
            on a TV or laptop for the best experience.
          </div>
          <div className="overflow-x-auto">
            <mod.Screen view={view} players={players} act={hostAct} now={now} />
          </div>
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Your controls</div>
            <mod.Controller view={view} priv={priv} me={me} players={players} send={send} now={now} />
          </div>
        </div>
      ) : (
        <mod.Controller view={view} priv={priv} me={me} players={players} send={send} now={now} />
      )}
      </RoomAudioProvider>
    </div>
  );
}
