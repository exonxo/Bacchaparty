"use client";
/** Three folded chits beside a busy button label (spec §01). */
export function ChitShuffle({ className = "" }: { className?: string }) {
  return (
    <span className={`loader-chit inline-flex items-end gap-0.5 ${className}`} aria-hidden>
      <i className="block h-4 w-3 rounded-[2px] border-[1.5px] border-ink bg-paper shadow-[1px_1px_0_0_#1e1a17] [animation:loader-chit-1_1.2s_ease-in-out_infinite]" />
      <i className="block h-[18px] w-3.5 rounded-[2px] border-[1.5px] border-ink bg-turmeric shadow-[1px_1px_0_0_#1e1a17] [animation:loader-chit-2_1.2s_ease-in-out_infinite]" />
      <i className="block h-4 w-3 rounded-[2px] border-[1.5px] border-ink bg-vermilion shadow-[1px_1px_0_0_#1e1a17] [animation:loader-chit-3_1.2s_ease-in-out_infinite]" />
    </span>
  );
}
