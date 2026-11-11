/** Class names for a cut-paper button, for links and plain buttons (server-safe). */
export function paperButtonClass(tone: "ink" | "turmeric" | "vermilion" | "paper" = "turmeric", size: "md" | "lg" = "md") {
  const tones = { ink: "bg-ink text-bg", turmeric: "bg-turmeric text-ink", vermilion: "bg-vermilion text-paper", paper: "bg-paper text-ink" };
  const sizes = { md: "min-h-12 px-4 text-p-body", lg: "min-h-14 px-5 text-p-lead" };
  return `cut press font-display inline-flex items-center justify-center gap-2 rounded-cut font-bold ${tones[tone]} ${sizes[size]}`;
}
