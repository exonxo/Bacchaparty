import Link from "next/link";
import type { GameInfo } from "@/lib/types";
import { GameIcon } from "../GameIcon";
import { gameLook, type TileShape } from "./gameLook";

const INK = "#1e1a17";

/** The small drawing that makes each tile its own object. Pure SVG, decorative. */
function Motif({ shape, on }: { shape: TileShape; on: string }) {
  const line = { stroke: on, strokeWidth: 1.5, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const soft = { ...line, opacity: 0.35 };
  switch (shape) {
    case "envelope":
      return (
        <svg viewBox="0 0 100 60" className="absolute inset-x-0 top-0 w-full" aria-hidden>
          <path d="M0 0 L50 38 L100 0" {...line} />
          <circle cx="50" cy="38" r="7" fill="#c23a22" stroke={INK} strokeWidth="1.5" />
        </svg>
      );
    case "ticket":
      return (
        <svg viewBox="0 0 100 60" className="absolute inset-x-3 top-3 w-[calc(100%-1.5rem)]" aria-hidden>
          {[0, 1, 2].map((r) => [0, 1, 2, 3, 4].map((c) => <rect key={`${r}${c}`} x={c * 20 + 1} y={r * 14 + 1} width="17" height="11" rx="2" {...((r + c) % 3 ? soft : { ...line, fill: on, fillOpacity: 0.9 })} />))}
        </svg>
      );
    case "card":
      return (
        <svg viewBox="0 0 100 60" className="absolute inset-x-0 top-2 w-full" aria-hidden>
          <rect x="16" y="10" width="44" height="40" rx="4" transform="rotate(-8 38 30)" {...soft} />
          <rect x="36" y="8" width="44" height="40" rx="4" transform="rotate(6 58 28)" fill="#fffdf8" stroke={INK} strokeWidth="1.5" />
          <circle cx="50" cy="24" r="2" fill={INK} /><circle cx="64" cy="22" r="2" fill={INK} /><path d="M48 33 Q58 40 68 31" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "chit":
      return (
        <svg viewBox="0 0 100 60" className="absolute inset-x-0 top-2 w-full" aria-hidden>
          <path d="M22 44 Q50 62 78 44 L74 34 Q50 42 26 34 Z" {...line} fill={on} fillOpacity="0.15" />
          <rect x="34" y="8" width="26" height="18" transform="rotate(-10 47 17)" fill="#fffdf8" stroke={INK} strokeWidth="1.5" />
          <path d="M47 9 L47 26" stroke={INK} strokeWidth="1" opacity=".4" transform="rotate(-10 47 17)" />
          <rect x="54" y="16" width="20" height="14" transform="rotate(14 64 23)" fill="#fffdf8" stroke={INK} strokeWidth="1.5" />
        </svg>
      );
    case "cassette":
      return (
        <svg viewBox="0 0 100 60" className="absolute inset-x-3 top-3 w-[calc(100%-1.5rem)]" aria-hidden>
          <rect x="4" y="6" width="92" height="46" rx="5" {...line} />
          <rect x="16" y="14" width="68" height="22" rx="11" fill="#fffdf8" stroke={INK} strokeWidth="1.5" />
          <circle cx="32" cy="25" r="6" fill="none" stroke={INK} strokeWidth="1.5" /><circle cx="68" cy="25" r="6" fill="none" stroke={INK} strokeWidth="1.5" />
          <path d="M28 52 L34 42 L66 42 L72 52" {...line} />
        </svg>
      );
    case "megaphone":
      return (
        <svg viewBox="0 0 100 60" className="absolute inset-x-0 top-2 w-full" aria-hidden>
          <path d="M22 26 L22 38 L34 38 L62 52 L62 12 L34 26 Z" fill="#fffdf8" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M70 22 Q76 32 70 42 M77 16 Q88 32 77 48" {...line} />
        </svg>
      );
    case "pad":
      return (
        <svg viewBox="0 0 100 60" className="absolute inset-x-0 top-0 w-full" aria-hidden>
          {[14, 26, 38, 50, 62, 74, 86].map((x) => <path key={x} d={`M${x} 0 v6 a3 3 0 1 0 0.1 0`} stroke={INK} strokeWidth="1.5" fill="none" />)}
          <path d="M22 44 C30 20 40 52 50 32 S70 22 80 40" stroke="#6b6258" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "chits":
      return (
        <svg viewBox="0 0 100 60" className="absolute inset-x-0 top-3 w-full" aria-hidden>
          {[[18, 14, -12], [40, 8, 6], [62, 16, -5], [36, 32, 14]].map(([x, y, r], i) => (
            <g key={i} transform={`rotate(${r} ${x + 12} ${y + 8})`}>
              <rect x={x} y={y} width="24" height="16" fill="#fffdf8" stroke={INK} strokeWidth="1.5" />
              <path d={`M${x + 12} ${y} v16`} stroke={INK} strokeWidth="1" opacity=".35" />
            </g>
          ))}
        </svg>
      );
    case "sleeve":
      return (
        <svg viewBox="0 0 100 60" className="absolute inset-x-0 top-2 w-full" aria-hidden>
          <rect x="34" y="4" width="36" height="34" rx="3" fill="#fffdf8" stroke={INK} strokeWidth="1.5" />
          <path d="M42 14 h20 M42 21 h12" stroke={INK} strokeWidth="1.5" strokeLinecap="round" opacity=".5" />
          <path d="M26 24 h52 v30 h-52 Z" fill={on} fillOpacity="0.14" stroke={on} strokeWidth="1.5" />
        </svg>
      );
    case "ladder":
      return (
        <svg viewBox="56 0 44 60" className="absolute right-3 top-3 h-16" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={62 - i * 2} y={i * 11 + 2} width={30 + i * 4} height="8" rx="2" {...(i === 1 ? { fill: "#f2b632", stroke: INK, strokeWidth: 1.5 } : soft)} />)}
        </svg>
      );
    case "board":
      return (
        <svg viewBox="0 0 100 60" className="absolute right-3 top-3 h-16 w-16" aria-hidden>
          {[["#c23a22", 20, 0], ["#2f7d4f", 60, 0], ["#1d4ed8", 20, 40], ["#f2b632", 60, 40]].map(([c, x, y], i) => <rect key={i} x={x as number} y={y as number} width="20" height="20" fill={c as string} stroke={INK} strokeWidth="1.5" />)}
          <rect x="40" y="20" width="20" height="20" fill="#fffdf8" stroke={INK} strokeWidth="1.5" />
          <circle cx="46" cy="26" r="1.6" fill={INK} /><circle cx="54" cy="34" r="1.6" fill={INK} /><circle cx="50" cy="30" r="1.6" fill={INK} />
        </svg>
      );
    case "notebook":
      return (
        <svg viewBox="0 0 100 60" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
          {[10, 20, 30, 40, 50].map((y) => <path key={y} d={`M0 ${y} H100`} stroke="#1d4ed8" strokeWidth="0.6" opacity=".35" />)}
          <path d="M16 0 V60" stroke="#c23a22" strokeWidth="0.8" opacity=".6" />
        </svg>
      );
  }
}

const TILT = [-1.2, 0.8, -0.6, 1.4, -1, 0.5];

/**
 * A game as a paper object. `wide` tiles span two columns. Used on the home
 * page (links to rules) and in the lobby (button that opens the game sheet).
 */
export function GameTile({
  game,
  index = 0,
  wide = false,
  onSelect,
  disabled,
}: {
  game: GameInfo;
  index?: number;
  wide?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
}) {
  const look = gameLook(game.id);
  const body = (
    <>
      <Motif shape={look.shape} on={look.on} />
      <span className="relative mt-auto block">
        <span className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-full border-[1.5px]" style={{ borderColor: look.on }}>
          <GameIcon id={game.id} className="h-4 w-4" strokeWidth={2.4} />
        </span>
        <span className="font-display block text-p-lead font-extrabold leading-tight text-balance">{game.name}</span>
        <span className="mt-0.5 block text-p-note font-medium leading-snug opacity-85">{game.tagline}</span>
        <span className="mt-2 flex flex-wrap gap-1 text-p-note font-bold">
          <span className="rounded-cut border px-1.5" style={{ borderColor: look.on }}>{game.ages}</span>
          <span className="rounded-cut border px-1.5" style={{ borderColor: look.on }}>{game.players}</span>
        </span>
      </span>
    </>
  );
  const cls = `cut press relative flex min-h-[13.5rem] flex-col overflow-hidden rounded-soft p-3 pt-16 text-left ${wide ? "col-span-2 min-h-[11.5rem]" : ""} ${
    disabled ? "opacity-50" : ""
  }`;
  const style = { background: look.color, color: look.on, rotate: `${TILT[index % TILT.length]}deg` };
  return onSelect ? (
    <button onClick={onSelect} className={cls} style={style}>
      {body}
    </button>
  ) : (
    <Link href={`/games/${game.id}`} className={cls} style={style}>
      {body}
    </Link>
  );
}

/** A table of game objects: columns scale up by breakpoint (2 → 6). */
export function GameTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 min-[1440px]:grid-cols-5 min-[1600px]:grid-cols-6">
      {children}
    </div>
  );
}
