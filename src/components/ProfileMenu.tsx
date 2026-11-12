"use client";
import { BOTS } from "@/lib/testBots";
import { ChevronDown, LogOut, Pencil } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ProfileFields } from "@/components/ProfileForm";
import { BusyPaperButton } from "@/components/loaders";
import { PaperSheet, Sticker } from "@/components/paper/Paper";
import { saveIdentity, type Identity } from "@/lib/usePlayerRoom";
import type { Player } from "@/lib/types";

export function ProfileMenu({
  identity,
  player,
  accountEmail,
  onChange,
  testMode,
  onTestMode,
}: {
  identity: Identity;
  player: Player | null;
  accountEmail?: string | null;
  onChange: (next: Identity) => void;
  /** Host-only: simulated players for solo testing. */
  testMode?: boolean;
  onTestMode?: (on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(identity);
  const wrap = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => setDraft(identity), [identity]);

  const saveEdit = () => {
    const name = draft.name.trim();
    if (!name) return;
    const next = { ...draft, name };
    saveIdentity(next);
    onChange(next);
    setEdit(false);
  };

  const show = player ?? { id: identity.id, name: identity.name, avatar: identity.avatar, connected: true };
  const hostTestControls = onTestMode != null && testMode != null;

  return (
    <>
      <div className="relative min-w-0" ref={wrap}>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
          className="press flex min-w-0 max-w-[min(100%,14rem)] items-center gap-2 rounded-full border-[1.5px] border-line bg-card py-1 pl-1 pr-2.5 text-left sm:max-w-[16rem]"
        >
          <Sticker id={show.avatar} size={36} />
          <span className="min-w-0 flex-1 truncate font-display text-p-body font-extrabold leading-tight">{show.name}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div
            id={menuId}
            role="menu"
            className="cut rise-in absolute left-0 top-[calc(100%+0.35rem)] z-50 min-w-[14rem] max-w-[min(18rem,calc(100vw-2rem))] rounded-soft bg-card py-1"
          >
            <button
              type="button"
              role="menuitem"
              className="press flex w-full items-center gap-2 px-3 py-2.5 text-left text-p-body font-semibold"
              onClick={() => {
                setOpen(false);
                setEdit(true);
              }}
            >
              <Pencil className="h-4 w-4" /> Edit name
            </button>
            {hostTestControls && (
              <div className="border-t-[1.5px] border-line px-3 py-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={testMode}
                  onClick={() => onTestMode(!testMode)}
                  className="press flex min-h-11 w-full items-center justify-between gap-3 text-left"
                >
                  <span>
                    <span className="font-display block text-p-body font-extrabold">Test mode</span>
                    <span className="block text-p-note text-muted">Adds three simulated players who join and play.</span>
                  </span>
                  <span
                    className={`relative h-7 w-12 shrink-0 rounded-full border-[1.5px] border-ink transition-colors duration-200 ${testMode ? "bg-green" : "bg-paper"}`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full border-[1.5px] border-ink bg-paper transition-transform duration-200 ${testMode ? "translate-x-5" : ""}`}
                    />
                  </span>
                </button>
                {testMode && (
                  <p className="mt-2 text-p-note text-muted">
                    Simulated: {BOTS.map((b) => b.name).join(", ")}. They show up on every phone in this room and play along in most games.
                  </p>
                )}
              </div>
            )}
            {accountEmail && (
              <div className="border-t-[1.5px] border-line px-3 py-2.5 text-p-note text-muted" role="presentation">
                <div className="font-bold uppercase tracking-wider text-ink/70">Account</div>
                <div className="mt-0.5 truncate font-medium text-ink">{accountEmail}</div>
              </div>
            )}
            {accountEmail && (
              <form action="/auth/signout" method="post" role="none">
                <button
                  type="submit"
                  role="menuitem"
                  className="press flex w-full items-center gap-2 border-t-[1.5px] border-line px-3 py-2.5 text-left text-p-body font-semibold text-vermilion"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <PaperSheet open={edit} onClose={() => setEdit(false)} title="Update your name">
        <ProfileFields me={draft} onChange={setDraft} />
        <BusyPaperButton size="lg" className="mt-6 w-full" disabled={!draft.name.trim()} busyLabel="Saving…" onClick={saveEdit}>
          Save
        </BusyPaperButton>
      </PaperSheet>
    </>
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
