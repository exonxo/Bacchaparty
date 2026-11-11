"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PhoneMessage, PlayerChip } from "@/components/ui";
import { getGameInfo } from "@/games/catalog";
import { getGameModule } from "@/games/modules";
import { useNow } from "@/lib/useNow";
import { loadIdentity, usePlayerRoom, type Identity } from "@/lib/usePlayerRoom";

export function PlayerScreen({ code }: { code: string }) {
  const router = useRouter();
  const [me, setMe] = useState<Identity | null>(null);
  useEffect(() => {
    const id = loadIdentity();
    if (!id.name) router.replace(`/join?code=${code}`);
    else setMe(id);
  }, [code, router]);

  const { room, priv, offset, status, send, self } = usePlayerRoom(code, me);
  const now = useNow(offset, 250);

  if (!me) return null;
  const info = room?.gameId ? getGameInfo(room.gameId) : null;
  const mod = room?.gameId ? getGameModule(room.gameId) : null;
  const player = self ?? { id: me.id, name: me.name, avatar: me.avatar, connected: true };

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-10">
      <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between bg-bg/90 px-4 py-3 backdrop-blur">
        <PlayerChip player={player} />
        <div className="flex items-center gap-2 text-sm text-muted">
          {info && <span>{info.emoji}</span>}
          <span className="font-bold tracking-widest">{code}</span>
          <span className={`h-2.5 w-2.5 rounded-full ${status === "connected" && room ? "bg-green" : status === "error" ? "bg-red" : "bg-gold"}`} />
        </div>
      </header>
      {!room ? (
        <PhoneMessage emoji="📡" title="Connecting to the party…">
          Make sure the big screen with code <b>{code}</b> is open.
        </PhoneMessage>
      ) : room.phase === "lobby" || !mod || !room.view ? (
        <PhoneMessage emoji={player.avatar} title={`You're in, ${me.name}!`}>
          Look at the big screen. The host is picking a game…
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {room.players.map((p) => (
              <PlayerChip key={p.id} player={p} highlight={p.id === me.id} />
            ))}
          </div>
        </PhoneMessage>
      ) : (
        <mod.Controller view={room.view} priv={priv} me={player} players={room.players} send={send} now={now} />
      )}
    </main>
  );
}
