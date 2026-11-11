"use client";
import { Volume2, VolumeX, WifiOff } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { playerColor } from "@/lib/colors";
import { isMuted, setMuted, unlockAudioOnFirstTap } from "@/lib/sfx";
import type { Player } from "@/lib/types";
import { Avatar } from "./Avatar";

export function MuteButton() {
  const [muted, setM] = useState(false);
  useEffect(() => {
    setM(isMuted());
    unlockAudioOnFirstTap();
  }, []);
  return (
    <button
      aria-label={muted ? "Unmute" : "Mute"}
      onClick={() => {
        setMuted(!muted);
        setM(!muted);
      }}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.07] text-muted hover:text-ink"
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}

/** Phone frame tinted with the player's colour, with a slim top bar. */
export function RoomShell({
  me,
  code,
  status,
  right,
  title,
  children,
  away,
}: {
  me: Player | null;
  code: string;
  status: "connecting" | "connected" | "error";
  right?: ReactNode;
  title?: ReactNode;
  children: ReactNode;
  away?: boolean;
}) {
  const color = playerColor(me?.avatar);
  return (
    <div
      className="min-h-dvh"
      style={{
        ["--me" as string]: color,
        background: `radial-gradient(120% 50% at 50% -10%, color-mix(in srgb, ${color} 22%, transparent), transparent 60%), var(--bg)`,
      }}
    >
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-bg/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {me && <Avatar id={me.avatar} className="text-xl" />}
            <div className="min-w-0">
              <div className="truncate font-display font-bold leading-tight">{me?.name ?? "Big screen"}</div>
              <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[11px] font-bold text-muted">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status === "connected" ? "bg-green" : status === "error" ? "bg-red" : "bg-gold"}`} />
                <span className="uppercase tracking-[0.18em]">{code}</span>
                {title && <span className="truncate">· {title}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {right}
            <MuteButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-lg px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4">{children}</div>
      {away && (
        <div className="fade-in fixed inset-x-0 bottom-0 z-40 flex justify-center p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-bg-2/95 px-4 py-3 shadow-2xl backdrop-blur">
            <WifiOff className="h-5 w-5 text-gold" />
            <div className="text-sm">
              <div className="font-bold">Waiting for the host…</div>
              <div className="text-muted">The game continues when their phone is back.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
