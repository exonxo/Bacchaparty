import { Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Header, navLinkClass } from "@/components/Header";
import { paperButtonClass } from "@/components/paper/classes";
import { isSupabaseConfigured } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";
import { HomeGamesSection } from "./HomeGamesSection";

const REASSURE = ["No app to install.", "Players don’t need an account.", "Host signs in with Google."];

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

      <section className="mx-auto grid max-w-6xl items-center gap-x-10 px-4 pt-8 sm:pt-14 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <div>
          <h1 className="max-w-3xl text-[2.375rem] leading-[0.98] font-extrabold uppercase text-balance sm:text-6xl">
            Ghar mein sab hain?{" "}
            <span className="block text-vermilion">Toh BAWAAL karo!</span>
          </h1>
          <p className="mt-4 max-w-xl text-p-lead text-muted">
            Desi party games for your family and friends. Put it on the big screen, join from your phones, and let the madness begin.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/host" className={`${paperButtonClass("vermilion", "lg")} uppercase tracking-wide`}>
              Start a BAWAAL
            </Link>
            <Link href="#games" className={`${paperButtonClass("paper", "lg")} uppercase tracking-wide`}>
              Explore games
            </Link>
          </div>
          <ul className="mt-5 space-y-1.5 text-p-note text-muted" aria-label="Good to know">
            {REASSURE.map((line) => (
              <li key={line} className="flex items-center gap-2">
                <Check aria-hidden className="size-4 shrink-0 text-leaf" strokeWidth={3} />
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-p-body">
            <Link href="/join" className={navLinkClass}>
              Room code hai? Join karo →
            </Link>
          </p>
          {!isSupabaseConfigured && (
            <p className="mt-4 max-w-xl rounded-cut border-[1.5px] border-line bg-card px-3 py-2 text-p-note text-muted">
              Demo mode: Supabase isn’t configured, so login is skipped and rooms only sync between tabs of this browser.
            </p>
          )}
        </div>
        <div className="hidden lg:block" aria-hidden>
          <Image src="/brand/bawaal-logo.webp" alt="" width={800} height={267} priority className="w-full -rotate-3 drop-shadow-[4px_4px_0_var(--ink)]" />
        </div>
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

      <section id="games" className="mx-auto mt-12 max-w-6xl scroll-mt-16 px-4">
        <h2 className="text-p-title font-extrabold sm:text-4xl">Aaj kya khelein?</h2>
        <p className="mb-5 mt-1 text-p-body text-muted">Tap a game to see how it works.</p>
        <HomeGamesSection />
      </section>

      <footer className="mx-auto mt-16 flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t-[1.5px] border-line px-4 pt-4 text-p-note text-muted">
        <span>BAWAAL — desi party games for your family and friends</span>
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
