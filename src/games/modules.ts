import type { GameModule } from "@/lib/types";
import antakshari from "./antakshari";
import charades from "./charades";
import chorKaun from "./chor-kaun";
import drawGuess from "./draw-guess";
import emojiPicture from "./emoji-picture";
import { housie } from "./housie";
import jaldiBolo from "./jaldi-bolo";
import kbc from "./kaun-banega-champion";
import ludoYatra from "./ludo-yatra";
import oddWordOut from "./odd-word-out";
import puno from "./puno";
import rajaMantri from "./raja-mantri";
import soundGuru from "./sound-guru";

import { isPlayable } from "./playable";

/** Every game module (client-side only), keyed by id. Playability is listed in playable.ts. */
const ALL: GameModule[] = [charades, antakshari, soundGuru, emojiPicture, drawGuess, chorKaun, rajaMantri, oddWordOut, kbc, housie, ludoYatra, jaldiBolo, puno];

const MODULES: Record<string, GameModule> = Object.fromEntries(ALL.filter((m) => isPlayable(m.id)).map((m) => [m.id, m]));

export function getGameModule(id: string): GameModule | undefined {
  return MODULES[id];
}

export { isPlayable };
