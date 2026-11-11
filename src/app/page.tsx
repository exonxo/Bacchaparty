import Link from "next/link";
import { Header, navLinkClass } from "@/components/Header";
import { paperButtonClass } from "@/components/paper/classes";
import { isSupabaseConfigured } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";
import { HomeGamesSection } from "./HomeGamesSection";

const STEPS = [
  { t: "Ek host", d: "One person signs in with Google and gets a 4-letter code." },
  { t: "Sab join karo", d: "Share the link on WhatsApp or say the code. Players just type a name." },
  { t: "Khelo!", d: "Same room or different cities. For acting and singing games, add a video call." },
];

export default async function Home() {
  const user = await getUser();
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

      <section className="mx-auto max-w-6xl px-4 pt-8 sm:pt-14">
        <p className="text-p-note font-bold uppercase tracking-[0.2em] text-turmeric-ink">Poore parivaar ke liye</p>
        <h1 className="mt-2 max-w-2xl text-p-show font-extrabold text-balance sm:text-6xl">
          Chalo, khelein! Party games for the whole{" "}khandaan.
        </h1>
        <p className="mt-4 max-w-xl text-p-lead text-muted">
          Sab apne phone pe khelte hain — in the same room or across cities. No app, no sign-up for players.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/host" className={paperButtonClass("turmeric", "lg")}>
            Party shuru karo
          </Link>
          <Link href="/join" className={paperButtonClass("paper", "lg")}>
            Code hai? Join karo
          </Link>
        </div>
        {!isSupabaseConfigured && (
          <p className="mt-4 max-w-xl rounded-cut border-[1.5px] border-line bg-card px-3 py-2 text-p-note text-muted">
            Demo mode: Supabase isn’t configured, so login is skipped and rooms only sync between tabs of this browser.
          </p>
        )}
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4">
        <h2 className="sr-only">How it works</h2>
        <ol className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
          {STEPS.map(({ t, d }, i) => (
            <li key={t} className="flex gap-3 border-t-[1.5px] border-ink pt-3">
              <span className="font-display text-p-show font-extrabold leading-none text-turmeric-ink">{i + 1}</span>
              <div>
                <div className="font-display text-p-lead font-extrabold">{t}</div>
                <div className="text-p-body text-muted">{d}</div>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-p-note text-muted">TV ya laptop hai? In the host lobby, tap <b className="text-ink">TV mode</b> in the header for the read-only big-screen view. Phones alone work fine too.</p>
      </section>

      <section className="mx-auto mt-12 max-w-6xl px-4">
        <h2 className="text-p-title font-extrabold sm:text-4xl">Aaj kya khelein?</h2>
        <p className="mb-5 mt-1 text-p-body text-muted">Tap a game to see how it works.</p>
        <HomeGamesSection />
      </section>

      <footer className="mx-auto mt-16 flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t-[1.5px] border-line px-4 pt-4 text-p-note text-muted">
        <span>Bacchaparty — desi party games for the whole family</span>
        <nav className="flex gap-5 text-ink">
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
