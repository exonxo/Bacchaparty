import { PartyPopper } from "lucide-react";
import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex min-h-11 items-center gap-2 self-start font-display text-xl font-extrabold tracking-tight ${className}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-saffron text-black">
        <PartyPopper className="h-5 w-5" strokeWidth={2.4} />
      </span>
      <span>
        Baccha<span className="text-saffron">party</span>
      </span>
    </Link>
  );
}

/** Text link with a 44px hit area (padding grows the target, not the type). */
export const navLinkClass = "-mx-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 hover:text-ink";

export function Header({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-bg/95 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-1.5">
        <Logo />
        <nav className="flex items-center gap-4 text-sm font-semibold text-muted">
          <Link href="/games" className={navLinkClass}>
            Games
          </Link>
          {right}
        </nav>
      </div>
    </header>
  );
}
