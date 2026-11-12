/**
 * Test-mode moves for Jaldi Bolo. Simulated players fill in a few answers that
 * start with the letter (some blank, like real players), then tap "Ho gaya".
 * Uses the same actions a phone sends: "answers" and "done".
 */
import { N } from "./shared";

type Move = { playerId: string; type: string; payload?: unknown };

/** A few well-known answers per letter, in category order: name, place, animal, food, film. */
const WORDS: Record<string, [string[], string[], string[], string[], string[]]> = {
  A: [["Amit", "Anjali"], ["Agra", "Amritsar"], ["Alligator"], ["Aloo Paratha", "Appam"], ["Andaz Apna Apna"]],
  B: [["Bunty", "Bhavna"], ["Bengaluru", "Bhopal"], ["Bandar", "Bear"], ["Biryani", "Bhel Puri"], ["Bajrangi Bhaijaan"]],
  C: [["Chintu", "Chhavi"], ["Chennai", "Chandigarh"], ["Cheetah", "Camel"], ["Chole Bhature"], ["Chak De India"]],
  D: [["Deepak", "Diya"], ["Delhi", "Darjeeling"], ["Dog", "Deer"], ["Dosa", "Dhokla"], ["Dangal", "Dil Chahta Hai"]],
  E: [["Esha"], ["Ernakulam"], ["Elephant", "Eagle"], ["Egg Curry"], ["English Vinglish"]],
  F: [["Farhan"], ["Faridabad"], ["Fox", "Frog"], ["Falooda"], ["Fashion"]],
  G: [["Golu", "Geeta"], ["Goa", "Guwahati"], ["Giraffe", "Goat"], ["Gulab Jamun"], ["Gadar"]],
  H: [["Harsh", "Hema"], ["Hyderabad"], ["Hathi", "Horse"], ["Halwa"], ["Hum Aapke Hain Koun"]],
  I: [["Isha", "Imran"], ["Indore", "Imphal"], ["Iguana"], ["Idli"], ["Iqbal"]],
  J: [["Jatin", "Jaya"], ["Jaipur", "Jodhpur"], ["Jackal"], ["Jalebi"], ["Jab We Met"]],
  K: [["Kabir", "Kavya"], ["Kolkata", "Kochi"], ["Kangaroo", "Koyal"], ["Kheer", "Kachori"], ["Kabhi Khushi Kabhie Gham"]],
  L: [["Lakshmi", "Lalit"], ["Lucknow", "Leh"], ["Lion", "Leopard"], ["Laddoo", "Litti Chokha"], ["Lagaan"]],
  M: [["Mummy", "Mohan"], ["Mumbai", "Mysuru"], ["Monkey", "Mor"], ["Masala Dosa", "Modak"], ["Mughal-e-Azam"]],
  N: [["Nani", "Neha"], ["Nagpur", "Nashik"], ["Nilgai"], ["Naan", "Nimbu Pani"], ["Namaste London"]],
  O: [["Om"], ["Ooty", "Odisha"], ["Owl", "Ostrich"], ["Onion Pakoda"], ["Om Shanti Om"]],
  P: [["Pinky", "Priya"], ["Pune", "Patna"], ["Peacock", "Parrot"], ["Pani Puri", "Poha"], ["PK", "Padosan"]],
  R: [["Rani", "Rohan"], ["Ranchi", "Rishikesh"], ["Rabbit", "Rhino"], ["Rajma", "Rasgulla"], ["Rang De Basanti"]],
  S: [["Sunita", "Sameer"], ["Shimla", "Surat"], ["Snake", "Sher"], ["Samosa", "Sambar"], ["Sholay"]],
  T: [["Tanya", "Tarun"], ["Thane", "Thiruvananthapuram"], ["Tiger", "Tota"], ["Thepla", "Tandoori Roti"], ["Taare Zameen Par"]],
  U: [["Uma", "Uday"], ["Udaipur", "Ujjain"], ["Ullu"], ["Upma", "Uttapam"], ["Udaan"]],
  V: [["Vikram", "Vidya"], ["Varanasi", "Vadodara"], ["Vulture"], ["Vada Pav"], ["Veer-Zaara"]],
  W: [["Waseem"], ["Wardha", "Wayanad"], ["Wolf", "Whale"], ["Wada"], ["Wake Up Sid"]],
};

function pick<T>(arr: T[]): T | undefined {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined;
}

export function botMoves(raw: unknown, _view: unknown, bots: string[]): Move[] {
  const s = (raw ?? {}) as {
    phase?: string;
    round?: number;
    letters?: string[];
    revealAt?: number;
    answers?: Record<string, string[]>;
    done?: Record<string, boolean>;
    participants?: string[];
  };
  if (s.phase !== "answering" || !s.letters || !s.round) return [];
  const letter = s.letters[s.round - 1];
  const words = WORDS[letter];
  const out: Move[] = [];
  for (const b of bots) {
    if (!s.participants?.includes(b) || s.done?.[b]) continue;
    const mine = s.answers?.[b];
    if (!mine) {
      // Start writing after a moment (about 4s on average at the 0.9s bot tick).
      if (Math.random() > 0.22) continue;
      const answers = Array.from({ length: N }, (_, i) => (words && Math.random() < 0.75 ? (pick(words[i]) ?? "") : ""));
      out.push({ playerId: b, type: "answers", payload: answers });
    } else if (Math.random() < 0.18) {
      out.push({ playerId: b, type: "done" });
    }
  }
  return out;
}
