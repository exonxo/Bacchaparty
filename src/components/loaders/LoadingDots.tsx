"use client";
export function LoadingDots({ className = "" }: { className?: string }) {
  return (
    <span className={`loader-dot inline-flex items-center justify-center gap-1.5 ${className}`} aria-hidden>
      <i className="block h-1.5 w-1.5 rounded-full bg-ink [animation:loader-dot_1.2s_infinite]" />
      <i className="block h-1.5 w-1.5 rounded-full bg-ink [animation:loader-dot_1.2s_infinite] [animation-delay:-0.8s]" />
      <i className="block h-1.5 w-1.5 rounded-full bg-ink [animation:loader-dot_1.2s_infinite] [animation-delay:-0.4s]" />
    </span>
  );
}
