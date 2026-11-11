"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Header";
import { ProfileFields } from "@/components/ProfileForm";
import { Button } from "@/components/ui";
import { loadIdentity, saveIdentity, type Identity } from "@/lib/usePlayerRoom";

export function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState((params.get("code") ?? "").toUpperCase().slice(0, 4));
  const [me, setMe] = useState<Identity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setMe(loadIdentity()), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    const name = me.name.trim();
    if (code.length !== 4) return setError("The room code has 4 letters.");
    if (!name) return setError("Please type your name.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${code}`);
      const data = await res.json();
      if (!data.exists) {
        setBusy(false);
        return setError("No party with that code. Ask the host to check it.");
      }
    } catch {
      // Network hiccup: try connecting anyway.
    }
    saveIdentity({ ...me, name });
    router.push(`/room/${code}/play`);
  }

  return (
    <main className="spotlight min-h-dvh">
      <div className="mx-auto flex max-w-md flex-col px-4 py-5">
        <Logo />
        <form onSubmit={submit} className="mt-8 space-y-6">
          <h1 className="font-display text-3xl font-black">Join a party</h1>
          <div>
            <label className="mb-2 block text-sm font-bold uppercase tracking-[0.15em] text-muted">Room code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4))}
              placeholder="ABCD"
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
              className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-4 text-center font-display text-4xl font-black tracking-[0.45em] outline-none focus:border-saffron"
            />
          </div>
          <ProfileFields me={me} onChange={setMe} />
          {error && <div className="shake rounded-xl bg-red/15 px-4 py-2.5 font-semibold text-red">{error}</div>}
          <Button type="submit" size="xl" className="w-full" disabled={busy || !me}>
            {busy ? "Joining…" : "Join the party"}
          </Button>
        </form>
      </div>
    </main>
  );
}
