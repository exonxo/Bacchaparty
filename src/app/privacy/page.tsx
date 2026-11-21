import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Privacy Policy — BAWAAL",
  description: "What BAWAAL stores, who can see it, and how long we keep it.",
};

const CONTACT = "uxproloy@gmail.com";
const UPDATED = "21 November 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-p-title font-extrabold">{title}</h2>
      <div className="mt-2 space-y-3 text-lg leading-relaxed text-ink">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="pb-20">
      <Header />
      <article className="mx-auto max-w-3xl px-4">
        <h1 className="mt-4 text-p-show font-extrabold">Privacy Policy</h1>
        <p className="mt-2 text-muted">Last updated: {UPDATED}</p>
        <p className="mt-6 text-lg leading-relaxed">
          BAWAAL is a set of party games you play on a big screen, with everyone joining from their phones. This page says what we store,
          why, who can see it, and how long we keep it.
        </p>

        <Section title="Hosts (people who sign in with Google)">
          <p>
            To host a party you sign in with Google. From Google we receive your <b>name</b>, your <b>email address</b> and your Google account
            ID. Your name is the default name shown to players in your rooms, and you can change it on the host screen. We don’t get your
            Google password, and we don’t read your contacts, Drive or Gmail.
          </p>
          <p>
            We also record when you first signed in, when you last signed in, and how many rooms you have created.
          </p>
        </Section>

        <Section title="Players (people who join with a room code)">
          <p>
            Players don’t need an account. To join, you type a room code, a <b>nickname</b> and pick an animal avatar. Everyone in that room sees
            the nickname and avatar while the game runs.
          </p>
          <p>
            Your phone keeps the nickname and a random player ID in the browser’s local storage, so you can rejoin if the page reloads. Clearing
            your browser data removes them.
          </p>
        </Section>

        <Section title="What we store, why, and for how long">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <b>Host account</b> — name, email, Google account ID, sign-up and last sign-in times. To run your account. Kept until you ask us to
              delete it.
            </li>
            <li>
              <b>Party rooms</b> — room code, the host, and when the room was created and closed. To run the party. Deleted after <b>7 days</b>.
            </li>
            <li>
              <b>Game starts</b> — which game was started and when. Not linked to a person, a room or a nickname. To see which games are played.
              Deleted after <b>180 days</b>.
            </li>
            <li>
              <b>Suggestions</b> — that a topic or puzzle was suggested, which AI service answered (or that the built-in list was used), and how
              long it took. Not linked to a person or a room. Deleted after <b>180 days</b>.
            </li>
            <li>
              <b>Admin sign-in attempts</b> — only for the site owner’s admin panel: the IP address, whether the sign-in worked, and the time.
              Deleted after <b>90 days</b>.
            </li>
            <li>
              <b>Game play</b> — answers, votes, drawings and nicknames pass through Supabase’s real-time service between the phones and the big
              screen. We don’t save them in our database.
            </li>
            <li>
              <b>On your device</b> — the host’s current game (so a refresh doesn’t lose it), the mute setting, and a short list of recently shown
              topics or puzzles so new suggestions don’t repeat. It stays on that device.
            </li>
            <li>
              <b>Hosting logs</b> — Vercel, which hosts the site, keeps standard technical logs such as IP address, browser and pages requested, for
              security and reliability. These follow Vercel’s own retention.
            </li>
          </ul>
        </Section>

        <Section title="Who can see your data">
          <p>
            <b>The site owner</b> is the only person with access to the admin panel. Through it, the owner can see the list of host accounts
            (email, sign-in method, sign-up and last sign-in dates, number of rooms created), totals and daily counts of game starts and
            suggestions, and admin sign-in attempts. The admin panel does <b>not</b> show passwords, player nicknames, game answers or drawings.
          </p>
          <p>
            <b>Service providers</b> that run the app for us: Google (sign-in), Supabase (database, sign-in and real-time) and Vercel (hosting,
            logs and scheduled clean-up).
          </p>
          <p>
            <b>AI services.</b> When a host taps a ✨ suggestion button, the request goes to the first available of: Google Gemini, Groq,
            OpenRouter or Cloudflare Workers AI. The request contains only game settings (such as the number of players) and the short list of
            topics or puzzles the device has already been shown. It never contains names, emails, room codes or other personal details. These
            services process requests under their own terms, and some free plans may keep requests to improve their services.
          </p>
        </Section>

        <Section title="We don’t sell your data">
          <p>
            We don’t sell, rent or give your data to advertisers. We don’t show ads, and we don’t use tracking or advertising cookies. The
            services above process data only to run BAWAAL for us.
          </p>
        </Section>

        <Section title="Children">
          <p>
            BAWAAL is made for families, and children often play as guests. Players under 13 should join with a parent or guardian present.
            Guests only enter a nickname, so please encourage children to use a nickname rather than their full name.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            Hosts can ask us to delete their account and rooms at any time by emailing us. We remove them within 30 days. Players can remove
            their nickname by clearing their browser data.
          </p>
        </Section>

        <Section title="Changes">
          <p>If we change this policy, we’ll update this page and the date at the top.</p>
        </Section>

        <Section title="Contact">
          <p>
            Questions or requests? Email{" "}
            <a href={`mailto:${CONTACT}`} className="inline-flex min-h-11 items-center font-semibold underline decoration-2 underline-offset-4">
              {CONTACT}
            </a>
            .
          </p>
        </Section>

        <p className="mt-12">
          <Link href="/" className="-ml-2 inline-flex min-h-11 items-center rounded-cut px-2 font-semibold text-muted hover:text-ink">
            ← Back to BAWAAL
          </Link>
        </p>
      </article>
    </main>
  );
}
