import Link from "next/link";

export function Header({ right }: { right?: React.ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
      <Link href="/" className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
        <span className="wiggle inline-block">🪅</span>
        <span>
          Baccha<span className="text-saffron">party</span>
        </span>
      </Link>
      <nav className="flex items-center gap-3 text-sm font-semibold">
        <Link href="/games" className="hidden text-muted hover:text-ink sm:inline">
          All games
        </Link>
        {right}
      </nav>
    </header>
  );
}
