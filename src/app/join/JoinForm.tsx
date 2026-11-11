"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Header";
import { PaperButton } from "@/components/paper/Paper";
import { ProfileFields } from "@/components/ProfileForm";
import { loadIdentity, saveIdentity, type Identity } from "@/lib/usePlayerRoom";

export function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState((params.get("code") ?? "").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4));
  const [me, setMe] = useState<Identity | null>(null);
  const [error, setError] = useState<{ field: "code" | "name"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => setMe(loadIdentity()), []);

  function normalizeCode(raw: string) {
    return raw.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    const name = me.name.trim();
    const joinedCode = normalizeCode(codeInput.current?.value ?? code);
    if (joinedCode !== code) setCode(joinedCode);
    if (joinedCode.length !== 4) return setError({ field: "code", text: "The room code has 4 letters." });
    if (!name) return setError({ field: "name", text: "Please type your name." });
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${joinedCode}`);
      const data = await res.json();
      if (!data.exists) {
        setBusy(false);
        return setError({ field: "code", text: "No party with that code. Ask the host to check it." });
      }
    } catch {
      // Network hiccup: try connecting anyway.
    }
    saveIdentity({ ...me, name });
    router.push(`/room/${joinedCode}/play`);
  }

  return (
    <main className="min-h-dvh">
      <div className="mx-auto flex max-w-md flex-col px-4 py-4">
        <Logo />
        <form onSubmit={submit} className="mt-6 space-y-7" noValidate>
          <div>
            <h1 className="text-p-show font-extrabold">Party join karo</h1>
            <p className="mt-2 text-p-body text-muted">Ask the person who started the party for the 4-letter code.</p>
          </div>

          <div>
            <label htmlFor="room-code" className="font-display text-p-lead font-extrabold">
              Room code
            </label>
            {/* One real input (so paste and autofill work) drawn as four letter tiles. */}
            <div className={`relative mt-2 ${error?.field === "code" ? "shake" : ""}`} onClick={() => codeInput.current?.focus()}>
              <input
                id="room-code"
                ref={codeInput}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4));
                  setError(null);
                }}
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                aria-describedby={error?.field === "code" ? "join-error" : undefined}
                aria-invalid={error?.field === "code"}
                className="peer absolute inset-0 h-full w-full cursor-text opacity-0"
              />
              <div className="grid grid-cols-4 gap-2.5 peer-focus-visible:[&>*]:outline-none" aria-hidden>
                {[0, 1, 2, 3].map((i) => {
                  const ch = code[i];
                  const active = i === Math.min(code.length, 3);
                  return (
                    <div
                      key={i}
                      className={`cut font-display flex aspect-[4/5] items-center justify-center rounded-cut text-[2.75rem] font-extrabold transition-transform duration-200 ${
                        ch ? "bg-turmeric" : "bg-card"
                      } ${error?.field === "code" ? "!border-vermilion" : ""}`}
                      style={{ transform: ch ? `rotate(${[-2, 1.5, -1, 2][i]}deg)` : undefined }}
                    >
                      {ch ?? <span className={`h-1 w-6 rounded-full ${active ? "bg-ink" : "bg-ink/20"}`} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <ProfileFields
            me={me}
            onChange={(next) => {
              setMe(next);
              if (error?.field === "name") setError(null);
            }}
          />

          {error && (
            <div id="join-error" role="alert" className="rounded-cut border-[1.5px] border-vermilion bg-card px-4 py-2.5 font-semibold text-vermilion">
              {error.text}
            </div>
          )}
          <PaperButton type="submit" size="lg" className="w-full" disabled={busy || !me}>
            {busy ? "Join ho rahe hain…" : "Chalo, join karo"}
          </PaperButton>
        </form>
      </div>
    </main>
  );
}
