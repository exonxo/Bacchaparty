import { PartyPopper } from "lucide-react";
import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 font-display text-xl font-extrabold tracking-tight ${className}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-saffron text-black">
        <PartyPopper className="h-5 w-5" strokeWidth={2.4} />
      </span>
      <span>
        Baccha<span className="text-saffron">party</span>
      </span>
    </Link>
  );
}

export function Header({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 bg-gradient-to-b from-bg via-bg/90 to-transparent">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Logo />
        <nav className="flex items-center gap-4 text-sm font-semibold text-muted">
          <Link href="/games" className="hover:text-ink">
            Games
          </Link>
          {right}
        </nav>
      </div>
    </header>
  );
}
