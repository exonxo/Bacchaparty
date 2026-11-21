import Image from "next/image";

/** BAWAAL comic button: thick ink outline + chunky offset shadow (server-safe class helper). */
export function bwButtonClass(tone: "red" | "yellow" | "white" | "blue" = "red", size: "md" | "lg" = "lg") {
  const tones = {
    red: "bg-bw-red text-white",
    yellow: "bg-bw-yellow text-bw-ink",
    white: "bg-white text-bw-ink",
    blue: "bg-bw-blue text-white",
  };
  const sizes = { md: "min-h-11 px-4 text-xl", lg: "min-h-14 px-7 text-[1.65rem]" };
  return `bw-pop bw-btn inline-flex items-center justify-center gap-2 rounded-xl font-bw-display uppercase leading-none tracking-wide ${tones[tone]} ${sizes[size]}`;
}

/** Comic "POW" burst. Decorative only. */
export function Burst({ className = "", fill = "var(--bw-red)", stroke = "var(--bw-ink)", points = 14 }: { className?: string; fill?: string; stroke?: string; points?: number }) {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? 31 : 48 - (i % 4 === 0 ? 0 : 4);
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <polygon points={pts.join(" ")} fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

/** Paint splash droplets, like the ones flying off the logo. */
export function Splash({ className = "", color = "var(--bw-blue)" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={className} aria-hidden>
      <g stroke="var(--bw-ink)" strokeWidth="3" strokeLinejoin="round">
        <path d="M8 30 C 6 18, 22 12, 36 22 C 26 26, 14 34, 8 30 Z" fill={color} />
        <path d="M14 46 C 14 38, 28 34, 40 36 C 32 42, 20 50, 14 46 Z" fill={color} />
        <path d="M30 8 C 34 4, 44 6, 48 12 C 42 12, 34 14, 30 8 Z" fill={color} />
      </g>
    </svg>
  );
}

/** An Open Doodles illustration (CC0) on a white comic panel. */
export function Doodle({ name, className = "", panel = true, width = 520, height = 460 }: { name: string; className?: string; panel?: boolean; width?: number; height?: number }) {
  return (
    <span className={`block ${panel ? "bw-pop rounded-3xl bg-white p-3" : ""} ${className}`}>
      <Image src={`/illustrations/${name}.svg`} alt="" width={width} height={height} className="h-full w-full object-contain" unoptimized />
    </span>
  );
}
