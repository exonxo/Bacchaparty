import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Privacy Policy — Bacchaparty",
  description: "What Bacchaparty collects, why, and what we do with it.",
};

const CONTACT = "proloykarmakar25@gmail.com";
const UPDATED = "11 November 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-2xl font-bold text-saffron">{title}</h2>
      <div className="mt-2 space-y-3 text-lg leading-relaxed text-ink/90">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="pb-20">
      <Header />
      <article className="mx-auto max-w-3xl px-4">
        <h1 className="mt-4 text-4xl font-extrabold">Privacy Policy</h1>
        <p className="mt-2 text-muted">Last updated: {UPDATED}</p>
        <p className="mt-6 text-lg leading-relaxed">
          Bacchaparty is a set of party games you play on a big screen with everyone joining from their phones. We collect as little as we can.
          Here’s exactly what that means.
        </p>

        <Section title="Hosts (people who sign in with Google)">
          <p>
            To host a party you sign in with Google. We only use your basic Google profile — your <b>name</b> and <b>email address</b> — to
            create your party rooms and run them. We don’t get your Google password, and we don’t read your contacts, Drive, Gmail or anything
            else in your Google account.
          </p>
        </Section>

        <Section title="Players (people who join with a room code)">
          <p>
            Players don’t need an account. To join, you type a room code and a <b>display name</b> (a nickname is fine) and pick an animal
            avatar. That’s all we ask for.
          </p>
          <p>
            Your phone remembers your nickname and a random player ID in the browser’s local storage so you can rejoin if the page reloads. You
            can clear it any time by clearing your browser data.
          </p>
        </Section>

        <Section title="What we store">
          <p>
            For each party room we store the <b>room code</b>, <b>which host created it</b>, and <b>when it was created and closed</b>. This is
            kept in Supabase, our database and login provider.
          </p>
          <p>
            While you play, game moves (answers, votes, drawings, display names) pass through Supabase’s real-time service between the phones
            and the big screen. We don’t save them in our database. The host’s browser keeps the current game in its own local storage so a
            refresh doesn’t lose your progress.
          </p>
          <p>
            The website is hosted on Vercel, which, like any web host, may keep standard technical logs (such as IP addresses and browser type)
            for security and to keep the site running.
          </p>
        </Section>

        <Section title="We don’t sell or share your data">
          <p>
            We don’t sell, rent or share your data with anyone. We don’t show ads and we don’t use tracking or advertising cookies. The only
            services that handle data are the ones that run the app: Google (sign-in), Supabase (database and real-time) and Vercel (hosting).
          </p>
        </Section>

        <Section title="Children">
          <p>
            Bacchaparty is made for families, and children often play as guests. Players under 13 should join with a parent or guardian
            present. Guests only enter a nickname, so please encourage kids to use a nickname rather than their full name.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            Hosts can ask us to delete their account and room records at any time by emailing us. Players can remove their nickname by clearing
            their browser data.
          </p>
        </Section>

        <Section title="Changes">
          <p>If we change this policy, we’ll update this page and the date at the top.</p>
        </Section>

        <Section title="Contact">
          <p>
            Questions or requests? Email{" "}
            <a href={`mailto:${CONTACT}`} className="font-semibold text-saffron underline">
              {CONTACT}
            </a>
            .
          </p>
        </Section>

        <p className="mt-12">
          <Link href="/" className="font-semibold text-muted hover:text-ink">
            ← Back to Bacchaparty
          </Link>
        </p>
      </article>
    </main>
  );
}
