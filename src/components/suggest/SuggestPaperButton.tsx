"use client";

import type { ReactNode } from "react";
import { BusyPaperButton } from "@/components/loaders";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof BusyPaperButton>, "busyLabel"> & {
  busyLabel?: string;
  children: ReactNode;
};

/** Compact paper chip for ✨ AI suggest actions. */
export function SuggestPaperButton({ children, loading, busyLabel = "Thinking…", className = "", tone = "paper", size = "md", ...rest }: Props) {
  return (
    <BusyPaperButton tone={tone} size={size} loading={loading} busyLabel={busyLabel} className={`inline-flex ${className}`} {...rest}>
      {children}
    </BusyPaperButton>
  );
}
