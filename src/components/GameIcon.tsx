import { AudioLines, Clapperboard, Crown, Dices, Ghost, Gamepad2, MicVocal, Palette, Puzzle, Ticket, Trophy, VenetianMask, Zap, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  charades: Clapperboard,
  antakshari: MicVocal,
  "sound-guru": AudioLines,
  "emoji-picture": Puzzle,
  "draw-guess": Palette,
  "chor-kaun": VenetianMask,
  "raja-mantri": Crown,
  "odd-word-out": Ghost,
  "kaun-banega-champion": Trophy,
  housie: Ticket,
  "ludo-yatra": Dices,
  "jaldi-bolo": Zap,
};

export function GameIcon({ id, className = "", strokeWidth = 2 }: { id: string; className?: string; strokeWidth?: number }) {
  const Icon = ICONS[id] ?? Gamepad2;
  return <Icon className={className} strokeWidth={strokeWidth} />;
}
