"use client";
import { BOTS } from "@/lib/testBots";
import { Sticker } from "./paper/Paper";

/** Dropdown under your icon: who you are, and the test mode switch. */
export function ProfileMenu({
  name,
  avatar,
  testMode,
  onTestMode,
  onClose,
}: {
  name: string;
  avatar: string;
  testMode: boolean;
  onTestMode: (on: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Sticker id={avatar} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-display truncate text-p-lead font-extrabold leading-tight">{name}</div>
          <div className="text-p-note text-muted">Host</div>
        </div>
        <button onClick={onClose} className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-muted hover:text-ink" aria-label="Close profile">
          ✕
        </button>
      </div>

      <div className="border-t-[1.5px] border-line pt-4">
        <button
          role="switch"
          aria-checked={testMode}
          onClick={() => onTestMode(!testMode)}
          className="press flex min-h-11 w-full items-center justify-between gap-3 text-left"
        >
          <span>
            <span className="font-display block text-p-body font-extrabold">Test mode</span>
            <span className="block text-p-note text-muted">Adds four simulated players who join and play.</span>
          </span>
          <span className={`relative h-7 w-12 shrink-0 rounded-full border-[1.5px] border-ink transition-colors duration-200 ${testMode ? "bg-green" : "bg-paper"}`}>
            <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full border-[1.5px] border-ink bg-paper transition-transform duration-200 ${testMode ? "translate-x-5" : ""}`} />
          </span>
        </button>
        {testMode && (
          <p className="mt-3 text-p-note text-muted">
            Simulated: {BOTS.map((b) => b.name).join(", ")}. They show up on every phone in this room, and in Chor Kaun?, Emoji Picture and Housie they play along.
          </p>
        )}
      </div>
    </div>
  );
}

/** Shown on the host's screen while test mode is on, so nobody mistakes the room for a real one. */
export function TestBanner({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <div role="status" className="cut mb-4 flex items-center gap-2 rounded-cut bg-turmeric px-3 py-2 text-p-note font-bold text-ink">
      <span className="h-2 w-2 shrink-0 rounded-full bg-ink" />
      Test mode: simulated players are in this room. Turn it off from your profile menu.
    </div>
  );
}
