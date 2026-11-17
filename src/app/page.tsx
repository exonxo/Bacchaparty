import Image from "next/image";
import Link from "next/link";
import { Check, Gamepad2, Heart, MonitorSmartphone, PartyPopper, Smartphone, Tv, UserX, Users } from "lucide-react";
import { BrandHeader } from "@/components/Header";
import { Burst, Doodle, Splash, bwButtonClass } from "@/components/marketing/brand";
import { RoomCodeJump } from "@/components/marketing/RoomCodeJump";
import { isSupabaseConfigured } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";
import { HomeGamesSection } from "./HomeGamesSection";

const REASSURE = ["No app to install.", "Players don\u2019t need an account.", "Host signs in with Google."];

const STEPS = [
  { t: "Host creates a room", d: "One person signs in with Google on the TV, laptop or phone and gets a 4-letter room code.", doodle: "unboxing", tone: "bg-bw-yellow" },
  { t: "Friends join with the code", d: "Share the link on WhatsApp or just say the code. Players type a name on their phone. That\u2019s it.", doodle: "selfie", tone: "bg-bw-blue" },
  { t: "Sab milke khelo!", d: "The host picks a game and everyone plays together. Same room or different cities, add a video call for acting and singing games.", doodle: "moshing", tone: "bg-bw-red" },
];

const SCREEN_POINTS = [
  { icon: Tv, t: "The big screen", d: "Open TV mode from the host lobby on a TV or laptop. It shows the board, the timer and the scores for everyone." },
  { icon: Gamepad2, t: "The host", d: "Starts the room, picks the game and runs the show from their phone." },
  { icon: Smartphone, t: "Everyone\u2019s phone", d: "Each player gets their own secret cards, buttons and answers. Just the browser, nothing to install." },
  { icon: MonitorSmartphone, t: "No TV? No tension", d: "Phones alone work fine too." },
];

const WHY = [
  { icon: Smartphone, t: "No app for players", d: "Open the link, type a name, play." },
  { icon: UserX, t: "No player accounts", d: "Only the host signs in, with Google." },
  { icon: Heart, t: "Made for desi game nights", d: "Housie, Antakshari, Chor Kaun and more." },
  { icon: Users, t: "Easy rooms", d: "One 4-letter code gets everyone in." },
  { icon: PartyPopper, t: "Family + friends", d: "From nani to the cousins, everyone can play." },
];

const PHONES = [
  { pos: "-left-2 bottom-0 -rotate-12", screen: "bg-bw-red" },
  { pos: "left-[calc(50%-1.75rem)] -bottom-3", screen: "bg-bw-yellow" },
];

function SectionTitle({ kicker, title, light = false, id }: { kicker: string; title: React.ReactNode; light?: boolean; id?: string }) {
  return (
    <div className="mb-8 text-center">
      <p className={`font-bw-accent text-sm font-extrabold uppercase tracking-[0.2em] ${light ? "text-bw-yellow" : "text-bw-red-ink"}`}>{kicker}</p>
      <h2 id={id} className={`mt-1 font-bw-display text-[2.75rem] leading-[0.95] sm:text-6xl ${light ? "text-white bw-title-drop" : "text-bw-ink"}`}>
        {title}
      </h2>
    </div>
  );
}

export default async function Home() {
  const user = await getUser();
  return (
    <main className="bw overflow-x-clip">
      <BrandHeader
        right={
          user ? (
            <form action="/auth/signout" method="post">
              <button className="inline-flex min-h-11 items-center px-1 whitespace-nowrap font-bw-accent text-base font-bold text-bw-ink underline decoration-[3px] underline-offset-4">Sign out</button>
            </form>
          ) : isSupabaseConfigured ? (
            <Link href="/login" className="inline-flex min-h-11 items-center px-1 whitespace-nowrap font-bw-accent text-base font-bold text-bw-ink underline decoration-[3px] underline-offset-4">
              Sign in
            </Link>
          ) : null
        }
      />

      {/* ── Hero ── */}
      <section className="bw-rays relative isolate overflow-hidden border-b-[3px] border-bw-ink" aria-labelledby="hero-title">
        <div className="pointer-events-none absolute inset-0 -z-10 text-bw-orange opacity-25 bw-halftone [mask-image:linear-gradient(to_bottom,transparent,black)]" aria-hidden />
        <Splash className="pointer-events-none absolute -left-3 top-6 -z-10 hidden size-20 -rotate-12 sm:block" />
        <Splash className="pointer-events-none absolute -right-2 bottom-10 -z-10 size-16 rotate-[160deg] sm:size-24" color="var(--bw-red)" />

        <div className="mx-auto grid max-w-6xl items-center gap-x-10 gap-y-6 px-4 pb-14 pt-6 sm:pt-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:pb-20 lg:pt-16">
          <div>
            <h1 id="hero-title" className="text-balance font-bw-display text-[3.4rem] leading-[0.9] text-bw-ink sm:text-7xl lg:text-[5.5rem]">
              Ghar mein sab hain?
              <span className="mt-1 block text-bw-red-ink">
                Toh <span className="bw-pop-sm inline-block -rotate-2 rounded-lg bg-bw-red px-2 pt-1 text-white">BAWAAL</span> karo!
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg font-semibold leading-snug text-bw-ink sm:text-xl">
              Desi party games for your family and friends. Put it on the big screen, join from your phones, and let the madness begin.
            </p>
            <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
              <Link href="/host" className={bwButtonClass("red", "lg")}>
                Start a BAWAAL
              </Link>
              <Link href="#games" className={bwButtonClass("white", "lg")}>
                Explore games
              </Link>
            </div>
            <ul className="mt-6 flex flex-col gap-1.5 text-[0.95rem] font-bold text-bw-ink sm:flex-row sm:flex-wrap sm:gap-x-5" aria-label="Good to know">
              {REASSURE.map((line) => (
                <li key={line} className="flex items-center gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-bw-ink text-bw-yellow" aria-hidden>
                    <Check className="size-3.5" strokeWidth={4} />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <RoomCodeJump />
            </div>
            {!isSupabaseConfigured && (
              <p className="mt-4 max-w-xl rounded-xl border-2 border-bw-ink bg-white px-3 py-2 text-sm">
                Demo mode: Supabase isn’t configured, so login is skipped and rooms only sync between tabs of this browser.
              </p>
            )}
          </div>

          <div className="relative hidden min-h-[30rem] place-items-center lg:grid" aria-hidden>
            <Burst className="absolute inset-0 -z-10 m-auto size-[min(34rem,100%)] rotate-6" />
            <Image src="/brand/bawaal-logo.webp" alt="" width={800} height={267} priority className="bw-wiggle relative w-[108%] max-w-none drop-shadow-[6px_6px_0_var(--bw-ink)]" />
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="scroll-mt-16 bg-bw-cream px-4 py-16 sm:py-20" aria-labelledby="how-title">
        <div className="mx-auto max-w-6xl">
          <SectionTitle id="how-title" kicker="How it works" title="Teen steps. Full BAWAAL." />
          <ol className="grid gap-6 md:grid-cols-3">
            {STEPS.map(({ t, d, doodle, tone }, i) => (
              <li key={t} className="bw-pop relative flex flex-col rounded-2xl bg-white p-5 pt-8">
                <span className={`bw-pop-sm absolute -top-5 left-5 grid size-12 place-items-center rounded-full font-bw-display text-3xl ${tone} ${tone === "bg-bw-yellow" ? "text-bw-ink" : "text-white"}`}>
                  {i + 1}
                </span>
                <Doodle name={doodle} panel={false} className="mx-auto h-40 w-full" />
                <h3 className="mt-3 font-bw-accent text-2xl font-extrabold leading-tight">{t}</h3>
                <p className="mt-1 text-base leading-snug text-bw-ink/80">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Games ── */}
      <section id="games" className="relative isolate scroll-mt-16 border-y-[3px] border-bw-ink bg-bw-ink px-4 py-16 sm:py-20" aria-labelledby="games-title">
        <div className="pointer-events-none absolute inset-0 -z-10 text-white opacity-[0.07] bw-halftone" aria-hidden />
        <div className="mx-auto max-w-6xl">
          <SectionTitle id="games-title" kicker="Game time" title="Aaj kya khelein?" light />
          <HomeGamesSection />
        </div>
      </section>

      {/* ── Big screen ── */}
      <section className="relative isolate overflow-hidden bg-bw-blue px-4 py-16 text-white sm:py-20" aria-labelledby="screen-title">
        <div className="pointer-events-none absolute inset-0 -z-10 text-white opacity-10 bw-halftone" aria-hidden />
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="font-bw-accent text-sm font-extrabold uppercase tracking-[0.2em] text-bw-yellow-soft">Big screen + phones</p>
            <h2 id="screen-title" className="bw-title-drop mt-1 font-bw-display text-[2.75rem] leading-[0.95] sm:text-6xl">Ek screen. Sabka game.</h2>
            <ul className="mt-6 space-y-4">
              {SCREEN_POINTS.map(({ icon: Icon, t, d }) => (
                <li key={t} className="flex gap-3">
                  <span className="bw-pop-sm grid size-11 shrink-0 place-items-center rounded-xl bg-bw-yellow text-bw-ink" aria-hidden>
                    <Icon className="size-5" strokeWidth={2.5} />
                  </span>
                  <span>
                    <span className="block font-bw-accent text-xl font-extrabold">{t}</span>
                    <span className="block text-base leading-snug text-white/90">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* TV + phones, drawn in CSS */}
          <div className="relative mx-auto w-full max-w-lg pb-10" aria-hidden>
            <div className="bw-pop rounded-2xl bg-bw-ink p-3">
              <div className="relative grid aspect-video place-items-center overflow-hidden rounded-lg bg-bw-yellow">
                <div className="pointer-events-none absolute inset-0 text-bw-orange opacity-30 bw-halftone" />
                <Burst className="absolute size-[85%] opacity-90" fill="var(--bw-red)" />
                <div className="relative text-center">
                  <div className="font-bw-display text-5xl text-white bw-title-drop sm:text-6xl">Team BAWAAL!</div>
                  <div className="mt-1 inline-block rounded-md bg-white px-3 font-bw-display text-2xl tracking-[0.3em] text-bw-ink">ROOM ABCD</div>
                </div>
              </div>
            </div>
            <div className="mx-auto h-4 w-24 border-x-[3px] border-bw-ink bg-bw-ink" />
            {PHONES.map(({ pos, screen }) => (
              <div key={pos} className={`bw-pop-sm absolute h-24 w-14 rounded-xl bg-bw-ink p-1.5 ${pos}`}>
                <div className={`grid h-full w-full place-items-center rounded-md ${screen}`}>
                  <span className="size-4 rounded-full border-[3px] border-bw-ink bg-white" />
                </div>
              </div>
            ))}
            <Doodle name="laying" className="absolute -bottom-12 -right-3 w-36 rotate-6 sm:w-48" />
          </div>
        </div>
      </section>

      {/* ── Why BAWAAL ── */}
      <section className="bg-bw-yellow-soft px-4 py-16 sm:py-20" aria-labelledby="why-title">
        <div className="mx-auto max-w-6xl">
          <SectionTitle id="why-title" kicker="Why BAWAAL" title="Seedha, simple, full masti." />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {WHY.map(({ icon: Icon, t, d }, i) => (
              <li key={t} className="bw-pop rounded-2xl bg-white p-5">
                <span className={`bw-pop-sm grid size-12 place-items-center rounded-full ${["bg-bw-red text-white", "bg-bw-blue text-white", "bg-bw-yellow text-bw-ink"][i % 3]}`} aria-hidden>
                  <Icon className="size-6" strokeWidth={2.5} />
                </span>
                <h3 className="mt-3 font-bw-accent text-xl font-extrabold leading-tight">{t}</h3>
                <p className="mt-1 text-base leading-snug text-bw-ink/80">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative isolate overflow-hidden border-y-[3px] border-bw-ink bg-bw-red px-4 py-16 text-white sm:py-20" aria-labelledby="final-title">
        <div className="pointer-events-none absolute inset-0 -z-10 text-bw-ink opacity-15 bw-halftone" aria-hidden />
        <Burst className="pointer-events-none absolute -left-24 -top-24 -z-10 size-72 opacity-90" fill="var(--bw-yellow)" />
        <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div className="relative">
            <h2 id="final-title" className="bw-title-drop font-bw-display text-[3rem] leading-[0.92] sm:text-7xl">
              Dost aa gaye?
              <span className="block text-bw-yellow">BAWAAL shuru karo!</span>
            </h2>
            <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
              <Link href="/host" className={bwButtonClass("yellow", "lg")}>
                Start a BAWAAL
              </Link>
            </div>
            <div className="bw-pop mt-8 max-w-lg rounded-2xl bg-bw-ink p-4">
              <RoomCodeJump id="final-code" dark />
            </div>
          </div>
          <Doodle name="jumping" className="mx-auto w-64 -rotate-3 sm:w-80" />
        </div>
      </section>

      <footer className="bg-bw-ink px-4 py-10 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Image src="/brand/bawaal-logo.webp" alt="BAWAAL" width={800} height={267} className="h-12 w-auto" />
            <p className="mt-2 text-sm text-white/80">Desi party games for your family and friends.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 font-bw-accent font-bold" aria-label="Footer">
            <Link href="/games" className="inline-flex min-h-11 items-center underline decoration-bw-yellow decoration-2 underline-offset-4">All games</Link>
            <Link href="/join" className="inline-flex min-h-11 items-center underline decoration-bw-yellow decoration-2 underline-offset-4">Join a party</Link>
            <Link href="/privacy" className="inline-flex min-h-11 items-center underline decoration-bw-yellow decoration-2 underline-offset-4">Privacy Policy</Link>
          </nav>
        </div>
        <p className="mx-auto mt-6 max-w-6xl text-xs text-white/60">
          Illustrations: <a href="https://www.opendoodles.com" className="underline">Open Doodles</a> by Pablo Stanley (CC0), recoloured.
        </p>
      </footer>
    </main>
  );
}
