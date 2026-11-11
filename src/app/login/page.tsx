import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { Header } from "@/components/Header";
import { isSupabaseConfigured } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";
import { GoogleButton } from "./GoogleButton";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/host";
  if (!isSupabaseConfigured) redirect(safeNext);
  if (await getUser()) redirect(safeNext);
  return (
    <main className="flex min-h-dvh flex-col">
      <Header />
      <div className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-10 lg:max-w-lg">
        <div className="w-full rounded-2xl border border-white/10 bg-card p-6 text-center sm:p-8 lg:p-10">
          <Users className="mx-auto h-12 w-12 text-saffron" />
          <h1 className="mt-3 font-display text-3xl font-extrabold lg:text-4xl">Sign in to host</h1>
          <p className="mt-2 text-muted lg:text-lg">Only the host needs an account. Everyone else joins with the room code — kids don’t need Google accounts.</p>
          {error && <p className="mt-4 rounded-xl bg-red/20 px-3 py-2 text-[#ff9aa4]">Sign-in failed. Please try again.</p>}
          <div className="mt-6">
            <GoogleButton next={safeNext} />
          </div>
          <Link href="/join" className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 font-semibold text-ink/90 hover:bg-white/[0.06]">
            Already have a code? Join the party
          </Link>
        </div>
      </div>
    </main>
  );
}
