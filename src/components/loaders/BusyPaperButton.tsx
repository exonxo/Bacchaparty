"use client";
import type { ReactNode } from "react";
import { PaperButton } from "@/components/paper/Paper";
import type { ComponentProps } from "react";
import { useDelayedVisible } from "@/lib/useDelayedVisible";
import { ChitShuffle } from "./ChitShuffle";

type Props = Omit<ComponentProps<typeof PaperButton>, "children"> & {
  children: ReactNode;
  loading?: boolean;
  busyLabel: string;
  helper?: string;
};

/** Paper button with Chit Shuffle after 150ms while `loading` (spec §01). */
export function BusyPaperButton({ children, loading = false, busyLabel, helper, disabled, className = "", ...rest }: Props) {
  const showChits = useDelayedVisible(loading);
  return (
    <div className={className.includes("w-full") ? "w-full" : ""}>
      <PaperButton {...rest} disabled={disabled || loading} className={className} aria-busy={loading || undefined}>
        {loading ? (
          <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
            {showChits && <ChitShuffle />}
            {busyLabel}
          </span>
        ) : (
          children
        )}
      </PaperButton>
      {loading && helper && showChits && (
        <p className="mt-2 text-center text-p-note text-muted" role="status">
          {helper}
        </p>
      )}
    </div>
  );
}
