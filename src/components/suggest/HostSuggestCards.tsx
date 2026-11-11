"use client";

import { Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { gameLook } from "@/components/paper/gameLook";
import { GameIcon } from "@/components/GameIcon";
import { PaperButton } from "@/components/paper/Paper";
import { getGameInfo } from "@/games/catalog";
import { requestSuggest } from "@/lib/suggest/client";
import type { DareResult, NextGameResult } from "@/lib/suggest/types";
import { SuggestPaperButton } from "./SuggestPaperButton";

export function WhatNextCard({
  roomCode,
  playerCount,
  gamesPlayed,
  onPickGame,
}: {
  roomCode: string;
  playerCount: number;
  gamesPlayed: string[];
  onPickGame: (gameId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [pick, setPick] = useState<NextGameResult | null>(null);

  const suggest = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await requestSuggest<NextGameResult>("next-game", { playerCount, gamesPlayed }, roomCode);
      setPick(data);
    } finally {
      setLoading(false);
    }
  }, [roomCode, playerCount, gamesPlayed]);

  const info = pick ? getGameInfo(pick.gameId) : null;
  const look = pick ? gameLook(pick.gameId) : null;

  return (
    <section className="cut rounded-soft border-[1.5px] border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-p-lead font-extrabold">What next?</h3>
          <p className="mt-0.5 text-p-note text-muted">Need a nudge between games?</p>
        </div>
        <SuggestPaperButton loading={loading} onClick={() => void suggest()}>
          <Sparkles className="h-4 w-4" /> Suggest
        </SuggestPaperButton>
      </div>
      {pick && info && look && (
        <div className="rise-in mt-3 rounded-cut border-[1.5px] border-ink/15 bg-tint p-3">
          <GamePickRow look={look} gameId={info.id} name={info.name} emoji={info.emoji} />
          <p className="mt-2 text-p-body text-muted">{pick.reason}</p>
          <PaperButton size="md" className="mt-3" onClick={() => onPickGame(pick.gameId)}>
            Open {info.name}
          </PaperButton>
        </div>
      )}
    </section>
  );
}

function GamePickRow({ look, gameId, name, emoji }: { look: { color: string; on: string }; gameId: string; name: string; emoji: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="cut flex h-11 w-11 shrink-0 items-center justify-center rounded-soft" style={{ background: look.color, color: look.on }}>
        <GameIcon id={gameId} className="h-6 w-6" strokeWidth={2.2} />
      </div>
      <div>
        <div className="text-p-lead font-bold">
          {emoji} {name}
        </div>
      </div>
    </div>
  );
}

export function DarePromptCard({ roomCode }: { roomCode: string }) {
  const [loading, setLoading] = useState(false);
  const [dare, setDare] = useState<DareResult | null>(null);

  const draw = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await requestSuggest<DareResult>("dare", { audience: "family" }, roomCode);
      setDare(data);
    } finally {
      setLoading(false);
    }
  }, [roomCode]);

  return (
    <section className="cut rounded-soft border-[1.5px] border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-p-lead font-extrabold">Dare / prompt</h3>
          <p className="mt-0.5 text-p-note text-muted">Pull a fun icebreaker for the room.</p>
        </div>
        <SuggestPaperButton loading={loading} onClick={() => void draw()}>
          <Sparkles className="h-4 w-4" /> Draw
        </SuggestPaperButton>
      </div>
      {dare && (
        <blockquote className="rise-in mt-3 border-l-4 border-turmeric pl-3 text-p-body font-semibold text-ink">{dare.text}</blockquote>
      )}
    </section>
  );
}
