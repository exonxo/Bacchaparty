import {
  Bird, Cat, Dog, Feather, Fish, Flame, Flower2, Gem, Moon, Origami, Panda, Rabbit, Rocket, Snail, Squirrel, Star, Sun, Turtle,
  type LucideIcon,
} from "lucide-react";
import { playerColor } from "@/lib/colors";

const ICONS: Record<string, LucideIcon> = {
  cat: Cat, dog: Dog, bird: Bird, fish: Fish, rabbit: Rabbit, squirrel: Squirrel, turtle: Turtle, snail: Snail, panda: Panda,
  rocket: Rocket, flower: Flower2, sun: Sun, moon: Moon, star: Star, flame: Flame, gem: Gem, feather: Feather, origami: Origami,
};

/** A player's avatar: a Lucide icon in a circle of the player's colour. Scales with font-size. */
export function Avatar({ id, className = "" }: { id: string | undefined; className?: string }) {
  const Icon = (id && ICONS[id]) || Star;
  const color = playerColor(id);
  return (
    <span
      className={`inline-flex h-[1.4em] w-[1.4em] shrink-0 items-center justify-center rounded-full align-middle ${className}`}
      style={{ background: `color-mix(in srgb, ${color} 22%, transparent)`, color, boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${color} 55%, transparent)` }}
    >
      <Icon style={{ width: "0.8em", height: "0.8em" }} strokeWidth={2.25} />
    </span>
  );
}
