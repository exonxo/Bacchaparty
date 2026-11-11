import Link from "next/link";

/** Wordmark: the name on a slightly tilted paper label. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`press inline-flex min-h-11 items-center self-start ${className}`} aria-label="Bacchaparty home">
      <span className="cut font-display -rotate-2 rounded-cut bg-turmeric px-2.5 py-1 text-p-lead font-extrabold leading-none text-ink">
        Baccha<span className="text-vermilion">party</span>
      </span>
    </Link>
  );
}

/** Text link with a 44px hit area (padding grows the target, not the type). */
export const navLinkClass =
  "-mx-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-cut px-2 font-semibold underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink";

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
