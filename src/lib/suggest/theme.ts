/**
 * The topic an admin picks for "Generate more". It goes into the AI prompt, so it is cleaned hard:
 * plain words only, short, and anything that reads like an instruction is refused.
 */

export const THEME_MAX = 60;

/** Quick picks in the admin panel. `category` is the Emoji Picture category every puzzle must have. */
export const THEME_CHIPS: { label: string; category?: string }[] = [
  { label: "Bollywood movies", category: "Movie" },
  { label: "Movies", category: "Movie" },
  { label: "Indian food", category: "Food" },
  { label: "Cricket", category: "Sport" },
  { label: "Festivals", category: "Festival" },
  { label: "Songs", category: "Song" },
  { label: "Places in India", category: "Place" },
];

const INSTRUCTION_WORDS =
  /\b(ignore|disregard|instruction|instructions|prompt|system|assistant|developer|jailbreak|override|pretend|roleplay|json|reply|respond|output|password|secret|key|token)\b/i;

/**
 * Returns the cleaned theme, or null when it is missing, too short or looks like an instruction.
 * Letters (any script), digits, spaces and & ' - , . ( ) only; runs of spaces collapsed.
 */
export function cleanTheme(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s&'\-,.()]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length < 3 || s.length > THEME_MAX) return null;
  if (!/\p{L}/u.test(s)) return null;
  if (INSTRUCTION_WORDS.test(s)) return null;
  return s;
}

/** The Emoji Picture category a theme pins down, when it is one of the quick picks (or plainly names one). */
export function categoryForTheme(theme: string): string | undefined {
  const t = theme.toLowerCase();
  const chip = THEME_CHIPS.find((c) => c.label.toLowerCase() === t);
  if (chip?.category) return chip.category;
  if (/\b(movie|movies|film|films)\b/.test(t)) return "Movie";
  if (/\b(song|songs)\b/.test(t)) return "Song";
  return undefined;
}
