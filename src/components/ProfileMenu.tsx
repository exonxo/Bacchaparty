"use client";
import { ChevronDown, LogOut, Pencil } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ProfileFields } from "@/components/ProfileForm";
import { PaperButton, PaperSheet, Sticker } from "@/components/paper/Paper";
import { saveIdentity, type Identity } from "@/lib/usePlayerRoom";
import type { Player } from "@/lib/types";

export function ProfileMenu({
  identity,
  player,
  accountEmail,
  onChange,
}: {
  identity: Identity;
  player: Player | null;
  accountEmail?: string | null;
  onChange: (next: Identity) => void;
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
            className="cut rise-in absolute left-0 top-[calc(100%+0.35rem)] z-50 min-w-[14rem] rounded-soft bg-card py-1"
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
            {accountEmail && (
              <div className="border-t-[1.5px] border-line px-3 py-2.5 text-p-note text-muted" role="presentation">
                <div className="font-bold uppercase tracking-wider text-ink/70">Account</div>
                <div className="mt-0.5 truncate font-medium text-ink">{accountEmail}</div>
              </div>
            )}
            {accountEmail && (
              <form action="/auth/signout" method="post" role="none">
                <button type="submit" role="menuitem" className="press flex w-full items-center gap-2 border-t-[1.5px] border-line px-3 py-2.5 text-left text-p-body font-semibold text-vermilion">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <PaperSheet open={edit} onClose={() => setEdit(false)} title="Update your name">
        <ProfileFields me={draft} onChange={setDraft} />
        <PaperButton size="lg" className="mt-6 w-full" disabled={!draft.name.trim()} onClick={saveEdit}>
          Save
        </PaperButton>
      </PaperSheet>
    </>
  );
}
