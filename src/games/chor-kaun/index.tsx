"use client";
import { PhoneMessage } from "@/components/ui";
import type { GameModule } from "@/lib/types";

/** Placeholder — not playable yet (excluded from the registry by `ready: false`). */
const game: GameModule & { ready?: boolean } = {
  id: "chor-kaun",
  ready: false,
  defaultOptions: {},
  init: () => ({}),
  reduce: (s) => s,
  publicView: (s) => s,
  Screen: () => <PhoneMessage title="Coming soon" />,
  Controller: () => <PhoneMessage title="Coming soon" />,
};
export default game;
