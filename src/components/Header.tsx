import Image from "next/image";
import Link from "next/link";

/** Wordmark: the BAWAAL bubble-letter logo (transparent, so it sits on paper or the dark TV theme). */
export function Logo({ className = "", size = "md" }: { className?: string; size?: "md" | "lg" }) {
  const h = size === "lg" ? "h-14" : "h-10";
  return (
    <Link href="/" className={`press inline-flex min-h-11 items-center self-start ${className}`} aria-label="BAWAAL home">
      <Image src="/brand/bawaal-logo.webp" alt="BAWAAL" width={800} height={267} priority className={`${h} w-auto`} />
    </Link>
  );
}

/** Text link with a 44px hit area (padding grows the target, not the type). */
export const navLinkClass =
  "-mx-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-cut px-2 font-semibold underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink";

/** Landing-page header in the BAWAAL comic style. */
export function BrandHeader({ right }: { right?: React.ReactNode }) {
  const base = "min-h-11 items-center whitespace-nowrap px-1 font-bw-accent text-base font-bold text-bw-ink underline decoration-transparent decoration-[3px] underline-offset-4 hover:decoration-bw-red";
  return (
    <header className="sticky top-0 z-30 border-b-[3px] border-bw-ink bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-1.5">
        <Logo />
        <nav className="flex items-center gap-3 sm:gap-5" aria-label="Main">
          <Link href="#games" className={`inline-flex ${base}`}>Games</Link>
          <Link href="#how" className={`hidden sm:inline-flex ${base}`}>How to play</Link>
          {right}
          <Link
            href="/host"
            className="bw-pop-sm bw-btn hidden min-h-11 items-center rounded-xl bg-bw-red px-4 font-bw-display text-2xl uppercase tracking-wide text-white md:inline-flex"
          >
            Start a BAWAAL
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function Header({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b-[1.5px] border-line bg-bg">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-1.5">
        <Logo />
        <nav className="flex items-center gap-5 text-p-body text-ink">
          <Link href="/games" className={navLinkClass}>
            Games
          </Link>
          {right}
        </nav>
      </div>
    </header>
  );
}
