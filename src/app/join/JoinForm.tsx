"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { loadIdentity, saveIdentity, type Identity } from "@/lib/usePlayerRoom";
import { AVATARS } from "@/lib/util";

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
        return setError("No party with that code. Check the big screen!");
      }
    } catch {
      // Network hiccup: try connecting anyway.
    }
    saveIdentity({ ...me, name });
    router.push(`/room/${code}/play`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
      <Link href="/" className="text-2xl font-extrabold">
        🪅 Baccha<span className="text-saffron">party</span>
      </Link>
      <form onSubmit={submit} className="mt-8 space-y-6">
        <div>
          <label className="mb-2 block text-lg font-bold">Room code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4))}
            placeholder="ABCD"
            autoCapitalize="characters"
            autoComplete="off"
            className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-center text-4xl font-extrabold tracking-[0.4em] outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-2 block text-lg font-bold">Your name</label>
          <input
            value={me?.name ?? ""}
            onChange={(e) => me && setMe({ ...me, name: e.target.value.slice(0, 16) })}
            placeholder="e.g. Chintu"
            autoComplete="off"
            disabled={!me}
            className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-2xl font-bold outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-2 block text-lg font-bold">Pick your animal</label>
          <div className="grid grid-cols-6 gap-2">
            {AVATARS.map((a) => (
              <button
                type="button"
                key={a}
                onClick={() => me && setMe({ ...me, avatar: a })}
                className={`aspect-square rounded-2xl text-3xl ${me?.avatar === a ? "bg-gold" : "bg-white/10"}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        {error && <div className="rounded-xl bg-red/20 px-4 py-2 font-semibold text-red">{error}</div>}
        <Button type="submit" size="xl" className="w-full" disabled={busy || !me}>
          {busy ? "Joining…" : "Join the party 🎉"}
        </Button>
      </form>
    </main>
  );
}
