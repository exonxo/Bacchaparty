"use client";
/**
 * Tiny synthesized sound effects (Web Audio) — no audio files to license or load.
 */
export type Sfx = "tick" | "ding" | "buzz" | "fanfare" | "whoosh" | "pop" | "reveal" | "turn" | "rustle" | "thud";

let ctx: AudioContext | null = null;
const MUTE_KEY = "bacchaparty-muted";

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Browsers only allow sound after a tap: unlock on the first interaction. */
export function unlockAudioOnFirstTap() {
  if (typeof window === "undefined") return;
  const unlock = () => {
    audio();
    window.removeEventListener("pointerdown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(m: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {}
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.18, slideTo?: number) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(ac.destination);
  o.start(start);
  o.stop(start + dur + 0.02);
}

function noise(ac: AudioContext, start: number, dur: number, gain = 0.12) {
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(800, start);
  filter.frequency.exponentialRampToValueAtTime(3000, start + dur);
  const g = ac.createGain();
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(start);
}

export function playSfx(name: Sfx) {
  if (isMuted()) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  switch (name) {
    case "tick":
      tone(ac, 1200, t, 0.05, "square", 0.06);
      break;
    case "ding":
      tone(ac, 880, t, 0.18, "sine", 0.2);
      tone(ac, 1320, t + 0.09, 0.3, "sine", 0.18);
      break;
    case "buzz":
      tone(ac, 140, t, 0.35, "sawtooth", 0.12);
      tone(ac, 147, t, 0.35, "square", 0.06);
      break;
    case "fanfare":
      [523, 659, 784, 1047].forEach((f, i) => tone(ac, f, t + i * 0.11, 0.28, "triangle", 0.18));
      tone(ac, 1047, t + 0.45, 0.6, "triangle", 0.16);
      break;
    case "whoosh":
      noise(ac, t, 0.35, 0.1);
      break;
    case "pop":
      tone(ac, 600, t, 0.08, "sine", 0.2, 1200);
      break;
    case "reveal":
      tone(ac, 220, t, 0.5, "triangle", 0.12, 660);
      tone(ac, 880, t + 0.45, 0.4, "sine", 0.16);
      break;
    case "turn":
      tone(ac, 660, t, 0.12, "sine", 0.2);
      tone(ac, 990, t + 0.12, 0.2, "sine", 0.2);
      break;
    case "rustle":
      // Soft paper sound: two short, quiet bursts of filtered noise.
      noise(ac, t, 0.12, 0.035);
      noise(ac, t + 0.09, 0.16, 0.025);
      break;
    case "thud":
      // A card slapped on the table: a low knock with a short papery burst.
      tone(ac, 150, t, 0.12, "sine", 0.26, 70);
      noise(ac, t, 0.07, 0.07);
      break;
  }
}

export function vibrate(pattern: number | number[]) {
  try {
    if (!isMuted()) navigator.vibrate?.(pattern);
  } catch {}
}
