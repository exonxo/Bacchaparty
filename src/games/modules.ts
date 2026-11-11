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
import rajaMantri from "./raja-mantri";
import soundGuru from "./sound-guru";

type Registered = GameModule & { ready?: boolean };

/** Every game module, keyed by id. A module with `ready: false` shows as "Coming soon". */
const ALL: Registered[] = [charades, antakshari, soundGuru, emojiPicture, drawGuess, chorKaun, rajaMantri, oddWordOut, kbc, housie, ludoYatra, jaldiBolo];

const MODULES: Record<string, GameModule> = Object.fromEntries(ALL.filter((m) => m.ready !== false).map((m) => [m.id, m]));

export function getGameModule(id: string): GameModule | undefined {
  return MODULES[id];
}

export function isPlayable(id: string): boolean {
  return id in MODULES;
}
