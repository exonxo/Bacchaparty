/**
 * Ids of games that are playable. Kept separate from modules.ts because game
 * modules are client components, and server pages can't read their fields.
 */
export const PLAYABLE_IDS: readonly string[] = [
  "charades",
  "antakshari",
  "sound-guru",
  "emoji-picture",
  "draw-guess",
  "chor-kaun",
  "raja-mantri",
  "odd-word-out",
  "kaun-banega-champion",
  "housie",
  "ludo-yatra",
  "jaldi-bolo",
];

export function isPlayable(id: string): boolean {
  return PLAYABLE_IDS.includes(id);
}
