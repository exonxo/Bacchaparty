"use client";
import { Volume2, VolumeX, WifiOff } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { playerColor } from "@/lib/colors";
import { isMuted, setMuted, unlockAudioOnFirstTap } from "@/lib/sfx";
import type { Player } from "@/lib/types";
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

/** Phone frame with a slim top bar. `--me` carries the player's colour into the game. */
export function RoomShell({
  me,
  code,
  status,
  right,
  title,
  children,
  away,
  menu,
}: {
  me: Player | null;
  code: string;
  status: "connecting" | "connected" | "error";
  right?: ReactNode;
  title?: ReactNode;
  children: ReactNode;
  away?: boolean;
  /** When set, tapping your icon opens a dropdown with this content. */
  menu?: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="min-h-dvh" style={{ ["--me" as string]: playerColor(me?.avatar) }}>
      <header className="sticky top-0 z-30 border-b-[1.5px] border-line bg-bg pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-2">
          <div ref={wrap} className="relative flex min-w-0 items-center gap-2.5">
            {me &&
              (menu ? (
                <button
                  aria-label="Profile and test mode"
                  aria-haspopup="dialog"
                  aria-expanded={open}
                  onClick={() => setOpen((o) => !o)}
                  className="press -m-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                >
                  <Sticker id={me.avatar} size={38} />
                </button>
              ) : (
                <Sticker id={me.avatar} size={38} />
              ))}
            {menu && open && (
              <div role="dialog" aria-label="Profile" className="rise-in cut absolute left-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-soft bg-card p-4">
                {menu(() => setOpen(false))}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-display truncate text-p-body font-extrabold leading-tight">{me?.name ?? "Big screen"}</div>
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
          <div className="flex items-center gap-2">
            {right}
            <MuteButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-lg px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4">{children}</div>
      {away && (
        <div className="rise-in fixed inset-x-0 bottom-0 z-40 flex justify-center p-4" role="status">
          <div className="cut flex items-center gap-3 rounded-cut bg-card px-4 py-3">
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
