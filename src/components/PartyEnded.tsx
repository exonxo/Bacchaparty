import Link from "next/link";
import { PaperButton } from "@/components/paper/Paper";

/** Shown when the host ends the party for everyone. */
export function PartyEnded({ asHost }: { asHost?: boolean }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-p-title font-extrabold">The host ended the party</h1>
      <p className="max-w-sm text-p-body text-muted">
        {asHost ? "Everyone has been sent home. You can start a new party anytime." : "Thanks for playing! Ask your host for a new code next time."}
      </p>
      <Link href={asHost ? "/host" : "/"} className="mt-2">
        <PaperButton size="lg">{asHost ? "Host dashboard" : "Back to home"}</PaperButton>
      </Link>
    </main>
  );
}
