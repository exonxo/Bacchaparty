"use client";
import { Tv, Volume2, VolumeX, WifiOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { playerColor } from "@/lib/colors";
import { isMuted, setMuted, unlockAudioOnFirstTap } from "@/lib/sfx";
import type { Player } from "@/lib/types";
import type { Identity } from "@/lib/usePlayerRoom";
import { ProfileMenu } from "./ProfileMenu";
import { Sticker } from "./paper/Paper";

export const iconButtonClass = "press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tint text-ink hover:bg-tint-2";

export function MuteButton() {
  const [muted, setM] = useState(false);
  useEffect(() => {
    setM(isMuted());
    unlockAudioOnFirstTap();
  }, []);
  return (
    <button
      aria-label={muted ? "Turn sound on" : "Turn sound off"}
      aria-pressed={muted}
      onClick={() => {
        setMuted(!muted);
        setM(!muted);
      }}
      className={iconButtonClass}
    >
      {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
    </button>
  );
}

const STATUS_TEXT = { connected: "Connected", connecting: "Connecting", error: "Connection problem" } as const;

type ShellWidth = "wide" | "cozy";

const SHELL_WIDTH: Record<ShellWidth, string> = {
  wide: "max-w-6xl",
  cozy: "max-w-2xl md:max-w-3xl lg:max-w-4xl",
};

/** Room frame with a top bar. `--me` carries the player's colour into the game. */
export function RoomShell({
  me,
  identity,
  onIdentityChange,
  accountEmail,
  code,
  status,
  right,
  title,
  children,
  away,
  tvHref,
  width = "cozy",
  testMode,
  onTestMode,
  fillViewport,
}: {
  me: Player | null;
  identity?: Identity | null;
  onIdentityChange?: (next: Identity) => void;
  accountEmail?: string | null;
  code: string;
  status: "connecting" | "connected" | "error";
  right?: ReactNode;
  title?: ReactNode;
  children: ReactNode;
  away?: boolean;
  /** Opens the read-only big-screen display at /room/[code]/tv in a new tab. */
  tvHref?: string;
  width?: ShellWidth;
  testMode?: boolean;
  onTestMode?: (on: boolean) => void;
  /** Game fills remaining viewport below header (no extra main padding). */
  fillViewport?: boolean;
}) {
  const shell = SHELL_WIDTH[width];
  const profileIdentity =
    identity ?? (me ? { id: me.id, name: me.name, avatar: me.avatar } : null);

  return (
    <div
      className={fillViewport ? "flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden" : "min-h-dvh"}
      style={{ ["--me" as string]: playerColor(me?.avatar) }}
    >
      <header className="sticky top-0 z-30 border-b-[1.5px] border-line bg-bg pt-[env(safe-area-inset-top)]">
        <div className={`mx-auto flex ${shell} items-center justify-between gap-3 px-4 py-2`}>
          <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
            {profileIdentity && onIdentityChange ? (
              <ProfileMenu
                identity={profileIdentity}
                player={me}
                accountEmail={accountEmail}
                onChange={onIdentityChange}
                testMode={testMode}
                onTestMode={onTestMode}
                tvHref={tvHref}
              />
            ) : me ? (
              <>
                <Sticker id={me.avatar} size={38} />
                <div className="min-w-0">
                  <div className="font-display truncate text-p-body font-extrabold leading-tight">{me.name}</div>
                </div>
              </>
            ) : (
              <div className="font-display text-p-body font-extrabold">Big screen</div>
            )}
            <div className="hidden min-w-0 sm:block">
              <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-p-note font-semibold text-muted">
                <span
                  role="status"
                  aria-label={STATUS_TEXT[status]}
                  className={`h-2 w-2 shrink-0 rounded-full ${status === "connected" ? "bg-green" : status === "error" ? "bg-red" : "bg-turmeric"}`}
                />
                {status !== "connected" && <span>{status === "error" ? "Offline" : "Connecting…"}</span>}
                <span className="font-bold tracking-[0.16em] text-ink">{code}</span>
                {title && <span className="truncate">· {title}</span>}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {tvHref && (
              <Link
                href={tvHref}
                target="_blank"
                rel="noopener noreferrer"
                className={`${iconButtonClass} ${profileIdentity && onIdentityChange ? "max-[399px]:hidden" : ""}`}
                title="TV mode"
                aria-label="Open TV mode"
              >
                <Tv className="h-5 w-5" />
              </Link>
            )}
            {right}
            <MuteButton />
          </div>
        </div>
        <div className={`mx-auto ${shell} px-4 pb-2 sm:hidden`}>
          <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-p-note font-semibold text-muted">
            <span
              role="status"
              aria-label={STATUS_TEXT[status]}
              className={`h-2 w-2 shrink-0 rounded-full ${status === "connected" ? "bg-green" : status === "error" ? "bg-red" : "bg-turmeric"}`}
            />
            {status !== "connected" && <span>{status === "error" ? "Offline" : "Connecting…"}</span>}
            <span className="font-bold tracking-[0.16em] text-ink">{code}</span>
            {title && <span className="truncate">· {title}</span>}
          </div>
        </div>
      </header>
      <div
        className={`mx-auto flex w-full ${shell} px-4 ${
          fillViewport
            ? "min-h-0 flex-1 flex-col overflow-hidden pb-[env(safe-area-inset-bottom)] pt-1"
            : "flex-col pb-[max(2rem,env(safe-area-inset-bottom))] pt-4"
        }`}
      >
        {children}
      </div>
      {away && (
        <div className="rise-in fixed inset-x-0 bottom-0 z-40 flex justify-center p-4" role="status">
          <div className="cut flex max-w-md items-center gap-3 rounded-cut bg-card px-4 py-3">
            <WifiOff className="h-5 w-5 shrink-0 text-vermilion" />
            <div className="text-p-note">
              <div className="text-p-body font-bold">Host ka wait kar rahe hain…</div>
              <div className="text-muted">The game continues when their phone is back.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
