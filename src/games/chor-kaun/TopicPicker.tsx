"use client";
import { CHOR_TOPIC_ALL, CHOR_TOPICS, topicLabel, type ChorTopicChoice } from "@/content/chor-kaun";

const tile = (on: boolean) =>
  on
    ? "border-ink bg-turmeric shadow-[2px_2px_0_0_var(--ink)]"
    : "border-ink/20 bg-paper";

/** In-game paper topic picker (host lobby sheet uses TopicPickerLobby). */
export function TopicPicker({ value, onChange, compact }: { value: ChorTopicChoice; onChange: (id: ChorTopicChoice) => void; compact?: boolean }) {
  return (
    <div className="space-y-2">
      <button type="button" onClick={() => onChange(CHOR_TOPIC_ALL)} className={`flex min-h-12 w-full items-center gap-3 rounded-cut border-[1.5px] px-3 py-2 text-left ${tile(value === CHOR_TOPIC_ALL)}`}>
        <span className="text-xl" aria-hidden>
          🎲
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-p-lead font-bold">All topics</span>
          {!compact && <span className="block text-p-note text-muted">A different topic every round</span>}
        </span>
      </button>
      <div className="grid grid-cols-2 gap-2">
        {CHOR_TOPICS.map((t) => (
          <button key={t.id} type="button" onClick={() => onChange(t.id)} className={`flex min-h-11 items-center gap-2 rounded-cut border-[1.5px] px-2.5 py-2 text-left text-p-body font-semibold leading-tight ${tile(value === t.id)}`}>
            <span aria-hidden>{t.emoji}</span>
            <span className="min-w-0 truncate">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Host lobby (classic tile style on paper host sheet). */
export function TopicPickerLobby({ value, onChange }: { value: ChorTopicChoice; onChange: (id: ChorTopicChoice) => void }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-muted">
        Topic: <span className="text-ink">{topicLabel(value)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onChange(CHOR_TOPIC_ALL)}
          className={`col-span-2 rounded-xl border px-3 py-2 text-left sm:col-span-3 ${value === CHOR_TOPIC_ALL ? "border-saffron bg-saffron/15" : "border-line bg-tint"}`}
        >
          <div className="font-bold">🎲 All topics</div>
          <div className="text-xs text-muted">Random topic each round</div>
        </button>
        {CHOR_TOPICS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`rounded-xl border px-3 py-2 text-left ${value === t.id ? "border-saffron bg-saffron/15" : "border-line bg-tint"}`}
          >
            <div className="truncate font-bold">
              {t.emoji} {t.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
