"use client";
import { AVATARS } from "@/lib/util";
import type { Identity } from "@/lib/usePlayerRoom";
import { Sticker } from "./paper/Paper";

const MAX = 16;

/** Name on a name-tag, icon picked from a sticker sheet. */
export function ProfileFields({ me, onChange }: { me: Identity | null; onChange: (me: Identity) => void }) {
  const len = me?.name.length ?? 0;
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="player-name" className="font-display text-p-lead font-extrabold">
            Aapka naam?
          </label>
          <span className={`text-p-note font-semibold tabular-nums ${len >= MAX ? "text-vermilion" : "text-muted"}`}>
            {len}/{MAX}
          </span>
        </div>
        <div className="cut mt-2 rotate-[-0.6deg] rounded-cut bg-card">
          <div className="rounded-t-[3px] bg-vermilion px-3 py-1 text-p-note font-bold uppercase tracking-[0.18em] text-paper">Hello, my name is</div>
          <input
            id="player-name"
            value={me?.name ?? ""}
            onChange={(e) => me && onChange({ ...me, name: e.target.value.slice(0, MAX) })}
            placeholder="e.g. Chintu"
            autoComplete="off"
            maxLength={MAX}
            disabled={!me}
            className="font-display w-full bg-transparent px-3 py-3 text-p-title font-extrabold outline-none placeholder:font-semibold placeholder:text-ink/30"
          />
        </div>
      </div>
      <fieldset>
        <legend className="font-display text-p-lead font-extrabold">Apna sticker chuno</legend>
        <p className="text-p-note text-muted">If someone already has it, we’ll give you the next free one.</p>
        <div className="mt-3 grid grid-cols-6 gap-x-2 gap-y-3">
          {AVATARS.map((a, i) => {
            const on = me?.avatar === a;
            return (
              <button
                type="button"
                key={a}
                aria-label={a}
                aria-pressed={on}
                onClick={() => me && onChange({ ...me, avatar: a })}
                className="press flex aspect-square items-center justify-center rounded-full"
                style={{ transform: on ? "scale(1.18) rotate(-6deg)" : `rotate(${(i % 3) - 1}deg)`, opacity: on || !me ? 1 : 0.55 }}
              >
                <Sticker id={a} size={44} />
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
