import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { GamesPageClient } from "./GamesPageClient";

export const metadata: Metadata = { title: "All games — Bacchaparty" };

export default function GamesPage() {
  return (
    <main className="pb-16">
      <Header />
      <div className="mx-auto max-w-6xl px-4">
        <h1 className="mt-6 text-p-show font-extrabold">Saare games</h1>
        <p className="mt-1 text-p-body text-muted">Tap a game to read how to play.</p>
        <GamesPageClient />
      </div>
    </main>
  );
}
