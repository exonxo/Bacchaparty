"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PartyPost } from "@/components/loaders";
import { PhoneMessage } from "@/components/ui";

export function CreateRoom() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await fetch("/api/rooms", { method: "POST" });
        const data = await r.json();
        if (!r.ok || !data.code) throw new Error(data.error ?? "Could not create room");
        if (alive) router.replace(`/room/${data.code}/host`);
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : "Could not create room");
          setBusy(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);
  return (
    <main className="spotlight flex min-h-dvh items-center justify-center">
      <PartyPost open={busy && !error} />
      {error ? (
        <PhoneMessage title="Couldn’t create a room">{error}</PhoneMessage>
      ) : (
        <span className="sr-only" role="status">
          Party room ban raha hai…
        </span>
      )}
    </main>
  );
}
