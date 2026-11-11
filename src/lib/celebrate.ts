"use client";
import confetti from "canvas-confetti";

export function celebrate(colors: string[] = ["#ff9a3c", "#ffc93c", "#ff3d8b", "#2ee6c5"]) {
  try {
    const opts = { particleCount: 90, spread: 75, startVelocity: 45, colors, disableForReducedMotion: true };
    confetti({ ...opts, origin: { x: 0.2, y: 0.8 }, angle: 60 });
    confetti({ ...opts, origin: { x: 0.8, y: 0.8 }, angle: 120 });
  } catch {}
}
