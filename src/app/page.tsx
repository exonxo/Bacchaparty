import Link from "next/link";
import { GameCard } from "@/components/GameCard";
import { Header } from "@/components/Header";
import { GAMES } from "@/games/catalog";
import { isPlayable } from "@/games/playable";
import { isSupabaseConfigured } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";

export default async function Home() {
  const user = await getUser();
  return (
    <main className="pb-20">
      <Header
        right={
          user ? (
            <form action="/auth/signout" method="post">
              <button className="text-muted hover:text-ink">Sign out</button>
            </form>
          ) : isSupabaseConfigured ? (
            <Link href="/login" className="text-muted hover:text-ink">
              Sign in
            </Link>
          ) : null
        }
      />
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-6 md:grid-cols-[1.2fr_1fr] md:pt-12">
        <div>
          <h1 className="text-5xl leading-[1.05] font-extrabold tracking-tight md:text-6xl">
            Desi party games for the <span className="text-saffron">whole</span> <span className="text-pink">khandaan</span>.
          </h1>
          <p className="mt-5 max-w-xl text-xl text-muted">
            Put Bacchaparty on the TV or laptop. Everyone joins from their own phone with a 4-letter code — no app, no sign-up. From 7-year-olds to
            Nani, everyone plays.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/host" className="rounded-2xl bg-saffron px-7 py-4 text-xl font-extrabold text-bg shadow-[0_4px_0_rgba(0,0,0,0.35)]">
              📺 Host a party
            </Link>
            <Link href="/join" className="rounded-2xl bg-white/10 px-7 py-4 text-xl font-extrabold shadow-[0_4px_0_rgba(0,0,0,0.35)]">
              📱 Join with code
            </Link>
          </div>
          {!isSupabaseConfigured && (
            <p className="mt-4 max-w-xl rounded-2xl bg-pink/15 px-4 py-2 text-sm text-pink">
              Demo mode: Supabase isn’t configured, so login is skipped and rooms only sync between tabs of this browser.
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 text-center text-5xl">
          {GAMES.slice(0, 9).map((g, i) => (
            <div key={g.id} className="flex aspect-square items-center justify-center rounded-3xl" style={{ background: `${g.color}${i % 2 ? "26" : "40"}` }}>
              {g.emoji}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-4">
        <h2 className="mb-2 text-3xl font-extrabold">How it works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["1", "📺", "Host opens the big screen", "Sign in with Google on a TV, laptop or tablet and create a room."],
            ["2", "📱", "Everyone joins on their phone", "Go to the site, type the 4-letter code (or scan the QR) and pick a nickname."],
            ["3", "🎉", "Pick a game and play", "Phones become controllers: secret roles, tickets, answers and buzzers."],
          ].map(([n, e, t, d]) => (
            <div key={n} className="rounded-3xl border border-white/10 bg-card/60 p-5">
              <div className="text-4xl">{e}</div>
              <div className="mt-2 text-xl font-bold">{t}</div>
              <div className="text-muted">{d}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-3xl font-extrabold">{GAMES.length} games</h2>
          <Link href="/games" className="font-semibold text-saffron">
            Rules for every game →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((g) => (
            <GameCard key={g.id} game={g} playable={isPlayable(g.id)} />
          ))}
        </div>
      </section>

      <footer className="mx-auto mt-20 flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 pt-6 text-sm text-muted">
        <span>🪅 Bacchaparty — desi party games for the whole family</span>
        <nav className="flex gap-4">
          <Link href="/games" className="hover:text-ink">
            All games
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy Policy
          </Link>
        </nav>
      </footer>
    </main>
  );
}
