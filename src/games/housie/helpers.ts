/** Shared between the Housie rules (index.tsx) and its phone view. */

/** A ticket is 3 rows x 9 columns; 0 = blank. */
export type Ticket = number[][];
export type Prize = "early5" | "top" | "middle" | "bottom" | "full";

export const PRIZES: { id: Prize; label: string; hint: string; points: number }[] = [
  { id: "early5", label: "Early Five", hint: "Koi bhi 5", points: 10 },
  { id: "top", label: "Top Line", hint: "Upar wali", points: 15 },
  { id: "middle", label: "Middle Line", hint: "Beech wali", points: 15 },
  { id: "bottom", label: "Bottom Line", hint: "Neeche wali", points: 15 },
  { id: "full", label: "Full House", hint: "Poora ticket", points: 30 },
];

/** The five numbers of one row, left to right. */
export function rowNumbers(ticket: Ticket, row: number): number[] {
  return (ticket[row] ?? []).filter(Boolean);
}

/** How far a ticket is towards a prize, counting only numbers that were really called. */
export function prizeProgress(ticket: Ticket, called: ReadonlySet<number>, prize: Prize): { have: number; need: number } {
  const hit = (nums: number[]) => nums.filter((n) => called.has(n)).length;
  if (prize === "early5") return { have: Math.min(5, hit(ticket.flat().filter(Boolean))), need: 5 };
  if (prize === "full") return { have: hit(ticket.flat().filter(Boolean)), need: 15 };
  const row = prize === "top" ? 0 : prize === "middle" ? 1 : 2;
  return { have: hit(rowNumbers(ticket, row)), need: 5 };
}

/** Reads a call out loud (the host's phone, or every phone when people are apart). */
export function speak(text: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    u.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}
