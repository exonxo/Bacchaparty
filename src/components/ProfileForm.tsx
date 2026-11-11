"use client";
import { AVATARS } from "@/lib/util";
import type { Identity } from "@/lib/usePlayerRoom";
import { Avatar } from "./Avatar";

export function ProfileFields({ me, onChange }: { me: Identity | null; onChange: (me: Identity) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-bold uppercase tracking-[0.15em] text-muted">Your name</label>
        <input
          value={me?.name ?? ""}
          onChange={(e) => me && onChange({ ...me, name: e.target.value.slice(0, 16) })}
          placeholder="e.g. Chintu"
          autoComplete="off"
          disabled={!me}
          className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3.5 font-display text-2xl font-bold outline-none focus:border-saffron"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-bold uppercase tracking-[0.15em] text-muted">Pick your icon</label>
        <div className="grid grid-cols-6 gap-2">
          {AVATARS.map((a) => (
            <button
              type="button"
              key={a}
              aria-label={a}
              onClick={() => me && onChange({ ...me, avatar: a })}
              className={`flex aspect-square items-center justify-center rounded-xl text-2xl transition ${me?.avatar === a ? "scale-105 bg-white/15 ring-2 ring-saffron" : "bg-white/[0.04]"}`}
            >
              <Avatar id={a} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
