"use client";
import { Check, Copy, Home, Info, MapPin, Play, QrCode, Share2, Tv, Users, X } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { GameCard, PosterRow } from "@/components/GameCard";
import { GameIcon } from "@/components/GameIcon";
import { GameStage } from "@/components/GameStage";
import { ProfileFields } from "@/components/ProfileForm";
import { RoomShell } from "@/components/RoomShell";
import { Button, Label, Panel, Sheet } from "@/components/ui";
import { CATEGORIES, GAMES, getGameInfo } from "@/games/catalog";
import { getGameModule } from "@/games/modules";
import { playSfx } from "@/lib/sfx";
import { useHostRoom } from "@/lib/useHostRoom";
import { useNow } from "@/lib/useNow";
import { loadIdentity, saveIdentity, type Identity } from "@/lib/usePlayerRoom";
import { useWakeLock } from "@/lib/wakeLock";
import { useOnChange } from "@/lib/roomAudio";

/** Games that need people to see/hear each other — remote players need a video call. */
const NEEDS_CALL = new Set(["charades", "antakshari", "sound-guru", "raja-mantri", "chor-kaun", "odd-word-out"]);

function useInvite(code: string) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  useEffect(() => {
    const u = `${window.location.origin}/join?code=${code}`;
    setUrl(u);
    QRCode.toDataURL(u, { margin: 1, width: 360, color: { dark: "#0b0b10", light: "#ffffff" } }).then(setQr).catch(() => {});
  }, [code]);
  return { url, qr };
}

export function HostScreen({ code, defaultName }: { code: string; defaultName: string }) {
  const [me, setMe] = useState<Identity | null>(null);
  const [draft, setDraft] = useState<Identity | null>(null);
  useEffect(() => {
    const id = loadIdentity();
    if (id.name) setMe(id);
    else setDraft({ ...id, name: defaultName });
  }, [defaultName]);

  if (!me) {
    return (
      <main className="spotlight min-h-dvh">
        <form
          className="mx-auto max-w-md space-y-6 px-4 py-8"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft?.name.trim()) return;
            const id = { ...draft, name: draft.name.trim() };
            saveIdentity(id);
            setMe(id);
          }}
        >
          <Label>Room {code}</Label>
          <h1 className="font-display text-3xl font-black">You’re the host. What should we call you?</h1>
          <ProfileFields me={draft} onChange={setDraft} />
          <Button type="submit" size="xl" className="w-full" disabled={!draft?.name.trim()}>
            Open the lobby
          </Button>
        </form>
      </main>
    );
  }
  return <HostRoom code={code} me={me} />;
}

function HostRoom({ code, me }: { code: string; me: Identity }) {
  const { state, status, view, myPriv, startGame, endGame, removePlayer, setTogether, act, sendAsMe } = useHostRoom(code, me);
  const now = useNow(0, 250);
  useWakeLock(true);
  const { url, qr } = useInvite(code);
  const [selected, setSelected] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [optionsByGame, setOptionsByGame] = useState<Record<string, unknown>>({});
  const online = state.players.filter((p) => p.connected);
  const mePlayer = state.players.find((p) => p.id === me.id) ?? { ...me, connected: true };

  useOnChange(online.length, (n, p) => {
    if (n > p) playSfx("pop");
  });

  const playingMod = state.gameId ? getGameModule(state.gameId) : null;
  const playingInfo = state.gameId ? getGameInfo(state.gameId) : null;
  const tvUrl = useMemo(() => (url ? url.replace(/\/join\?code=.*/, `/room/${code}/tv`) : ""), [url, code]);

  async function share() {
    const text = `Join my Bacchaparty! Room code ${code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Bacchaparty", text, url });
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}: ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  if (state.phase === "playing" && playingMod && view) {
    return (
      <RoomShell
        me={mePlayer}
        code={code}
        status={status}
        title={playingInfo?.name}
        right={
          <button
            onClick={() => confirm("End this game and go back to the lobby?") && endGame()}
            aria-label="Back to lobby"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.07] px-3 text-sm font-semibold text-muted hover:text-ink"
          >
            <Home className="h-4 w-4" /> <span className="hidden min-[400px]:inline">Lobby</span>
          </button>
        }
      >
        <GameStage
          mod={playingMod}
          view={view}
          priv={myPriv}
          me={mePlayer}
          players={state.players}
          send={sendAsMe}
          now={now}
          isHost
          hostAct={act}
          together={state.together}
        />
      </RoomShell>
    );
  }

  const info = selected ? getGameInfo(selected) : null;
  const mod = selected ? getGameModule(selected) : null;
  const options = selected ? (optionsByGame[selected] ?? mod?.defaultOptions) : undefined;
  const tooFew = info ? online.length < info.minPlayers : false;
  const tooMany = info ? online.length > info.maxPlayers : false;

  return (
    <RoomShell me={mePlayer} code={code} status={status} title="Host">
      {/* Invite */}
      <Panel className="glow relative overflow-hidden text-center">
        <Label>Room code</Label>
        <div className="my-1 font-display text-6xl font-black tracking-[0.18em] text-saffron">{code}</div>
        <div className="text-sm text-muted">Friends open bacchaparty and tap Join, or use your invite link.</div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Button size="sm" onClick={share} className="flex items-center justify-center gap-1.5">
            {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />} {copied ? "Copied" : "Invite"}
          </Button>
          <Button size="sm" tone="ghost" onClick={() => setShowQr(true)} className="flex items-center justify-center gap-1.5">
            <QrCode className="h-4 w-4" /> QR
          </Button>
          <Button
            size="sm"
            tone="ghost"
            className="flex items-center justify-center gap-1.5"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(tvUrl);
                alert("Big-screen link copied. Open it on a TV or laptop browser.");
              } catch {
                alert(tvUrl);
              }
            }}
          >
            <Tv className="h-4 w-4" /> Big screen
          </Button>
        </div>
      </Panel>

      {/* Where is everyone */}
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-white/[0.04] p-1.5">
        {[
          { v: true, icon: Users, label: "Same room" },
          { v: false, icon: MapPin, label: "Different places" },
        ].map(({ v, icon: Icon, label }) => (
          <button
            key={label}
            onClick={() => setTogether(v)}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${
              state.together === v ? "bg-white/[0.12] text-ink" : "text-muted"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      <p className="mt-2 px-1 text-xs text-muted">
        {state.together
          ? "Shared sounds play only on your phone so the room isn’t noisy."
          : "Everyone hears sounds on their own phone. For acting and singing games, start a video call too."}
      </p>

      {/* Players */}
      <div className="mt-6">
        <Label className="mb-2">Players · {online.length}</Label>
        <div className="flex flex-wrap gap-2">
          {state.players.map((p) => (
            <div key={p.id} className={`rise-in flex items-center gap-2 rounded-full bg-white/[0.07] py-1.5 pl-1.5 pr-3 ${p.connected ? "" : "opacity-40"}`}>
              <Avatar id={p.avatar} className="text-lg" />
              <span className="max-w-[8rem] truncate text-sm font-semibold">{p.name}</span>
              {p.id === me.id ? (
                <span className="text-[10px] font-bold uppercase tracking-wider text-saffron">Host</span>
              ) : (
                <button aria-label={`Remove ${p.name}`} className="text-muted hover:text-red" onClick={() => removePlayer(p.id)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {online.length < 2 && <div className="py-1.5 text-sm text-muted">Waiting for friends to join…</div>}
        </div>
      </div>

      {/* Games */}
      <div className="-mx-4 mt-2">
        <h2 className="mt-8 px-4 font-display text-2xl font-black">Pick a game</h2>
        {CATEGORIES.map((cat) => {
          const list = GAMES.filter((g) => g.category === cat);
          if (!list.length) return null;
          return (
            <PosterRow key={cat} title={cat}>
              {list.map((g) => (
                <GameCard key={g.id} game={g} playable={!!getGameModule(g.id)} onSelect={() => setSelected(g.id)} />
              ))}
            </PosterRow>
          );
        })}
      </div>

      <Sheet open={!!info} onClose={() => setSelected(null)}>
        {info && (
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: info.color, color: "#0b0b10" }}>
                <GameIcon id={info.id} className="h-7 w-7" strokeWidth={2.3} />
              </div>
              <div>
                <div className="font-display text-2xl font-black">{info.name}</div>
                <div className="text-sm text-muted">
                  Ages {info.ages} · {info.players} · {info.duration}
                </div>
              </div>
            </div>
            <p className="mt-4 text-ink/85">{info.description}</p>
            {!state.together && NEEDS_CALL.has(info.id) && (
              <div className="mt-3 flex gap-2 rounded-xl bg-blue/10 p-3 text-sm text-blue">
                <Info className="mt-0.5 h-4 w-4 shrink-0" /> Players in different places need a video call (WhatsApp, Meet) to see or hear each
                other for this game.
              </div>
            )}
            {mod && !mod.Phone && (
              <div className="mt-3 flex gap-2 rounded-xl bg-white/[0.05] p-3 text-sm text-muted">
                <Tv className="mt-0.5 h-4 w-4 shrink-0" /> Classic mode: best with a big screen. A phone-first version is coming.
              </div>
            )}
            <details className="mt-4 rounded-xl bg-white/[0.04] p-3">
              <summary className="cursor-pointer font-bold">How to play</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink/85">
                {info.howToPlay.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <div className="mt-2 text-sm text-muted">
                <b className="text-ink">Scoring:</b> {info.scoring}
              </div>
            </details>
            {mod?.OptionsForm && (
              <div className="mt-4">
                <Label className="mb-2">Settings</Label>
                <mod.OptionsForm value={options} onChange={(v) => setOptionsByGame((o) => ({ ...o, [info.id]: v }))} />
              </div>
            )}
            <Button
              size="xl"
              className="mt-6 flex w-full items-center justify-center gap-2"
              disabled={!mod || tooFew || tooMany}
              onClick={() => {
                startGame(info.id, options);
                setSelected(null);
              }}
            >
              <Play className="h-5 w-5" fill="currentColor" /> Start · {online.length} {online.length === 1 ? "player" : "players"}
            </Button>
            {(tooFew || tooMany || !mod) && (
              <div className="mt-2 text-center text-sm text-muted">
                {!mod ? "Coming soon" : tooFew ? `Needs at least ${info.minPlayers} players` : `Max ${info.maxPlayers} players`}
              </div>
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={showQr} onClose={() => setShowQr(false)} title="Scan to join">
        {/* eslint-disable-next-line @next/next/no-img-element -- QR is a generated data URL */}
        {qr && <img src={qr} alt="QR code to join" className="mx-auto w-64 rounded-2xl" />}
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted">
          <span className="truncate">{url}</span>
          <button aria-label="Copy link" onClick={() => navigator.clipboard?.writeText(url)}>
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </Sheet>
    </RoomShell>
  );
}
