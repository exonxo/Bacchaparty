/** Each game's paper colour and the kind of object it is drawn as. */
export type TileShape = "envelope" | "ticket" | "card" | "chit" | "cassette" | "megaphone" | "pad" | "chits" | "sleeve" | "ladder" | "board" | "notebook";

export interface GameLook {
  /** Paper colour of the game's object. */
  color: string;
  /** Text/line colour that reads on that paper. */
  on: string;
  shape: TileShape;
}

const INK = "#1e1a17";
const CREAM = "#fffdf8";

export const GAME_LOOK: Record<string, GameLook> = {
  "chor-kaun": { color: "#f2b632", on: INK, shape: "envelope" },
  housie: { color: "#5b2a6e", on: CREAM, shape: "ticket" },
  "emoji-picture": { color: "#8cc8f0", on: INK, shape: "card" },
  charades: { color: "#3e8e5a", on: CREAM, shape: "chit" },
  antakshari: { color: "#e2557a", on: CREAM, shape: "cassette" },
  "sound-guru": { color: "#f27b5b", on: INK, shape: "megaphone" },
  "draw-guess": { color: "#fffdf8", on: INK, shape: "pad" },
  "raja-mantri": { color: "#b3261e", on: CREAM, shape: "chits" },
  "odd-word-out": { color: "#9adbc0", on: INK, shape: "sleeve" },
  "kaun-banega-champion": { color: "#23407a", on: CREAM, shape: "ladder" },
  "ludo-yatra": { color: "#f6e7c1", on: INK, shape: "board" },
  "jaldi-bolo": { color: "#cfe0f5", on: INK, shape: "notebook" },
};

export function gameLook(id: string): GameLook {
  return GAME_LOOK[id] ?? { color: "#f2b632", on: INK, shape: "card" };
}
