"use client";
import { LogOut, X } from "lucide-react";
import { PartyEnded } from "@/components/PartyEnded";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { GameStage } from "@/components/GameStage";
import { ResultsCard } from "@/components/ResultsCard";
import { paperButtonClass } from "@/components/paper/classes";
import { BusyPaperButton } from "@/components/loaders";
import { PaperButton, PaperSheet, Sticker } from "@/components/paper/Paper";
import { RoomShell, iconButtonClass } from "@/components/RoomShell";
import { getGameInfo } from "@/games/catalog";
import { getGameModule } from "@/games/modules";
import { playSfx } from "@/lib/sfx";
import { useOnChange } from "@/lib/roomAudio";
import { useNow } from "@/lib/useNow";
import { loadIdentity, saveIdentity, usePlayerRoom, type Identity } from "@/lib/usePlayerRoom";

const noop = () => {};

export function PlayerScreen({ code }: { code: string }) {
  const router = useRouter();
  const [me, setMe] = useState<Identity | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  useEffect(() => {
    const id = loadIdentity();
    if (!id.name) router.replace(`/join?code=${code}`);
    else setMe(id);
  }, [code, router]);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void getBrowserSupabase()
      ?.auth.getUser()
      .then(({ data }) => setAccountEmail(data.user?.email ?? null));
  }, []);
  const onIdentityChange = useCallback((next: Identity) => {
    saveIdentity(next);
    setMe(next);
  }, []);

  const { room, priv, offset, status, send, leave, self, kicked, mismatch, lastRoomAt } = usePlayerRoom(code, me);
  const now = useNow(offset, 250);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
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

  if (room?.phase === "closed") {
    return <PartyEnded />;
  }

  if (kicked) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-p-title font-extrabold">The host removed you from this room</h1>
        <p className="text-p-body text-muted">You can’t rejoin this party, but you can join or host another one.</p>
        <Link href="/" className={paperButtonClass("paper", "lg")}>
          Back to home
        </Link>
      </main>
    );
  }

  return (
    <RoomShell
      me={player}
      identity={me}
      onIdentityChange={onIdentityChange}
      accountEmail={accountEmail}
      code={code}
      status={status}
      title={room?.phase === "playing" ? info?.name : undefined}
      away={away}
      width={room?.phase === "playing" ? "cozy" : "wide"}
      right={
        <button
          aria-label="Leave party"
          onClick={() => setConfirmLeave(true)}
          className={iconButtonClass}
        >
          <LogOut className="h-5 w-5" />
        </button>
      }
    >
      {mismatch && (
        <div role="alert" className="cut mb-4 rounded-cut bg-card p-3">
          <div className="font-display text-p-body font-extrabold">App update ho gaya</div>
          <p className="text-p-body text-muted">The host and this phone are on different versions. Ask the host to refresh their page, then refresh yours.</p>
          <PaperButton className="mt-2" onClick={() => window.location.reload()}>
            Refresh
          </PaperButton>
        </div>
      )}
      {!room ? (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <p className="breathe font-display text-p-title font-extrabold">Party dhoondh rahe hain…</p>
          <p className="mt-2 text-p-body text-muted">Make sure the host has room {code} open.</p>
        </div>
      ) : room.phase === "lobby" || !mod || !room.view ? (
        <>
        <ResultsCard result={room.lastResult} />
        <div className="rise-in flex min-h-[50vh] flex-col items-center justify-center text-center lg:min-h-[60vh]">
          <span className="breathe inline-block">
            <Sticker id={player.avatar} size={96} tilt={-6} />
          </span>
          <h1 className="mt-6 text-p-show font-extrabold">Aa gaye, {me.name}!</h1>
          <p className="mt-2 text-p-lead text-muted">{host ? `${host.name} game chun rahe hain…` : "The host is picking a game…"}</p>
          <h2 className="mb-3 mt-10 text-p-note font-bold uppercase tracking-[0.18em] text-muted">Room mein · {room.players.filter((p) => p.connected).length}</h2>
          <ul className="flex flex-wrap justify-center gap-x-2 gap-y-3">
            {room.players.map((p) => (
              <li
                key={p.id}
                className={`land flex items-center gap-2 rounded-full border-[1.5px] bg-card py-1 pl-1 pr-3 text-p-body font-bold ${p.id === me.id ? "border-ink" : "border-line"} ${p.connected ? "" : "opacity-45"}`}
              >
                <Sticker id={p.avatar} size={30} /> {p.name}
                {p.id === me.id && <span className="text-p-note font-bold uppercase tracking-wider text-turmeric-ink">You</span>}
              </li>
            ))}
          </ul>
        </div>
        </>
      ) : (
        <>
          {lateJoin && info && mod?.id !== "puno" && (
            <div className="rise-in cut mb-4 flex items-start gap-3 rounded-cut bg-card p-3">
              <div className="min-w-0 flex-1">
                <div className="font-display text-p-body font-extrabold">Aa gaye! {info.name} has already started</div>
                <div className="text-p-body text-muted">{info.quickTip}</div>
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
            tvOn={!!room.tvOn}
          />
        </>
      )}

      <PaperSheet open={confirmLeave} onClose={() => setConfirmLeave(false)} title="Party chhod rahe ho?">
        <p className="text-p-body text-muted">You’ll be taken out of room {code}. You can join again with the same code.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <PaperButton tone="paper" size="lg" onClick={() => setConfirmLeave(false)}>
            Ruko, khelte hain
          </PaperButton>
          <BusyPaperButton
            tone="vermilion"
            size="lg"
            loading={leaving}
            busyLabel="Leaving party…"
            onClick={() => {
              setLeaving(true);
              leave();
              setTimeout(() => router.push("/"), 250);
            }}
          >
            Leave party
          </BusyPaperButton>
        </div>
      </PaperSheet>
    </RoomShell>
  );
}
