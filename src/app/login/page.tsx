import Link from "next/link";
import { redirect } from "next/navigation";
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
        <div className="cut w-full rotate-[-0.5deg] rounded-soft bg-card p-6 sm:p-8">
          <p className="text-p-note font-bold uppercase tracking-[0.2em] text-turmeric-ink">Sirf host ke liye</p>
          <h1 className="mt-1 text-p-title font-extrabold lg:text-4xl">Sign in to host</h1>
          <p className="mt-2 text-p-body text-muted lg:text-p-lead">Only the host needs an account. Baaki sab join with the room code — kids don’t need Google accounts.</p>
          {error && <p className="mt-4 rounded-cut border-[1.5px] border-vermilion px-3 py-2 font-semibold text-vermilion">Sign-in failed. Please try again.</p>}
          <div className="mt-6">
            <GoogleButton next={safeNext} />
          </div>
          <Link href="/join" className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-cut px-4 font-semibold underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink">
            Code hai? Join the party
          </Link>
        </div>
      </div>
    </main>
  );
}
