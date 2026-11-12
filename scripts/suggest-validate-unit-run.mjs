import { GAMES } from "../src/games/catalog.ts";
import { fallbackNextGame } from "../src/lib/suggest/fallbacks.ts";
import { isUnsafeSuggestText } from "../src/lib/suggest/safety.ts";
import { validateChorTopic, validateDare, validateEmojiPuzzles, validateNextGame } from "../src/lib/suggest/validate.ts";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(!isUnsafeSuggestText("Visit Essex"), "Essex must not trip safety filter");
assert(isUnsafeSuggestText("everyone get drunk"), "drunk blocked for family");

const chor = validateChorTopic({
  id: "places",
  label: "Test places",
  emoji: "📍",
  words: Array.from({ length: 14 }, (_, i) => `word${i}`),
});
assert(chor && chor.id !== "places", "builtin chor id renamed");

const tenSame = validateEmojiPuzzles(
  Array.from({ length: 10 }, () => ({
    emojis: "🎬",
    category: "Movie",
    answer: "Same",
    hint: "hint",
    level: "family",
  })),
  10,
  "family",
);
assert(tenSame && tenSame.length === 10, "emoji dedupe + top-up to count");
assert(new Set(tenSame.map((p) => `${p.emojis}|${p.answer}`)).size > 1, "not all identical");

const kids = validateEmojiPuzzles(
  [{ emojis: "🍺", category: "Food", answer: "Beer", hint: "adults", level: "adults" }],
  5,
  "kids",
);
assert(kids && kids.length === 5 && kids.every((p) => p.level === "kids"), "kids level enforced + top-up");

assert(validateNextGame({ gameId: "raja-mantri", reason: "fun" }, 3) === null, "player min/max");
assert(validateNextGame({ gameId: "raja-mantri", reason: "fun" }, 4)?.gameId === "raja-mantri", "fits count");

assert(validateDare({ text: "Name three cities in Essex you love." })?.text.includes("Essex"), "Essex dare allowed");

const allPlayed = GAMES.map((g) => g.id);
let sawRepeat = false;
for (let i = 0; i < 40; i++) {
  const r = fallbackNextGame(4, allPlayed);
  if (r.reason.includes("repeat favourite")) {
    sawRepeat = true;
    break;
  }
}
assert(sawRepeat, "all games played fallback copy");

console.log("suggest-validate-unit: OK");
