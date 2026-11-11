import { Smartphone, Tv, Users, Volume2 } from "lucide-react";
import Link from "next/link";
import { GameCard, PosterRow } from "@/components/GameCard";
import { GameIcon } from "@/components/GameIcon";
import { Header } from "@/components/Header";
import { CATEGORIES, GAMES, getGameInfo } from "@/games/catalog";
import { isPlayable } from "@/games/playable";
import { isSupabaseConfigured } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";

export default async function Home() {
  const user = await getUser();
  const featured = getGameInfo("chor-kaun")!;
  return (
    <main className="pb-16">
      <Header
        right={
          user ? (
            <form action="/auth/signout" method="post">
              <button className="hover:text-ink">Sign out</button>
            </form>
          ) : isSupabaseConfigured ? (
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
          ) : null
        }
      />

      {/* Hero: featured game, Netflix-style */}
      <section className="relative mx-auto max-w-6xl overflow-hidden px-4 pt-2">
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08]">
          <div
            className="absolute inset-0"
            style={{ background: `radial-gradient(90% 90% at 85% 10%, ${featured.color}66, transparent 60%), radial-gradient(70% 70% at 0% 100%, #ff9a3c33, transparent 60%), #111118` }}
          />
          <GameIcon id={featured.id} className="absolute -right-10 -top-6 h-72 w-72 text-white/10" strokeWidth={1} />
          <div className="relative p-6 pt-24 sm:p-10 sm:pt-32">
            <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-saffron">Tonight’s pick</div>
            <h1 className="mt-2 max-w-xl font-display text-4xl font-black leading-[1.02] sm:text-6xl">Party games for the whole khandaan.</h1>
            <p className="mt-3 max-w-lg text-base text-ink/80 sm:text-lg">
              Everyone plays on their own phone — in the same room or across cities. No app, no sign-up for players.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/host" className="inline-flex items-center gap-2 rounded-xl bg-saffron px-6 py-3.5 font-display text-lg font-bold text-black shadow-[0_10px_30px_-10px_var(--saffron)]">
                <Users className="h-5 w-5" /> Host a party
              </Link>
              <Link href="/join" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-6 py-3.5 font-display text-lg font-bold backdrop-blur">
                <Smartphone className="h-5 w-5" /> Join with code
              </Link>
            </div>
          </div>
        </div>
        {!isSupabaseConfigured && (
          <p className="mt-3 rounded-xl bg-pink/15 px-4 py-2 text-sm text-pink">
            Demo mode: Supabase isn’t configured, so login is skipped and rooms only sync between tabs of this browser.
          </p>
        )}
      </section>

      <PosterRow title="Play now">
        {GAMES.map((g) => (
          <GameCard key={g.id} game={g} playable={isPlayable(g.id)} />
        ))}
      </PosterRow>
      {CATEGORIES.map((cat) => {
        const list = GAMES.filter((g) => g.category === cat);
        if (list.length < 2) return null;
        return (
          <PosterRow key={cat} title={cat}>
            {list.map((g) => (
              <GameCard key={g.id} game={g} playable={isPlayable(g.id)} />
            ))}
          </PosterRow>
        );
      })}

      <section className="mx-auto mt-12 max-w-6xl px-4">
        <h2 className="mb-3 font-display text-lg font-bold sm:text-xl">How it works</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Users, t: "Host creates a room", d: "Sign in with Google on your phone and tap Host. You get a 4-letter code." },
            { icon: Smartphone, t: "Everyone joins", d: "Share the link on WhatsApp or say the code out loud. Players just pick a name." },
            { icon: Volume2, t: "Play together", d: "Same room or different cities. For acting & singing games, hop on a video call." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border border-white/[0.08] bg-card p-5">
              <Icon className="h-6 w-6 text-saffron" />
              <div className="mt-3 font-display text-lg font-bold">{t}</div>
              <div className="text-sm text-muted">{d}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <Tv className="h-4 w-4" /> Got a TV or laptop? Open the “Big screen” link from the lobby for a shared view.
        </p>
      </section>

      <footer className="mx-auto mt-16 flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 pt-6 text-sm text-muted">
        <span>Bacchaparty — desi party games for the whole family</span>
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
