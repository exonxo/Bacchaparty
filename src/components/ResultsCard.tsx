"use client";
import { Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { celebrate } from "@/lib/celebrate";
import type { GameResult } from "@/lib/results";
import { Sticker } from "./paper/Paper";

const DISMISS_KEY = "bacchaparty-result-seen";

/**
 * "Khel khatam" scorecard for the game that just ended. Shown in the lobby until
 * the next game starts or this person closes it. `big` is for the TV.
 */
export function ResultsCard({ result, big = false }: { result: GameResult | null | undefined; big?: boolean }) {
  const [hidden, setHidden] = useState<string | null>(null);
  useEffect(() => {
    try {
      setHidden(sessionStorage.getItem(DISMISS_KEY));
    } catch {}
  }, []);
  useEffect(() => {
    if (result && hidden !== result.id) celebrate();
    // Celebrate once per result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.id]);
  if (!result || hidden === result.id) return null;
  const winners = result.rows.filter((r) => r.place === 1);
  const headline = winners.length > 1 ? "Barabar ki takkar!" : `${winners[0]?.name ?? ""} jeet gaye!`;
  const close = () => {
    setHidden(result.id);
    try {
      sessionStorage.setItem(DISMISS_KEY, result.id);
    } catch {}
  };
  return (
    <section aria-label={`${result.gameName} results`} className={`cut rise-in relative mb-5 rounded-soft bg-card ${big ? "p-8" : "p-4"}`}>
      {!big && (
        <button onClick={close} aria-label="Close results" className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-muted hover:text-ink">
          <X className="h-5 w-5" />
        </button>
      )}
      <p className={`font-bold uppercase tracking-[0.2em] text-turmeric-ink ${big ? "text-p-lead" : "text-p-note"}`}>Khel khatam · {result.gameName}</p>
      <h2 className={`mt-1 flex items-center gap-2 font-extrabold ${big ? "text-6xl" : "text-p-title"}`}>
        <Trophy className={big ? "h-12 w-12 text-turmeric-ink" : "h-6 w-6 text-turmeric-ink"} /> {headline}
      </h2>
      <ol className={`mt-3 divide-y-[1.5px] divide-line border-y-[1.5px] border-ink ${big ? "text-3xl" : "text-p-body"}`}>
        {result.rows.map((r) => (
          <li key={r.name} className={`flex items-center gap-3 ${big ? "py-4" : "py-2"}`}>
            <span className={`font-display w-8 shrink-0 font-extrabold ${r.place === 1 ? "text-turmeric-ink" : "text-muted"}`}>{r.place}</span>
            <span className="flex shrink-0 -space-x-2">
              {r.avatars.slice(0, 5).map((a, i) => (
                <Sticker key={i} id={a} size={big ? 48 : 30} />
              ))}
            </span>
            <span className="min-w-0 flex-1 truncate font-bold">{r.name}</span>
            {r.score !== null && <span className="font-display font-extrabold tabular-nums">{r.score}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
