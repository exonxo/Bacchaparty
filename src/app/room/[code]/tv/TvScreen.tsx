"use client";
import { Maximize } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Sticker } from "@/components/paper/Paper";
import { ResultsCard } from "@/components/ResultsCard";
import { GameIcon } from "@/components/GameIcon";
import { Logo } from "@/components/Header";
import { MuteButton, iconButtonClass } from "@/components/RoomShell";
import { getGameInfo } from "@/games/catalog";
import { getGameModule } from "@/games/modules";
import { RoomAudioProvider } from "@/lib/roomAudio";
import type { RoomSnapshot, SignedRoom } from "@/lib/room";
import { createClockSync, createRoomReceiver } from "@/lib/roomReceiver";
import { serialQueue } from "@/lib/secure";
import { openRoom } from "@/lib/transport";
import { useNow } from "@/lib/useNow";
import { randomId } from "@/lib/util";

const noop = () => {};

/** Optional read-only big screen: shows the shared game view on a TV or laptop. */
export function TvScreen({ code }: { code: string }) {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [offset, setOffset] = useState(0);
  const [qr, setQr] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const now = useNow(offset, 250);

  useEffect(() => {
    const u = `${window.location.origin}/join?code=${code}`;
    setJoinUrl(u.replace(/^https?:\/\//, ""));
    QRCode.toDataURL(u, { margin: 1, width: 300, color: { dark: "#1e1a17", light: "#fffdf8" } }).then(setQr).catch(() => {});
    const t = openRoom(code);
    const id = `tv-${randomId(6)}`;
    t.track(id);
    t.send("sync", { id });
    const receiver = createRoomReceiver(code);
    const clock = createClockSync();
    const queue = serialQueue();
    const off = t.on("room", (msg: SignedRoom) =>
      queue(async () => {
        const snap = await receiver.accept(msg);
        if (!snap) return;
        setOffset(clock(snap.hostNow));
        setRoom(snap);
      }),
    );
    return () => {
      off();
      t.close();
    };
  }, [code]);

  const mod = room?.gameId ? getGameModule(room.gameId) : null;
  // Big-screen game views that haven't been redesigned keep the night palette.
  const playing = room?.phase === "playing" && !mod?.tvPaper;
  useEffect(() => {
    if (!playing) return;
    document.documentElement.dataset.theme = "dark";
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [playing]);
  const info = room?.gameId ? getGameInfo(room.gameId) : null;

  return (
    <main className="min-h-dvh px-6 pb-8 lg:px-10">
      <header className="flex items-center justify-between py-5">
        <Logo />
        <div className="flex items-center gap-3">
          <div className="rounded-cut border-[1.5px] border-line bg-card px-4 py-2 text-p-lead">
            Join at <b>{joinUrl.replace(/\?code=.*/, "")}</b> · code <b className="tracking-[0.2em]">{code}</b>
          </div>
          <MuteButton />
          <button
            aria-label="Full screen"
            onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
            className={iconButtonClass}
          >
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      </header>
      <RoomAudioProvider value={{ together: room?.together ?? true, isStage: true }}>
        {room?.phase === "closed" ? (
          <section className="py-16 text-center">
            <h1 className="text-p-show font-extrabold">The host ended the party</h1>
            <p className="mt-3 text-p-body text-muted">You can close this screen.</p>
          </section>
        ) : room?.phase === "playing" && mod && room.view ? (
          <section>
            <div className="mb-5 flex items-center gap-3 font-display text-3xl font-black">
              {info && <GameIcon id={info.id} className="h-8 w-8" />}
              {info?.name}
            </div>
            <mod.Screen view={room.view} players={room.players} act={noop} now={now} spectator />
          </section>
        ) : (
          <>
          <ResultsCard result={room?.lastResult} big />
          <section className="grid items-center gap-10 py-10 lg:grid-cols-2">
            <div>
              <div className="text-p-lead font-bold uppercase tracking-[0.2em] text-turmeric-ink">Room code</div>
              <div className="font-display text-[9rem] font-extrabold leading-none tracking-[0.12em]">{code}</div>
              <div className="mt-6 flex flex-wrap gap-3">
                {(room?.players ?? []).map((p) => (
                  <div key={p.id} className={`land flex items-center gap-2 rounded-full border-[1.5px] border-line bg-card py-1.5 pl-1.5 pr-4 text-p-title font-bold ${p.connected ? "" : "opacity-40"}`}>
                    <Sticker id={p.avatar} size={44} /> {p.name}
                  </div>
                ))}
              </div>
              {!room && <p className="mt-6 text-xl text-muted">Waiting for the host’s phone…</p>}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- QR is a generated data URL */}
            {qr && <img src={qr} alt="QR code to join" className="cut mx-auto w-72 rounded-cut" />}
          </section>
          </>
        )}
      </RoomAudioProvider>
    </main>
  );
}
