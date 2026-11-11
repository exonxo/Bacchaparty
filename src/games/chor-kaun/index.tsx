"use client";
import {
  Check, Eye, EyeOff, Gavel, MapPin, MessageCircleQuestion, Search, ShieldCheck, SkipForward, Sparkles, Timer as TimerIcon, Trophy, VenetianMask, Vote,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { Button, Label, LevelPicker, NumberPicker, Panel, PhoneMessage, PlayerChip, Scoreboard, Sheet } from "@/components/ui";
import { locationsFor, type ChorLocation } from "@/content/chor-kaun";
import { celebrate } from "@/lib/celebrate";
import { useOnChange, useSfx } from "@/lib/roomAudio";
import { HOST_ID, type ControllerProps, type GameModule, type Level, type PhoneProps, type Player, type ScreenProps } from "@/lib/types";
import { pick, shuffle } from "@/lib/util";

interface Options {
  level: Level;
  minutes: number;
}

type Reason = "vote" | "timer" | "guess" | "host";

interface Result {
  reason: Reason;
  accused: string | null;
  caught: boolean;
  chorGuess: string | null;
  chorGuessCorrect: boolean;
}

interface State {
  options: Options;
  round: number;
  participants: string[];
  location: ChorLocation;
  roles: Record<string, string>;
  chorId: string;
  firstAsker: string;
  votes: Record<string, string>;
  deadline: number;
  phase: "playing" | "reveal";
  result: Result | null;
  scores: Record<string, number>;
  usedLocations: string[];
}

interface Pub {
  round: number;
  phase: State["phase"];
  participants: string[];
  firstAsker: string;
  deadline: number;
  voteCounts: Record<string, number>;
  voted: string[];
  locations: { name: string; emoji: string }[];
  scores: Record<string, number>;
  reveal: null | {
    location: { name: string; emoji: string };
    chorId: string;
    roles: Record<string, string>;
    result: Result;
  };
}

type Priv =
  | { chor: true; myVote: string | null }
  | { chor: false; location: string; emoji: string; role: string; myVote: string | null };

function fmt(left: number) {
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

/** mm:ss timer pill. */
function TimerPill({ deadline, now, big = false }: { deadline: number; now: number; big?: boolean }) {
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full font-display font-bold tabular-nums ${left <= 30 ? "bg-red text-white" : "bg-white/[0.08]"} ${
        big ? "px-8 py-4 text-6xl" : "px-3 py-1.5 text-base"
      }`}
    >
      <TimerIcon className={big ? "h-12 w-12" : "h-4 w-4"} />
      {fmt(left)}
    </div>
  );
}

function activeIds(players: Player[], fallback: string[]): string[] {
  const online = players.filter((p) => p.connected).map((p) => p.id);
  return online.length >= 3 ? online : fallback;
}

function deal(options: Options, participants: string[], now: number, scores: Record<string, number>, round: number, used: string[]): State {
  const pool = locationsFor(options.level);
  const fresh = pool.filter((l) => !used.includes(l.name));
  const location = pick(fresh.length ? fresh : pool);
  const chorId = pick(participants);
  const roleList = shuffle(location.roles);
  const roles: Record<string, string> = {};
  participants.forEach((id, i) => {
    if (id !== chorId) roles[id] = roleList[i % roleList.length];
  });
  const nextScores = { ...scores };
  participants.forEach((id) => (nextScores[id] ??= 0));
  return {
    options,
    round,
    participants,
    location,
    roles,
    chorId,
    firstAsker: pick(participants),
    votes: {},
    deadline: now + options.minutes * 60_000,
    phase: "playing",
    result: null,
    scores: nextScores,
    usedLocations: [...(fresh.length ? used : []), location.name],
  };
}

function tally(s: State): { counts: Record<string, number>; leader: string | null } {
  const counts: Record<string, number> = {};
  Object.values(s.votes).forEach((t) => (counts[t] = (counts[t] ?? 0) + 1));
  let leader: string | null = null;
  let best = 0;
  let tie = false;
  for (const [id, n] of Object.entries(counts)) {
    if (n > best) {
      best = n;
      leader = id;
      tie = false;
    } else if (n === best) tie = true;
  }
  return { counts, leader: tie ? null : leader };
}

function finish(s: State, reason: Reason, chorGuess: string | null = null): State {
  let accused: string | null = null;
  let caught = false;
  let chorGuessCorrect = false;
  const scores = { ...s.scores };
  const others = s.participants.filter((id) => id !== s.chorId);
  if (reason === "guess") {
    chorGuessCorrect = chorGuess === s.location.name;
    if (chorGuessCorrect) scores[s.chorId] = (scores[s.chorId] ?? 0) + 3;
    else {
      caught = true;
      others.forEach((id) => (scores[id] = (scores[id] ?? 0) + 1));
    }
  } else {
    accused = tally(s).leader;
    caught = accused === s.chorId;
    if (caught) others.forEach((id) => (scores[id] = (scores[id] ?? 0) + 1));
    else scores[s.chorId] = (scores[s.chorId] ?? 0) + 2;
  }
  return { ...s, phase: "reveal", scores, result: { reason, accused, caught, chorGuess, chorGuessCorrect } };
}

/** Voting closes early when a majority of the non-Chor players agree on one person. */
function checkMajority(s: State): State {
  const nonChor = s.participants.filter((id) => id !== s.chorId);
  const counts: Record<string, number> = {};
  for (const [voter, target] of Object.entries(s.votes)) {
    if (voter === s.chorId) continue;
    counts[target] = (counts[target] ?? 0) + 1;
  }
  const hit = Object.values(counts).some((n) => n > nonChor.length / 2);
  return hit ? finish(s, "vote") : s;
}

function nameOf(players: Player[], id: string | null | undefined) {
  return players.find((p) => p.id === id)?.name ?? "Someone";
}

function resultText(r: Result, players: Player[], chorId: string): string {
  const chor = nameOf(players, chorId);
  if (r.reason === "guess") return r.chorGuessCorrect ? `${chor} guessed the place — the Chor wins!` : `${chor} guessed “${r.chorGuess}” — wrong! Chor caught!`;
  if (r.caught) return `The Chor was caught — it was ${chor}!`;
  if (!r.accused) return `No clear vote — ${chor} the Chor escapes!`;
  return `${nameOf(players, r.accused)} was innocent! ${chor} the Chor escapes!`;
}

function Screen({ view, players, act, now, spectator }: ScreenProps<Pub>) {
  const parts = view.participants.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {view.phase === "playing" ? (
          <Panel className="space-y-5 py-8 text-center">
            <Label>Round {view.round}</Label>
            <div className="flex items-center justify-center gap-3 font-display text-4xl font-black">
              <EyeOff className="h-9 w-9 text-saffron" /> Check your phone secretly
            </div>
            <div className="text-2xl">
              <span className="font-bold text-saffron">{nameOf(players, view.firstAsker)}</span> asks the first question.
            </div>
            <TimerPill deadline={view.deadline} now={now} big />
            <div className="text-muted">Vote anytime on your phone. The Chor can guess the place anytime.</div>
            {!spectator && (
              <Button tone="ghost" onClick={() => confirm("Stop the round and count votes now?") && act("end")}>
                Stop & count votes
              </Button>
            )}
          </Panel>
        ) : (
          view.reveal && (
            <Panel className="pop-in space-y-4 py-8 text-center">
              <MapPin className="mx-auto h-12 w-12 text-saffron" />
              <div className="text-xl text-muted">The place was</div>
              <div className="font-display text-5xl font-black text-saffron">{view.reveal.location.name}</div>
              <div className="text-2xl font-bold">{resultText(view.reveal.result, players, view.reveal.chorId)}</div>
              <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2">
                {parts.map((p) => (
                  <PlayerChip
                    key={p.id}
                    player={p}
                    highlight={p.id === view.reveal!.chorId}
                    extra={<span className="text-sm opacity-80">· {p.id === view.reveal!.chorId ? "Chor" : view.reveal!.roles[p.id]}</span>}
                  />
                ))}
              </div>
              {!spectator && (
                <Button size="lg" onClick={() => act("next")}>
                  Next round
                </Button>
              )}
            </Panel>
          )
        )}
        <Panel>
          <Label className="mb-3">Votes</Label>
          <div className="flex flex-wrap gap-2">
            {parts.map((p) => (
              <PlayerChip
                key={p.id}
                player={p}
                extra={
                  <span className="flex items-center gap-1 text-sm">
                    {view.voted.includes(p.id) ? <Check className="h-4 w-4 text-green" /> : <span className="text-muted">…</span>}
                    {view.voteCounts[p.id] ? (
                      <span className="flex items-center gap-0.5 text-saffron">
                        <Vote className="h-3.5 w-3.5" /> {view.voteCounts[p.id]}
                      </span>
                    ) : null}
                  </span>
                }
              />
            ))}
          </div>
        </Panel>
        <Panel>
          <Label className="mb-3">Possible places</Label>
          <div className="flex flex-wrap gap-2">
            {view.locations.map((l) => (
              <span key={l.name} className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-3 py-1 text-sm">
                <MapPin className="h-3.5 w-3.5 text-muted" /> {l.name}
              </span>
            ))}
          </div>
        </Panel>
      </div>
      <Scoreboard players={players} scores={view.scores} />
    </div>
  );
}

/** Did this player win the round that was just revealed? */
function iWon(r: NonNullable<Pub["reveal"]>, meId: string): boolean {
  const chorWon = r.result.reason === "guess" ? r.result.chorGuessCorrect : !r.result.caught;
  return r.chorId === meId ? chorWon : !chorWon;
}

/** Two-tap confirm for host actions (no browser dialogs on phones). */
function ConfirmButton({ label, confirmLabel, onConfirm, icon, now, tone = "ghost" }: { label: string; confirmLabel: string; onConfirm: () => void; icon: ReactNode; now: number; tone?: "ghost" | "saffron" }) {
  const [armedAt, setArmedAt] = useState<number | null>(null);
  const armed = armedAt !== null && now - armedAt < 3000;
  return (
    <Button
      tone={armed ? "red" : tone}
      className="flex w-full items-center justify-center gap-2"
      onClick={() => {
        if (armed) {
          setArmedAt(null);
          onConfirm();
        } else setArmedAt(now);
      }}
    >
      {icon} {armed ? confirmLabel : label}
    </Button>
  );
}

function ScoresSheet({ open, onClose, players, scores }: { open: boolean; onClose: () => void; players: Player[]; scores: Record<string, number> }) {
  return (
    <Sheet open={open} onClose={onClose} title="Scores">
      <Scoreboard players={players} scores={scores} title="Total points" />
    </Sheet>
  );
}

function Phone({ view, priv, me, players, send, now, isHost, hostAct }: PhoneProps<Pub, Priv>) {
  const [hidden, setHidden] = useState(false);
  const [guessOpen, setGuessOpen] = useState(false);
  const [guessPick, setGuessPick] = useState<string | null>(null);
  const [scoresOpen, setScoresOpen] = useState(false);
  const { shared, mine } = useSfx();

  const reveal = view.phase === "reveal" ? view.reveal : null;
  const secsLeft = view.phase === "playing" ? Math.max(0, Math.ceil((view.deadline - now) / 1000)) : -1;
  const myVote = priv?.myVote ?? null;

  useOnChange(secsLeft, (n) => {
    if (n > 0 && n <= 10) shared("tick");
  });
  useOnChange(myVote, (v) => {
    if (v) mine("ding", [40]);
  });
  useOnChange(reveal ? `${view.round}` : null, (r) => {
    if (!r || !reveal) return;
    shared("reveal");
    if (!view.participants.includes(me.id)) return;
    if (iWon(reveal, me.id)) {
      mine("fanfare", [60, 40, 60]);
      celebrate();
    } else if (reveal.chorId === me.id) mine("buzz", [200]);
  });
  // A new round closes any open chor sheet.
  useOnChange(view.round, () => {
    setGuessOpen(false);
    setGuessPick(null);
    setHidden(false);
  });

  const parts = view.participants.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  const myScore = view.scores[me.id] ?? 0;

  const topBar = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="font-display text-sm font-bold uppercase tracking-[0.18em] text-muted">Round {view.round}</span>
        <button onClick={() => setScoresOpen(true)} className="flex items-center gap-1 rounded-full bg-white/[0.07] px-2.5 py-1 text-sm font-bold">
          <Trophy className="h-3.5 w-3.5 text-saffron" /> {myScore}
        </button>
      </div>
      {view.phase === "playing" && <TimerPill deadline={view.deadline} now={now} />}
    </div>
  );

  if (reveal) {
    const won = iWon(reveal, me.id);
    const played = view.participants.includes(me.id);
    const wasChor = reveal.chorId === me.id;
    return (
      <div className="space-y-4">
        {topBar}
        <Panel className="pop-in relative overflow-hidden text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,color-mix(in_srgb,var(--saffron)_22%,transparent),transparent_70%)]" />
          <div className="relative">
            <Label>The place was</Label>
            <div className="mt-2 flex items-center justify-center gap-2 font-display text-3xl font-black text-saffron">
              <MapPin className="h-7 w-7" /> {reveal.location.name}
            </div>
            <div className="mt-3 text-lg font-semibold">{resultText(reveal.result, players, reveal.chorId)}</div>
            {played && (
              <div className={`mx-auto mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-display font-bold ${won ? "bg-green text-black" : "bg-white/[0.08] text-muted"}`}>
                {won ? <Sparkles className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                {won ? "You win this round" : wasChor ? "You were caught" : "The Chor got away"}
              </div>
            )}
          </div>
        </Panel>
        <Panel>
          <Label className="mb-3">Who was who</Label>
          <ul className="space-y-2">
            {parts.map((p) => {
              const isChor = p.id === reveal.chorId;
              return (
                <li key={p.id} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${isChor ? "bg-red/15" : "bg-white/[0.04]"}`}>
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar id={p.avatar} className="text-lg" />
                    <span className="truncate font-semibold">{p.name}</span>
                  </span>
                  <span className={`flex shrink-0 items-center gap-1 text-sm ${isChor ? "font-bold text-red" : "text-muted"}`}>
                    {isChor && <VenetianMask className="h-4 w-4" />}
                    {isChor ? "Chor" : reveal.roles[p.id]}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
        <Scoreboard players={players} scores={view.scores} />
        {isHost ? (
          <Button size="xl" className="flex w-full items-center justify-center gap-2" onClick={() => hostAct("next")}>
            <SkipForward className="h-5 w-5" /> Next round
          </Button>
        ) : (
          <div className="text-center text-sm text-muted">Waiting for the host to start the next round…</div>
        )}
        <ScoresSheet open={scoresOpen} onClose={() => setScoresOpen(false)} players={players} scores={view.scores} />
      </div>
    );
  }

  const inRound = view.participants.includes(me.id);
  const others = parts.filter((p) => p.id !== me.id);
  const votedCount = view.voted.length;
  const asker = view.firstAsker === me.id ? "You ask" : `${nameOf(players, view.firstAsker)} asks`;

  return (
    <div className="space-y-4">
      {topBar}
      <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
        <MessageCircleQuestion className="h-4 w-4 shrink-0 text-saffron" />
        <span>
          <b>{asker}</b> the first question.
        </span>
      </div>

      {!inRound ? (
        <PhoneMessage icon={<Eye className="h-10 w-10" />} title="You’ll join next round">
          Watch and listen — try to spot the Chor!
        </PhoneMessage>
      ) : !priv ? (
        <PhoneMessage title="Dealing cards…" />
      ) : (
        <>
          {/* Secret card */}
          <button onClick={() => setHidden((h) => !h)} className="block w-full text-left" aria-label={hidden ? "Show my card" : "Hide my card"}>
            <div
              className={`relative overflow-hidden rounded-2xl border p-5 text-center transition ${
                priv.chor ? "border-red/50 bg-red/[0.08]" : "glow-me border-transparent bg-card"
              }`}
            >
              {hidden ? (
                <div className="flex flex-col items-center gap-2 py-6 text-muted">
                  <EyeOff className="h-8 w-8" />
                  <div className="font-display text-lg font-bold">Hidden — tap to peek</div>
                </div>
              ) : priv.chor ? (
                <div className="rise-in py-2">
                  <VenetianMask className="mx-auto h-14 w-14 text-red" strokeWidth={1.75} />
                  <div className="mt-2 font-display text-3xl font-black text-red">You are the Chor</div>
                  <div className="mt-1 text-muted">Blend in and work out the place.</div>
                </div>
              ) : (
                <div className="rise-in py-2">
                  <Label>Secret place</Label>
                  <div className="mt-2 flex items-center justify-center gap-2 font-display text-3xl font-black text-me">
                    <MapPin className="h-7 w-7" /> {priv.location}
                  </div>
                  <div className="mt-2 text-lg">
                    You are the <b>{priv.role}</b>
                  </div>
                </div>
              )}
              {!hidden && (
                <div className="mt-3 flex items-center justify-center gap-1 text-xs text-muted">
                  <Eye className="h-3.5 w-3.5" /> Tap to hide
                </div>
              )}
            </div>
          </button>

          {/* Voting */}
          <div>
            <div className="mb-2 flex items-end justify-between">
              <div className="font-display text-lg font-bold">Who is the Chor?</div>
              <div className="text-xs font-semibold text-muted">
                {votedCount} of {parts.length} voted
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {others.map((p) => {
                const selected = myVote === p.id;
                const count = view.voteCounts[p.id] ?? 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => send("vote", selected ? null : p.id)}
                    className={`relative flex items-center gap-2 rounded-xl px-3 py-3 text-left font-semibold transition active:scale-[0.97] ${
                      selected ? "bg-me text-black" : "bg-white/[0.06]"
                    }`}
                  >
                    <Avatar id={p.avatar} className="text-xl" />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {count > 0 && (
                      <span className={`flex items-center gap-0.5 rounded-full px-1.5 text-xs font-bold ${selected ? "bg-black/20" : "bg-saffron/20 text-saffron"}`}>
                        <Vote className="h-3 w-3" /> {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-center text-xs text-muted">{myVote ? "Tap again to take back your vote." : "You can change your vote anytime."}</div>
          </div>

          {priv.chor && (
            <Button tone="red" size="lg" className="flex w-full items-center justify-center gap-2" onClick={() => setGuessOpen(true)}>
              <Search className="h-5 w-5" /> I know the place
            </Button>
          )}
        </>
      )}

      {isHost && (
        <div className="border-t border-white/[0.06] pt-4">
          <Label className="mb-2">Host</Label>
          <ConfirmButton label="Stop & count votes" confirmLabel="Tap again to stop the round" icon={<Gavel className="h-4 w-4" />} now={now} onConfirm={() => hostAct("end")} />
        </div>
      )}

      <Sheet
        open={guessOpen && !!priv?.chor}
        onClose={() => {
          setGuessOpen(false);
          setGuessPick(null);
        }}
        title="Where are we?"
      >
        <div className="mb-3 text-sm text-muted">One guess only. A wrong guess means you’re caught.</div>
        <div className="grid grid-cols-2 gap-2">
          {view.locations.map((l) => (
            <button
              key={l.name}
              onClick={() => setGuessPick(l.name)}
              className={`flex items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-semibold ${guessPick === l.name ? "bg-saffron text-black" : "bg-white/[0.06]"}`}
            >
              <MapPin className="h-4 w-4 shrink-0" /> {l.name}
            </button>
          ))}
        </div>
        <div className="sticky -bottom-5 -mx-5 mt-4 border-t border-white/[0.08] bg-bg-2 px-5 pb-1 pt-3">
          <Button
            tone="red"
            size="lg"
            className="w-full"
            disabled={!guessPick}
            onClick={() => {
              if (!guessPick) return;
              send("guess", guessPick);
              setGuessOpen(false);
            }}
          >
            {guessPick ? `Lock in: ${guessPick}` : "Pick a place first"}
          </Button>
        </div>
      </Sheet>
      <ScoresSheet open={scoresOpen} onClose={() => setScoresOpen(false)} players={players} scores={view.scores} />
    </div>
  );
}

const noop = () => {};

/** Classic controller (used with a big screen) — same as the phone view without host controls. */
function Controller(props: ControllerProps<Pub, Priv>) {
  return <Phone {...props} isHost={false} hostAct={noop} together />;
}

function OptionsForm({ value, onChange }: { value: Options; onChange: (o: Options) => void }) {
  return (
    <div className="space-y-4">
      <LevelPicker value={value.level} onChange={(level) => onChange({ ...value, level })} />
      <NumberPicker label="Round time" value={value.minutes} options={[5, 8, 10]} format={(n) => `${n} min`} onChange={(minutes) => onChange({ ...value, minutes })} />
    </div>
  );
}

const chorKaun: GameModule<State, Pub, Priv, Options> = {
  id: "chor-kaun",
  defaultOptions: { level: "family", minutes: 8 },
  OptionsForm,
  init({ players, options, now }) {
    return deal(options, players.map((p) => p.id), now, {}, 1, []);
  },
  reduce(s, a, { now, players }) {
    if (a.playerId === HOST_ID) {
      if (a.type === "end" && s.phase === "playing") return finish(s, "host");
      if (a.type === "next" && s.phase === "reveal") return deal(s.options, activeIds(players, s.participants), now, s.scores, s.round + 1, s.usedLocations);
      return s;
    }
    if (s.phase !== "playing" || !s.participants.includes(a.playerId)) return s;
    if (a.type === "vote") {
      const target = a.payload as string | null;
      if (target === null) {
        if (!(a.playerId in s.votes)) return s;
        const votes = { ...s.votes };
        delete votes[a.playerId];
        return { ...s, votes };
      }
      if (target === a.playerId || !s.participants.includes(target) || s.votes[a.playerId] === target) return s;
      return checkMajority({ ...s, votes: { ...s.votes, [a.playerId]: target } });
    }
    if (a.type === "guess" && a.playerId === s.chorId && typeof a.payload === "string") return finish(s, "guess", a.payload);
    return s;
  },
  tick(s, { now }) {
    if (s.phase === "playing" && now >= s.deadline) return finish(s, "timer");
    return s;
  },
  publicView(s) {
    const { counts } = tally(s);
    return {
      round: s.round,
      phase: s.phase,
      participants: s.participants,
      firstAsker: s.firstAsker,
      deadline: s.deadline,
      voteCounts: counts,
      voted: Object.keys(s.votes),
      locations: locationsFor(s.options.level).map((l) => ({ name: l.name, emoji: l.emoji })),
      scores: s.scores,
      reveal:
        s.phase === "reveal" && s.result
          ? { location: { name: s.location.name, emoji: s.location.emoji }, chorId: s.chorId, roles: s.roles, result: s.result }
          : null,
    };
  },
  privateView(s, id) {
    if (!s.participants.includes(id) || s.phase !== "playing") return undefined;
    const myVote = s.votes[id] ?? null;
    if (id === s.chorId) return { chor: true, myVote };
    return { chor: false, location: s.location.name, emoji: s.location.emoji, role: s.roles[id], myVote };
  },
  Screen,
  Controller,
  Phone,
};

export default chorKaun;
