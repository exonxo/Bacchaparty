"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { GameStage } from "@/components/GameStage";
import { RoomShell } from "@/components/RoomShell";
import { Label, PhoneMessage } from "@/components/ui";
import { getGameInfo } from "@/games/catalog";
import { getGameModule } from "@/games/modules";
import { playSfx } from "@/lib/sfx";
import { useOnChange } from "@/lib/roomAudio";
import { useNow } from "@/lib/useNow";
import { loadIdentity, usePlayerRoom, type Identity } from "@/lib/usePlayerRoom";

const noop = () => {};

export function PlayerScreen({ code }: { code: string }) {
  const router = useRouter();
  const [me, setMe] = useState<Identity | null>(null);
  useEffect(() => {
    const id = loadIdentity();
    if (!id.name) router.replace(`/join?code=${code}`);
    else setMe(id);
  }, [code, router]);

  const { room, priv, offset, status, send, self, lastRoomAt } = usePlayerRoom(code, me);
  const now = useNow(offset, 250);
  const localNow = now - offset;
  useOnChange(room?.phase, (next) => {
    if (next === "playing") playSfx("whoosh");
  });

  if (!me) return null;
  const info = room?.gameId ? getGameInfo(room.gameId) : null;
  const mod = room?.gameId ? getGameModule(room.gameId) : null;
  const player = self ?? { id: me.id, name: me.name, avatar: me.avatar, connected: true };
  const away = !!room && lastRoomAt > 0 && localNow - lastRoomAt > 12000;
  const host = room?.players.find((p) => p.id === room.hostPlayerId);

  return (
    <RoomShell me={player} code={code} status={status} title={room?.phase === "playing" ? info?.name : undefined} away={away}>
      {!room ? (
        <PhoneMessage title="Connecting to the party…">Make sure the host has room {code} open.</PhoneMessage>
      ) : room.phase === "lobby" || !mod || !room.view ? (
        <div className="rise-in flex min-h-[70vh] flex-col items-center justify-center text-center">
          <Avatar id={me.avatar} className="pulse-glow text-6xl" />
          <h1 className="mt-5 font-display text-3xl font-black">You’re in, {me.name}!</h1>
          <p className="mt-2 text-muted">{host ? `${host.name} is picking a game…` : "The host is picking a game…"}</p>
          <Label className="mb-3 mt-10">In the room · {room.players.filter((p) => p.connected).length}</Label>
          <div className="flex flex-wrap justify-center gap-2">
            {room.players.map((p) => (
              <div key={p.id} className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm font-semibold ${p.id === me.id ? "bg-me text-black" : "bg-white/[0.07]"} ${p.connected ? "" : "opacity-40"}`}>
                <Avatar id={p.avatar} className="text-base" /> {p.name}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <GameStage
          mod={mod}
          view={room.view}
          priv={priv}
          me={player}
          players={room.players}
          send={send}
          now={now}
          isHost={false}
          hostAct={noop}
          together={room.together}
        />
      )}
    </RoomShell>
  );
}
