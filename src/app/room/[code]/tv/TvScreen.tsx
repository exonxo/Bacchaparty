"use client";
import { Maximize } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { GameIcon } from "@/components/GameIcon";
import { Logo } from "@/components/Header";
import { MuteButton } from "@/components/RoomShell";
import { Label } from "@/components/ui";
import { getGameInfo } from "@/games/catalog";
import { getGameModule } from "@/games/modules";
import { RoomAudioProvider } from "@/lib/roomAudio";
import type { RoomSnapshot } from "@/lib/room";
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
    QRCode.toDataURL(u, { margin: 1, width: 300, color: { dark: "#0b0b10", light: "#ffffff" } }).then(setQr).catch(() => {});
    const t = openRoom(code);
    const id = `tv-${randomId(6)}`;
    t.track(id);
    t.send("sync", { id });
    const off = t.on("room", (snap: RoomSnapshot) => {
      setOffset(snap.hostNow - Date.now());
      setRoom(snap);
    });
    return () => {
      off();
      t.close();
    };
  }, [code]);

  const mod = room?.gameId ? getGameModule(room.gameId) : null;
  const info = room?.gameId ? getGameInfo(room.gameId) : null;

  return (
    <main className="spotlight min-h-dvh px-6 pb-8 lg:px-10">
      <header className="flex items-center justify-between py-5">
        <Logo />
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/[0.06] px-4 py-2 text-lg">
            Join at <b>{joinUrl.replace(/\?code=.*/, "")}</b> · code <b className="tracking-[0.2em] text-saffron">{code}</b>
          </div>
          <MuteButton />
          <button
            aria-label="Full screen"
            onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.07] text-muted hover:text-ink"
          >
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      </header>
      <RoomAudioProvider value={{ together: room?.together ?? true, isStage: true }}>
        {room?.phase === "playing" && mod && room.view ? (
          <section>
            <div className="mb-5 flex items-center gap-3 font-display text-3xl font-black">
              {info && <GameIcon id={info.id} className="h-8 w-8 text-saffron" />}
              {info?.name}
            </div>
            <mod.Screen view={room.view} players={room.players} act={noop} now={now} spectator />
          </section>
        ) : (
          <section className="grid items-center gap-10 py-10 lg:grid-cols-2">
            <div>
              <Label>Room code</Label>
              <div className="font-display text-[9rem] font-black leading-none tracking-[0.12em] text-saffron">{code}</div>
              <div className="mt-6 flex flex-wrap gap-3">
                {(room?.players ?? []).map((p) => (
                  <div key={p.id} className={`flex items-center gap-2 rounded-full bg-white/[0.07] py-2 pl-2 pr-4 text-xl font-semibold ${p.connected ? "" : "opacity-40"}`}>
                    <Avatar id={p.avatar} /> {p.name}
                  </div>
                ))}
              </div>
              {!room && <p className="mt-6 text-xl text-muted">Waiting for the host’s phone…</p>}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- QR is a generated data URL */}
            {qr && <img src={qr} alt="QR code to join" className="mx-auto w-72 rounded-3xl" />}
          </section>
        )}
      </RoomAudioProvider>
    </main>
  );
}
