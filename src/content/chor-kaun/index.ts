import { BOLLYWOOD_MOVIES_WORDS } from "./bollywood-movies";
import { BOLLYWOOD_STARS_WORDS } from "./bollywood-stars";
import { DESI_KITCHEN_WORDS } from "./desi-kitchen";
import { FESTIVALS_WORDS } from "./festivals";
import { INDIAN_BRANDS_WORDS } from "./indian-brands";
import { JOBS_WORDS } from "./jobs";
import { PLACES_WORDS } from "./places";
import { SHAADI_WORDS } from "./shaadi";
import { STREET_FOOD_WORDS } from "./street-food";
import { TV_SHOWS_WORDS } from "./tv-shows";

export interface ChorTopic {
  id: string;
  label: string;
  emoji: string;
  words: readonly string[];
}

export const CHOR_TOPIC_ALL = "all" as const;
export type ChorTopicChoice = typeof CHOR_TOPIC_ALL | string;

export const CHOR_TOPICS: ChorTopic[] = [
  { id: "places", label: "Places", emoji: "📍", words: PLACES_WORDS },
  { id: "street-food", label: "Street food", emoji: "🥙", words: STREET_FOOD_WORDS },
  { id: "bollywood-movies", label: "Bollywood movies", emoji: "🎬", words: BOLLYWOOD_MOVIES_WORDS },
  { id: "bollywood-stars", label: "Bollywood stars", emoji: "⭐", words: BOLLYWOOD_STARS_WORDS },
  { id: "festivals", label: "Festivals", emoji: "🪔", words: FESTIVALS_WORDS },
  { id: "desi-kitchen", label: "Desi kitchen", emoji: "🍳", words: DESI_KITCHEN_WORDS },
  { id: "shaadi", label: "Shaadi", emoji: "💍", words: SHAADI_WORDS },
  { id: "jobs", label: "Jobs around you", emoji: "👷", words: JOBS_WORDS },
  { id: "indian-brands", label: "Indian brands", emoji: "🏷️", words: INDIAN_BRANDS_WORDS },
  { id: "tv-shows", label: "TV serials & shows", emoji: "📺", words: TV_SHOWS_WORDS },
];

const byId = new Map(CHOR_TOPICS.map((t) => [t.id, t]));

export function topicById(id: string): ChorTopic | undefined {
  return byId.get(id);
}

export function topicLabel(id: string): string {
  if (id === CHOR_TOPIC_ALL) return "All topics";
  return topicById(id)?.label ?? id;
}

/** Host setting: fixed pack or a random pack each round. */
export function resolveRoundTopic(choice: ChorTopicChoice, extras?: readonly ChorTopic[]): ChorTopic {
  if (choice !== CHOR_TOPIC_ALL) {
    const t = topicById(choice) ?? extras?.find((e) => e.id === choice);
    if (t) return t;
  }
  const pool = extras?.length ? [...CHOR_TOPICS, ...extras] : CHOR_TOPICS;
  const i = Math.floor(Math.random() * pool.length);
  return pool[i]!;
}

export function topicLabelWithExtras(id: string, extras?: readonly ChorTopic[]): string {
  if (id === CHOR_TOPIC_ALL) return "All topics";
  return topicById(id)?.label ?? extras?.find((e) => e.id === id)?.label ?? id;
}

export function wordCountSummary(): { label: string; count: number }[] {
  return CHOR_TOPICS.map((t) => ({ label: t.label, count: t.words.length }));
}
