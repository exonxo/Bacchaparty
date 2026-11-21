"use client";
import { BOTTLE_TONES, TONE_INFO } from "@/content/spin-bottle";
import type { ControllerProps, GameModule, OptionsFormProps } from "@/lib/types";
import { initState, onPlayerJoin, privateView, publicView, reduce, tick, type Options, type Priv, type Pub, type State } from "./logic";
import { Phone } from "./PaperPhone";
import { Screen } from "./TvScreen";

export type { Options, Priv, Pub, State } from "./logic";

const noop = () => {};

function Controller(props: ControllerProps<Pub, Priv>) {
  return <Phone {...props} isHost={false} hostAct={noop} together />;
}

/** Lobby: the host picks the mood. It stays fixed for the whole game. */
function OptionsForm({ value, onChange }: OptionsFormProps<Options>) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-muted">Mood (fixed for the whole game)</div>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Mood">
        {BOTTLE_TONES.map((t) => {
          const info = TONE_INFO[t];
          const on = value.tone === t;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange({ ...value, tone: t })}
              className={`cut rounded-cut px-3 py-2.5 text-left ${on ? "bg-ink text-bg" : "bg-paper text-ink"}`}
            >
              <div className="font-display text-p-body font-extrabold">
                {info.emoji} {info.label}
              </div>
              <div className={`text-p-note ${on ? "opacity-80" : "text-muted"}`}>{info.blurb}</div>
            </button>
          );
        })}
      </div>
      {TONE_INFO[value.tone].adult && (
        <p className="text-p-note text-muted">Adults only. No drinking, touching or sexual prompts, ever. A rare social dare may show up once per game; anyone can switch those off on their phone.</p>
      )}
    </div>
  );
}

const spinBottle: GameModule<State, Pub, Priv, Options> = {
  id: "spin-bottle",
  paper: true,
  tvPaper: true,
  defaultOptions: { tone: "family" },
  OptionsForm,
  init({ players, options }) {
    return initState(options.tone, players);
  },
  reduce(s, a, { players, now }) {
    return reduce(s, a, players, now);
  },
  tick(s, { now }) {
    return tick(s, now);
  },
  onPlayerJoin,
  publicView,
  privateView,
  Screen,
  Controller,
  Phone,
};

export default spinBottle;
