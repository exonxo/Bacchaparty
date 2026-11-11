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
    <main>
      <Header />
      <div className="mx-auto mt-10 max-w-md px-4">
        <div className="rounded-2xl border border-white/10 bg-card p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-saffron" />
          <h1 className="mt-3 text-3xl font-extrabold">Sign in to host</h1>
          <p className="mt-2 text-muted">Only the host needs an account. Everyone else joins with the room code — kids don’t need Google accounts.</p>
          {error && <p className="mt-4 rounded-xl bg-red/20 px-3 py-2 text-red">Sign-in failed. Please try again.</p>}
          <div className="mt-6">
            <GoogleButton next={safeNext} />
          </div>
        </div>
      </div>
    </main>
  );
}
