import { KBC_QUESTIONS, type KbcNews, type KbcQuestion } from "@/content/kbc";
import type { Level } from "@/lib/types";
import { shuffle } from "@/lib/util";

export interface Question {
  q: string;
  options: string[];
  answer: number;
  /** "📰 In the news · 6 Nov 2026": shown above news questions. */
  news?: string;
}

/** A news question from the library, with the level it suits. */
export type NewsQuestion = KbcQuestion & { level?: Level };

/** News questions take every other rung (2nd, 4th, 6th, 8th, 10th), while there are any left. */
export const NEWS_RUNGS = new Set([1, 3, 5, 7, 9]);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function newsLabel(n: KbcNews): string {
  const [y, m, d] = n.date.split("-").map(Number);
  const when = y && m && d ? `${d} ${MONTHS[m - 1]} ${y}` : n.date;
  return `📰 In the news · ${when}${n.outlet && n.source === "newsapi" ? ` · ${n.outlet}` : ""}`;
}

/** News suits a level: none for kids, family news for family, any for adults. */
export function newsFor(level: Level, news: NewsQuestion[] | undefined): NewsQuestion[] {
  if (!news?.length || level === "kids") return [];
  return news.filter((q) => (level === "family" ? (q.level ?? "family") === "family" : true));
}

function closest<T extends { step: number }>(pool: T[], step: number): T {
  let bestDist = Infinity;
  let cands: T[] = [];
  for (const q of pool) {
    const d = Math.abs(q.step - step);
    if (d < bestDist) {
      bestDist = d;
      cands = [q];
    } else if (d === bestDist) cands.push(q);
  }
  return cands[Math.floor(Math.random() * cands.length)];
}

/**
 * The question for this rung: on news rungs an unused news question for the level if there is one,
 * otherwise the built-in bank at the closest difficulty step.
 */
export function pickQuestion(level: Level, step: number, used: string[], news?: NewsQuestion[], rung = step - 1): Question {
  const freshNews = newsFor(level, news).filter((q) => !used.includes(q.q));
  let chosen: KbcQuestion;
  if (NEWS_RUNGS.has(rung) && freshNews.length) chosen = closest(freshNews, step);
  else {
    const bank = KBC_QUESTIONS[level].filter((q) => !used.includes(q.q));
    chosen = closest(bank.length ? bank : KBC_QUESTIONS[level], step);
  }
  const options = shuffle([chosen.a, ...chosen.w]);
  return { q: chosen.q, options, answer: options.indexOf(chosen.a), ...(chosen.news ? { news: newsLabel(chosen.news) } : {}) };
}
