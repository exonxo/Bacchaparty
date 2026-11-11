import { Smartphone, Tv, Users, Volume2 } from "lucide-react";
import Link from "next/link";
import { GameCard, PosterRow } from "@/components/GameCard";
import { GameIcon } from "@/components/GameIcon";
import { Header, navLinkClass } from "@/components/Header";
import { CATEGORIES, GAMES, getGameInfo } from "@/games/catalog";
import { isPlayable } from "@/games/playable";
import { isSupabaseConfigured } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";

const STEPS = [
  { icon: Users, t: "Host creates a room", d: "Sign in with Google and tap Host. You get a 4-letter code." },
  { icon: Smartphone, t: "Everyone joins", d: "Share the link on WhatsApp or say the code. Players just pick a name." },
  { icon: Volume2, t: "Play together", d: "Same room or different cities. For acting and singing games, add a video call." },
];

export default async function Home() {
  const user = await getUser();
  const featured = getGameInfo("chor-kaun")!;
  return (
    <main className="pb-16">
      <Header
        right={
          user ? (
            <form action="/auth/signout" method="post">
              <button className={navLinkClass}>Sign out</button>
            </form>
          ) : isSupabaseConfigured ? (
            <Link href="/login" className={navLinkClass}>
              Sign in
            </Link>
          ) : null
        }
      />

      {/* Hero: full-bleed on phones so its text shares the 16px page gutter */}
      <section className="relative mx-auto max-w-6xl pt-0 sm:px-4 sm:pt-2">
        <div className="relative overflow-hidden border-y border-white/[0.08] sm:rounded-3xl sm:border">
          <div
            className="absolute inset-0"
            style={{ background: `radial-gradient(90% 90% at 85% 10%, ${featured.color}66, transparent 60%), radial-gradient(70% 70% at 0% 100%, #ff9a3c33, transparent 60%), #111118` }}
          />
          <GameIcon id={featured.id} className="absolute -right-10 -top-6 h-72 w-72 text-white/10" strokeWidth={1} />
          <div className="relative px-4 pb-6 pt-20 sm:p-10 sm:pt-32">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-saffron">For the whole family</div>
            <h1 className="mt-2 max-w-xl font-display text-[2.5rem] font-black leading-[1.02] text-balance sm:text-6xl">
              Party games for the whole{" "}khandaan.
            </h1>
            <p className="mt-3 max-w-lg text-base text-ink/80 sm:text-lg">
              Everyone plays on their own phone — in the same room or across cities. No app, no sign-up for players.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/host"
                className="inline-flex min-h-14 items-center gap-2 rounded-xl bg-saffron px-6 font-display text-lg font-bold text-black shadow-[0_10px_30px_-10px_var(--saffron)]"
              >
                <Users className="h-5 w-5" /> Host a party
              </Link>
              <Link href="/join" className="inline-flex min-h-14 items-center gap-2 rounded-xl bg-white/10 px-6 font-display text-lg font-bold backdrop-blur">
                <Smartphone className="h-5 w-5" /> Join with code
              </Link>
            </div>
          </div>
        </div>
        {!isSupabaseConfigured && (
          <p className="mx-4 mt-3 rounded-xl bg-pink/15 px-4 py-2 text-sm text-pink sm:mx-0">
            Demo mode: Supabase isn’t configured, so login is skipped and rooms only sync between tabs of this browser.
          </p>
        )}
      </section>

      {/* How it works — right under the buttons */}
      <section className="mx-auto mt-6 max-w-6xl px-4">
        <h2 className="sr-only">How it works</h2>
        <ol className="grid gap-2 sm:grid-cols-3 sm:gap-3">
          {STEPS.map(({ icon: Icon, t, d }, i) => (
            <li key={t} className="flex gap-3 rounded-2xl border border-white/[0.08] bg-card p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-saffron/15 text-saffron">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <div className="font-display font-bold">
                  {i + 1}. {t}
                </div>
                <div className="text-sm text-muted">{d}</div>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 flex items-start gap-2 text-sm leading-5 text-muted">
          <Tv className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Got a TV or laptop? Open the “Big screen” link from the lobby for a shared view. Phones alone work fine too.</span>
        </p>
      </section>

      {/* One catalogue: the games, grouped */}
      <div className="mx-auto mt-10 max-w-6xl px-4">
        <h2 className="font-display text-2xl font-black sm:text-3xl">Meet the games</h2>
        <p className="mt-1 text-muted">Tap a game to see how it works.</p>
      </div>
      {CATEGORIES.map((cat) => {
        const list = GAMES.filter((g) => g.category === cat);
        if (!list.length) return null;
        return (
          <PosterRow key={cat} title={cat} as="h3">
            {list.map((g) => (
              <GameCard key={g.id} game={g} playable={isPlayable(g.id)} />
            ))}
          </PosterRow>
        );
      })}

      <footer className="mx-auto mt-16 flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-white/10 px-4 pt-4 text-sm text-muted">
        <span>Bacchaparty — desi party games for the whole family</span>
        <nav className="flex gap-4">
          <Link href="/games" className={navLinkClass}>
            All games
          </Link>
          <Link href="/privacy" className={navLinkClass}>
            Privacy Policy
          </Link>
        </nav>
      </footer>
    </main>
  );
}
