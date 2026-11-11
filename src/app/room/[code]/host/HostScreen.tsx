"use client";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { Button, Panel, PlayerChip } from "@/components/ui";
import { GAMES, getGameInfo } from "@/games/catalog";
import { getGameModule, isPlayable } from "@/games/modules";
import { useHostRoom } from "@/lib/useHostRoom";
import { useNow } from "@/lib/useNow";

function useJoinUrl(code: string) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  useEffect(() => {
    const u = `${window.location.origin}/join?code=${code}`;
    setUrl(u);
    QRCode.toDataURL(u, { margin: 1, width: 320, color: { dark: "#1a0b2e", light: "#ffffff" } }).then(setQr).catch(() => {});
  }, [code]);
  return { url, qr };
}

export function HostScreen({ code }: { code: string }) {
  const { state, status, view, startGame, endGame, removePlayer, act } = useHostRoom(code);
  const { url, qr } = useJoinUrl(code);
  const now = useNow(0, 250);
  const [selected, setSelected] = useState<string>(GAMES.find((g) => isPlayable(g.id))?.id ?? GAMES[0].id);
  const [optionsByGame, setOptionsByGame] = useState<Record<string, unknown>>({});
  const online = state.players.filter((p) => p.connected);

  const info = getGameInfo(selected)!;
  const mod = getGameModule(selected);
  const options = optionsByGame[selected] ?? mod?.defaultOptions;
  const tooFew = online.length < info.minPlayers;
  const tooMany = online.length > info.maxPlayers;

  const playingInfo = state.gameId ? getGameInfo(state.gameId) : null;
  const playingMod = state.gameId ? getGameModule(state.gameId) : null;

  const shortUrl = useMemo(() => url.replace(/^https?:\/\//, "").replace(/\?code=.*/, ""), [url]);

  return (
    <main className="min-h-screen px-4 pb-10 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 py-4">
        <Link href="/" className="text-2xl font-extrabold">
          🪅 Baccha<span className="text-saffron">party</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/10 px-4 py-2 text-lg">
            Join at <span className="font-bold">{shortUrl}</span> · code <span className="font-extrabold tracking-[0.2em] text-gold">{code}</span>
          </div>
          <span className={`h-3 w-3 rounded-full ${status === "connected" ? "bg-green" : status === "error" ? "bg-red" : "bg-gold"}`} title={status} />
          <Button tone="ghost" size="sm" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>
            ⛶ Full screen
          </Button>
          {state.phase === "playing" && (
            <Button tone="red" size="sm" onClick={() => confirm("End this game and go back to the lobby?") && endGame()}>
              End game
            </Button>
          )}
        </div>
      </header>

      {state.phase === "playing" && playingMod && view ? (
        <section>
          <div className="mb-4 flex items-center gap-3 text-3xl font-extrabold">
            <span>{playingInfo?.emoji}</span>
            <span>{playingInfo?.name}</span>
          </div>
          <playingMod.Screen view={view} players={state.players} act={act} now={now} />
        </section>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[22rem_1fr]">
          <div className="space-y-6">
            <Panel className="text-center">
              <div className="text-sm font-bold uppercase tracking-widest text-muted">Room code</div>
              <div className="my-2 text-7xl font-extrabold tracking-[0.2em] text-gold">{code}</div>
              {/* eslint-disable-next-line @next/next/no-img-element -- QR is a generated data URL */}
              {qr && <img src={qr} alt="QR code to join" className="mx-auto w-48 rounded-2xl" />}
              <div className="mt-3 text-muted">Scan or open {shortUrl}/join on your phone</div>
            </Panel>
            <Panel>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-bold uppercase tracking-widest text-muted">Players ({online.length})</div>
              </div>
              {state.players.length === 0 ? (
                <div className="text-muted">Waiting for people to join…</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {state.players.map((p) => (
                    <PlayerChip
                      key={p.id}
                      player={p}
                      extra={
                        <button className="ml-1 text-muted hover:text-red" title="Remove" onClick={() => removePlayer(p.id)}>
                          ✕
                        </button>
                      }
                    />
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {GAMES.map((g) => {
                const playable = isPlayable(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelected(g.id)}
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                      selected === g.id ? "border-gold bg-gold/15" : "border-white/10 bg-card/70 hover:border-white/30"
                    } ${playable ? "" : "opacity-50"}`}
                  >
                    <span className="text-3xl">{g.emoji}</span>
                    <span>
                      <span className="block font-bold leading-tight">{g.name}</span>
                      <span className="text-xs text-muted">{playable ? g.players : "Coming soon"}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <Panel>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-5xl">{info.emoji}</span>
                  <div>
                    <div className="text-3xl font-extrabold">{info.name}</div>
                    <div className="text-muted">
                      Ages {info.ages} · {info.players} · {info.duration}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Button
                    size="xl"
                    disabled={!mod || tooFew || tooMany}
                    onClick={() => startGame(selected, options)}
                  >
                    ▶ Start
                  </Button>
                  <div className="mt-1 text-sm text-muted">
                    {!mod
                      ? "Coming soon"
                      : tooFew
                        ? `Needs at least ${info.minPlayers} player${info.minPlayers > 1 ? "s" : ""}`
                        : tooMany
                          ? `Max ${info.maxPlayers} players`
                          : `${online.length} ready`}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-lg">{info.description}</p>
              <div className="mt-4 grid gap-6 md:grid-cols-2">
                <div>
                  <div className="mb-2 font-bold text-saffron">How to play</div>
                  <ol className="list-decimal space-y-1 pl-5 text-ink/90">
                    {info.howToPlay.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                  <div className="mt-3 text-sm text-muted">
                    <span className="font-bold text-ink">Scoring: </span>
                    {info.scoring}
                  </div>
                </div>
                {mod?.OptionsForm && (
                  <div>
                    <div className="mb-2 font-bold text-saffron">Settings</div>
                    <mod.OptionsForm value={options} onChange={(v) => setOptionsByGame((o) => ({ ...o, [selected]: v }))} />
                  </div>
                )}
              </div>
            </Panel>
          </div>
        </section>
      )}
      <div className="sr-only">{now}</div>
    </main>
  );
}
