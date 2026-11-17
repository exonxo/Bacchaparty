"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { bwButtonClass } from "./brand";

/** Quick guest entry: type the 4-letter code, land on /join with it filled in. */
export function RoomCodeJump({ id = "hero-code", dark = false }: { id?: string; dark?: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = code.length === 4;
  return (
    <form
      className="flex w-full max-w-md flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || busy) return;
        setBusy(true);
        router.push(`/join?code=${code}`);
      }}
    >
      <label htmlFor={id} className={`font-bw-accent text-base font-bold ${dark ? "text-white" : "text-bw-ink"}`}>
        Already have a room code?
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={code}
          onChange={(e) => setCode(e.target.value.trim().replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4))}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={4}
          placeholder="ABCD"
          aria-describedby={`${id}-hint`}
          className="bw-pop-sm min-h-12 w-full min-w-0 flex-1 rounded-xl bg-white px-4 font-bw-display text-3xl tracking-[0.35em] text-bw-ink placeholder:text-bw-ink/30"
        />
        <button type="submit" disabled={!ready || busy} className={`${bwButtonClass("blue", "md")} shrink-0 disabled:cursor-not-allowed disabled:bg-[#c7d4ff] disabled:text-bw-ink/70`}>
          {busy ? "Joining…" : "Join party"}
        </button>
      </div>
      <p id={`${id}-hint`} className={`text-sm ${dark ? "text-white/85" : "text-bw-ink/75"}`}>
        4 letters, from the host&apos;s screen.
      </p>
    </form>
  );
}
