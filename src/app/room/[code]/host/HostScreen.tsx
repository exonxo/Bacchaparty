"use client";
import { Check, DoorClosed, Home, Info, MapPin, MonitorSmartphone, Play, QrCode, Share2, Tv, Users, X } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { PartyEnded } from "@/components/PartyEnded";
import { GameIcon } from "@/components/GameIcon";
import { GameStage } from "@/components/GameStage";
import { GameTable, GameTile } from "@/components/paper/GameTile";
import { gameLook } from "@/components/paper/gameLook";
import { PaperButton, PaperSheet, Sticker } from "@/components/paper/Paper";
import { ProfileFields } from "@/components/ProfileForm";
import { RoomShell, iconButtonClass } from "@/components/RoomShell";
import { GAMES, getGameInfo } from "@/games/catalog";
import { getGameModule } from "@/games/modules";
import { playSfx } from "@/lib/sfx";
import { useHostRoom } from "@/lib/useHostRoom";
import { useNow } from "@/lib/useNow";
import { loadIdentity, saveIdentity, type Identity } from "@/lib/usePlayerRoom";
import { useWakeLock } from "@/lib/wakeLock";
import { useOnChange } from "@/lib/roomAudio";

/** Games that need people to see/hear each other — remote players need a video call. */
const NEEDS_CALL = new Set(["charades", "antakshari", "sound-guru", "raja-mantri", "chor-kaun", "odd-word-out"]);
/** Redesigned games first, then the rest. */
const ORDER = ["chor-kaun", "housie", "emoji-picture", "charades", "antakshari", "draw-guess", "kaun-banega-champion", "raja-mantri", "odd-word-out", "ludo-yatra", "sound-guru", "jaldi-bolo"];

function useInvite(code: string) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  useEffect(() => {
    const u = `${window.location.origin}/join?code=${code}`;
    setUrl(u);
    QRCode.toDataURL(u, { margin: 1, width: 360, color: { dark: "#1e1a17", light: "#fffdf8" } }).then(setQr).catch(() => {});
  }, [code]);
  return { url, qr };
}

/** A short message that slides in at the bottom and leaves by itself. */
function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="rise-in pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4" role="status">
      <div className="cut rounded-cut bg-ink px-4 py-2.5 text-p-body font-semibold text-bg">{text}</div>
    </div>
  );
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
      <main className="min-h-dvh">
        <form
          className="mx-auto max-w-md space-y-7 px-4 py-8"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft?.name.trim()) return;
            const id = { ...draft, name: draft.name.trim() };
            saveIdentity(id);
            setMe(id);
          }}
        >
          <div>
            <p className="text-p-note font-bold uppercase tracking-[0.2em] text-turmeric-ink">Room {code}</p>
            <h1 className="mt-1 text-p-show font-extrabold">Aap host ho!</h1>
            <p className="mt-2 text-p-body text-muted">You play too. Pick a name and a sticker.</p>
          </div>
          <ProfileFields me={draft} onChange={setDraft} />
          <PaperButton type="submit" size="lg" className="w-full" disabled={!draft?.name.trim()}>
            Open the lobby
          </PaperButton>
        </form>
      </main>
    );
  }
  return <HostRoom code={code} me={me} />;
}

function HostRoom({ code, me }: { code: string; me: Identity }) {
  const { state, status, role, view, myPriv, clockOffset, startGame, endGame, endParty, removePlayer, setTogether, takeOver, act, sendAsMe } = useHostRoom(code, me);
  const now = useNow(clockOffset, 250);
  useWakeLock(true);
  const { url, qr } = useInvite(code);
  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"qr" | "end" | "endParty" | null>(null);
  const [partyEnded, setPartyEnded] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [optionsByGame, setOptionsByGame] = useState<Record<string, unknown>>({});
  const online = state.players.filter((p) => p.connected);
  const mePlayer = state.players.find((p) => p.id === me.id) ?? { ...me, connected: true };

  useOnChange(online.length, (n, p) => {
    if (n > p) playSfx("pop");
  });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (state.phase === "closed") setPartyEnded(true);
  }, [state.phase]);

  const hostEndParty = () => {
    endParty();
    setSheet(null);
    setPartyEnded(true);
  };

  const endPartyControls = (
    <button type="button" aria-label="End party for everyone" onClick={() => setSheet("endParty")} className={iconButtonClass} title="End party">
      <DoorClosed className="h-5 w-5" />
    </button>
  );

  const playingMod = state.gameId ? getGameModule(state.gameId) : null;
  const playingInfo = state.gameId ? getGameInfo(state.gameId) : null;
  const tvUrl = useMemo(() => (url ? url.replace(/\/join\?code=.*/, `/room/${code}/tv`) : ""), [url, code]);
  const games = useMemo(() => ORDER.map((id) => GAMES.find((g) => g.id === id)!).filter(Boolean), []);

  if (partyEnded) {
    return <PartyEnded asHost />;
  }

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast(done);
    } catch {
      setToast(text);
    }
  }
  async function share() {
    const text = `Bacchaparty khelein? Room code ${code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Bacchaparty", text, url });
        return;
      }
    } catch {
      return;
    }
    await copy(`${text}: ${url}`, "Invite copied — paste it in WhatsApp");
  }

  if (role !== "active") {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        {role === "checking" ? (
          <p className="breathe font-display text-p-title font-extrabold">Room khul raha hai…</p>
        ) : (
          <div className="rise-in max-w-sm">
            <MonitorSmartphone className="mx-auto h-12 w-12" />
            <h1 className="mt-4 text-p-title font-extrabold">{role === "blocked" ? "This room is open on another device" : "Hosting moved to another device"}</h1>
            <p className="mt-2 text-p-body text-muted">
              Only one device can run the room at a time. If you take over here, the game restarts from the lobby unless this device was hosting it before.
            </p>
            <PaperButton size="lg" className="mt-6 w-full" onClick={takeOver}>
              Host from this device
            </PaperButton>
          </div>
        )}
      </main>
    );
  }

  const endGameSheet = (
    <PaperSheet open={sheet === "end"} onClose={() => setSheet(null)} title="End this game?">
      <p className="text-p-body text-muted">Everyone goes back to the lobby. This game’s scores are cleared.</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <PaperButton tone="paper" size="lg" onClick={() => setSheet(null)}>
          Keep playing
        </PaperButton>
        <PaperButton
          tone="vermilion"
          size="lg"
          onClick={() => {
            endGame();
            setSheet(null);
          }}
        >
          End game
        </PaperButton>
      </div>
    </PaperSheet>
  );

  const endPartySheet = (
    <PaperSheet open={sheet === "endParty"} onClose={() => setSheet(null)} title="End the party for everyone?">
      <p className="text-p-body text-muted">All players will leave this room. They cannot join with this code again.</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <PaperButton tone="paper" size="lg" onClick={() => setSheet(null)}>
          Keep party going
        </PaperButton>
        <PaperButton tone="vermilion" size="lg" onClick={hostEndParty}>
          End party
        </PaperButton>
      </div>
    </PaperSheet>
  );

  if (state.phase === "playing" && playingMod && view) {
    return (
      <RoomShell
        me={mePlayer}
        code={code}
        status={status}
        title={playingInfo?.name}
        right={
          <>
            <button onClick={() => setSheet("end")} aria-label="Back to lobby" className={iconButtonClass}>
              <Home className="h-5 w-5" />
            </button>
            {endPartyControls}
          </>
        }
      >
        <GameStage mod={playingMod} view={view} priv={myPriv} me={mePlayer} players={state.players} send={sendAsMe} now={now} isHost hostAct={act} together={state.together} />
        {endGameSheet}
        {endPartySheet}
      </RoomShell>
    );
  }

  const info = selected ? getGameInfo(selected) : null;
  const mod = selected ? getGameModule(selected) : null;
  const look = selected ? gameLook(selected) : null;
  const options = selected ? (optionsByGame[selected] ?? mod?.defaultOptions) : undefined;
  const tooFew = info ? online.length < info.minPlayers : false;
  const tooMany = info ? online.length > info.maxPlayers : false;
  const ready = online.length >= 2;
  const removingPlayer = state.players.find((p) => p.id === removing);

  const invite = (
    <section aria-label="Invite" className={`cut relative rounded-soft bg-card ${ready ? "p-3" : "rotate-[-0.6deg] p-5 text-center"}`}>
      {ready ? (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-p-note font-bold uppercase tracking-[0.18em] text-muted">Room code</div>
            <div className="font-display text-p-title font-extrabold tracking-[0.2em]">{code}</div>
          </div>
          <PaperButton onClick={share}>
            <Share2 className="h-4 w-4" /> Invite
          </PaperButton>
          <button aria-label="Show QR code" onClick={() => setSheet("qr")} className={iconButtonClass}>
            <QrCode className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <>
          <div className="text-p-note font-bold uppercase tracking-[0.2em] text-turmeric-ink">Aap sab invited hain</div>
          <div className="mt-3 flex justify-center gap-2" aria-label={`Room code ${code.split("").join(" ")}`}>
            {code.split("").map((ch, i) => (
              <span key={i} className="cut font-display flex h-16 w-14 items-center justify-center rounded-cut bg-turmeric text-[2.5rem] font-extrabold" style={{ transform: `rotate(${[-3, 2, -1.5, 2.5][i]}deg)` }}>
                {ch}
              </span>
            ))}
          </div>
          <p className="mt-4 text-p-body text-muted">Share the invite, or tell everyone to open bacchaparty and type this code.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <PaperButton size="lg" onClick={share}>
              <Share2 className="h-5 w-5" /> Invite bhejo
            </PaperButton>
            <PaperButton size="lg" tone="paper" onClick={() => setSheet("qr")}>
              <QrCode className="h-5 w-5" /> QR code
            </PaperButton>
          </div>
        </>
      )}
    </section>
  );

  return (
    <RoomShell
      me={mePlayer}
      code={code}
      status={status}
      title="Host"
      right={endPartyControls}
    >
      {invite}

      {/* Players */}
      <section className="mt-6">
        <h2 className="text-p-lead font-extrabold">
          {ready ? "Kaun kaun aaya" : "Waiting for friends…"} <span className="text-muted">· {online.length}</span>
        </h2>
        <ul className="mt-3 flex flex-wrap gap-x-2 gap-y-3">
          {state.players.map((p) => (
            <li key={p.id} className={`land flex items-center gap-2 rounded-full border-[1.5px] border-line bg-card py-1 pl-1 ${p.id === me.id ? "pr-3" : "pr-0"} ${p.connected ? "" : "opacity-45"}`}>
              <Sticker id={p.avatar} size={34} />
              <span className="max-w-[8rem] truncate text-p-body font-bold">{p.name}</span>
              {p.id === me.id ? (
                <span className="text-p-note font-bold uppercase tracking-wider text-turmeric-ink">Host</span>
              ) : (
                <button aria-label={`Remove ${p.name}`} className="-my-1 flex h-11 w-10 items-center justify-center rounded-full text-muted hover:text-vermilion" onClick={() => setRemoving(p.id)}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Where is everyone */}
      <section className="mt-6">
        <div role="radiogroup" aria-label="Where is everyone?" className="grid grid-cols-2 gap-0 rounded-cut border-[1.5px] border-ink p-1">
          {[
            { v: true, icon: Users, label: "Ek hi room mein" },
            { v: false, icon: MapPin, label: "Alag alag jagah" },
          ].map(({ v, icon: Icon, label }) => (
            <button
              key={label}
              role="radio"
              aria-checked={state.together === v}
              onClick={() => setTogether(v)}
              className={`press flex min-h-11 items-center justify-center gap-2 rounded-[3px] text-p-body font-bold transition-colors duration-200 ${state.together === v ? "bg-ink text-bg" : "text-muted"}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-p-note text-muted">
          {state.together
            ? "Same room: shared sounds play only on your phone so it isn’t noisy."
            : "Different places: everyone hears sounds on their own phone. For acting and singing games, start a video call too."}
        </p>
      </section>

      {/* Games */}
      <section className="mt-8">
        <h2 className="text-p-title font-extrabold">Aaj kya khelein?</h2>
        <p className="mb-4 mt-1 text-p-body text-muted">Tap a game to see the rules and start.</p>
        <GameTable>
          {games.map((g, i) => (
            <GameTile key={g.id} game={g} index={i} onSelect={() => setSelected(g.id)} disabled={!getGameModule(g.id)} />
          ))}
        </GameTable>
        <button onClick={() => copy(tvUrl, "Big-screen link copied — open it on a TV or laptop")} className="press mt-6 flex min-h-11 items-center gap-2 text-p-body font-semibold underline decoration-line decoration-2 underline-offset-4">
          <Tv className="h-4 w-4" /> TV ya laptop hai? Copy the big-screen link
        </button>
      </section>

      <PaperSheet
        open={!!info}
        onClose={() => setSelected(null)}
        title={info?.name ?? ""}
        footer={
          info && (
            <>
              <PaperButton
                size="lg"
                className="w-full"
                disabled={!mod || tooFew || tooMany}
                onClick={() => {
                  startGame(info.id, options);
                  setSelected(null);
                }}
              >
                <Play className="h-5 w-5" fill="currentColor" /> Shuru karo · {online.length} {online.length === 1 ? "player" : "players"}
              </PaperButton>
              {(tooFew || tooMany || !mod) && (
                <p className="mt-2 text-center text-p-note font-semibold text-vermilion">
                  {!mod ? "Coming soon" : tooFew ? `Needs at least ${info.minPlayers} players` : `Max ${info.maxPlayers} players`}
                </p>
              )}
            </>
          )
        }
      >
        {info && look && (
          <div>
            <div className="flex items-center gap-3">
              <div className="cut flex h-14 w-14 shrink-0 -rotate-3 items-center justify-center rounded-soft" style={{ background: look.color, color: look.on }}>
                <GameIcon id={info.id} className="h-7 w-7" strokeWidth={2.3} />
              </div>
              <div className="text-p-body text-muted">
                Ages {info.ages} · {info.players} · {info.duration}
              </div>
            </div>
            <p className="mt-4 text-p-body">{info.description}</p>
            {!state.together && NEEDS_CALL.has(info.id) && (
              <p className="mt-3 flex gap-2 border-l-4 border-blue pl-3 text-p-body">
                <Info className="mt-1 h-4 w-4 shrink-0" /> Players in different places need a video call (WhatsApp, Meet) to see or hear each other for this game.
              </p>
            )}
            {mod && !mod.paper && (
              <p className="mt-3 flex gap-2 border-l-4 border-line pl-3 text-p-body text-muted">
                <Tv className="mt-1 h-4 w-4 shrink-0" /> This game still has its old look{mod.Phone ? "" : " and is easier with a big screen"}. A new version is on the way.
              </p>
            )}
            <details className="mt-4 border-y-[1.5px] border-line py-1">
              <summary className="flex min-h-11 cursor-pointer items-center font-display text-p-lead font-extrabold">Kaise khelein</summary>
              <ol className="list-decimal space-y-1.5 pb-2 pl-5 text-p-body">
                {info.howToPlay.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <p className="pb-3 text-p-body text-muted">
                <b className="text-ink">Points:</b> {info.scoring}
              </p>
            </details>
            {mod?.OptionsForm && (
              <div className="mt-4">
                <div className="mb-2 font-display text-p-lead font-extrabold">Settings</div>
                <mod.OptionsForm value={options} onChange={(v) => setOptionsByGame((o) => ({ ...o, [info.id]: v }))} />
              </div>
            )}
          </div>
        )}
      </PaperSheet>

      <PaperSheet open={sheet === "qr"} onClose={() => setSheet(null)} title="Scan karke join karo">
        {/* eslint-disable-next-line @next/next/no-img-element -- QR is a generated data URL */}
        {qr && <img src={qr} alt="QR code to join" className="cut mx-auto w-64 rounded-cut" />}
        <PaperButton tone="paper" className="mt-4 w-full" onClick={() => copy(url, "Link copied")}>
          {toast === "Link copied" ? <Check className="h-4 w-4" /> : null} Copy the link
        </PaperButton>
      </PaperSheet>

      <PaperSheet open={!!removingPlayer} onClose={() => setRemoving(null)} title={`Remove ${removingPlayer?.name ?? ""}?`}>
        <p className="text-p-body text-muted">They won’t be able to rejoin this room.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <PaperButton tone="paper" size="lg" onClick={() => setRemoving(null)}>
            Rehne do
          </PaperButton>
          <PaperButton
            tone="vermilion"
            size="lg"
            onClick={() => {
              if (removing) removePlayer(removing);
              setRemoving(null);
            }}
          >
            Remove
          </PaperButton>
        </div>
      </PaperSheet>
      {endPartySheet}
      <Toast text={toast} />
    </RoomShell>
  );
}
