"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PhoneMessage } from "@/components/ui";

export function CreateRoom() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    fetch("/api/rooms", { method: "POST" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || !data.code) throw new Error(data.error ?? "Could not create room");
        router.replace(`/room/${data.code}/host`);
      })
      .catch((e: Error) => setError(e.message));
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center">
      {error ? (
        <PhoneMessage emoji="😕" title="Couldn’t create a room">
          {error}
        </PhoneMessage>
      ) : (
        <PhoneMessage emoji="🪅" title="Setting up your party room…" />
      )}
    </main>
  );
}
