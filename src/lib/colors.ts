import { AVATARS } from "./util";

/** One vivid colour per avatar, so each player's phone has its own tint. */
const PALETTE = [
  "#ff9a3c", "#ff3d8b", "#2ee6c5", "#ffc93c", "#4da3ff", "#b36bff",
  "#3ddc84", "#ff6b4a", "#00c2ff", "#ff5fd2", "#c6f432", "#ffb37a",
  "#7c8cff", "#22d3ee", "#f472b6", "#a3e635", "#fb923c", "#facc15",
];

export function playerColor(avatar: string | undefined): string {
  const i = avatar ? (AVATARS as readonly string[]).indexOf(avatar) : -1;
  return PALETTE[(i >= 0 ? i : 0) % PALETTE.length];
}
