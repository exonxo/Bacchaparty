"use client";
import { LogOut, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { GameStage } from "@/components/GameStage";
import { RoomShell } from "@/components/RoomShell";
import { Button, Label, PhoneMessage, Sheet } from "@/components/ui";
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

  const { room, priv, offset, status, send, leave, self, kicked, lastRoomAt } = usePlayerRoom(code, me);
  const now = useNow(offset, 250);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Joined while a game was already running: show a short welcome once.
  const [lateJoin, setLateJoin] = useState(false);
  const sawRoom = useRef(false);
  useEffect(() => {
    if (!room || sawRoom.current) return;
    sawRoom.current = true;
    if (room.phase === "playing") setLateJoin(true);
  }, [room]);
  useOnChange(room?.phase, (next) => {
    if (next === "playing") playSfx("whoosh");
    else setLateJoin(false);
  });

  if (!me) return null;
  const info = room?.gameId ? getGameInfo(room.gameId) : null;
  const mod = room?.gameId ? getGameModule(room.gameId) : null;
  const player = self ?? { id: me.id, name: me.name, avatar: me.avatar, connected: true };
  const away = !!room && lastRoomAt > 0 && Date.now() - lastRoomAt > 12000;
  const host = room?.players.find((p) => p.id === room.hostPlayerId);

  if (kicked) {
    return (
      <main className="spotlight flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <PhoneMessage title="The host removed you from this room">You can’t rejoin this party, but you can join or host another one.</PhoneMessage>
        <Link href="/" className="inline-flex min-h-12 items-center rounded-xl bg-white/10 px-6 font-display font-bold">
          Back to home
        </Link>
      </main>
    );
  }

  return (
    <RoomShell
      me={player}
      code={code}
      status={status}
      title={room?.phase === "playing" ? info?.name : undefined}
      away={away}
      right={
        <button
          aria-label="Leave party"
          onClick={() => setConfirmLeave(true)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.07] text-muted hover:text-ink"
        >
          <LogOut className="h-4 w-4" />
        </button>
      }
    >
      {!room ? (
        <PhoneMessage title="Connecting to the party…">Make sure the host has room {code} open.</PhoneMessage>
      ) : room.phase === "lobby" || !mod || !room.view ? (
        <div className="rise-in flex min-h-[70vh] flex-col items-center justify-center text-center">
          <Avatar id={player.avatar} className="pulse-glow text-6xl" />
          <h1 className="mt-5 font-display text-3xl font-black">You’re in, {me.name}!</h1>
          <p className="mt-2 text-muted">{host ? `${host.name} is picking a game…` : "The host is picking a game…"}</p>
          <Label className="mb-3 mt-10">In the room · {room.players.filter((p) => p.connected).length}</Label>
          <div className="flex flex-wrap justify-center gap-2">
            {room.players.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm font-semibold ${p.id === me.id ? "bg-me text-black" : "bg-white/[0.07]"} ${p.connected ? "" : "opacity-40"}`}
              >
                <Avatar id={p.avatar} className="text-base" /> {p.name}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {lateJoin && info && (
            <div className="rise-in mb-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-card p-4">
              <div className="min-w-0 flex-1">
                <div className="font-display font-bold">You’re in — {info.name} has already started</div>
                <div className="text-sm text-muted">{info.quickTip}</div>
              </div>
              <button aria-label="Dismiss" onClick={() => setLateJoin(false)} className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center text-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
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
        </>
      )}

      <Sheet open={confirmLeave} onClose={() => setConfirmLeave(false)} title="Leave the party?">
        <p className="text-muted">You’ll be taken out of room {code}. You can join again with the same code.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button tone="ghost" size="lg" onClick={() => setConfirmLeave(false)}>
            Stay
          </Button>
          <Button
            tone="red"
            size="lg"
            onClick={() => {
              leave();
              setTimeout(() => router.push("/"), 250);
            }}
          >
            Leave party
          </Button>
        </div>
      </Sheet>
    </RoomShell>
  );
}
