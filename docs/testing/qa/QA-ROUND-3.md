# QA round 3 — confetti, Emoji answers, repeats, LLM suggestions

Date: 21 Nov 2026 · Browser: Chromium, 390×844 phone emulation (touch) · Host + 3 bots, or host + 2 real-browser phones.
Scripts: `docs/testing/qa/confetti.js`, `docs/testing/qa/confetti-results.js`. The matcher table and repeat numbers come from the code in `src/lib/util.ts`, `src/content/emoji-picture.ts`, `src/lib/suggest/`.

## 1. Confetti ("graffiti" keeps firing)

| ID | Case | Result | Notes |
|---|---|---|---|
| TC-CF-1 | Puno ends: scorecard appears and celebrates once | PASS | |
| TC-CF-2 | Dismiss the scorecard, reload the lobby: no confetti | **FAIL** | Confetti fires again after every reload, even after dismissal. |
| TC-CF-3 | Same room in a new tab: no confetti for a dismissed scorecard | INCONCLUSIVE | A second tab isn't the active host, so no scorecard shows; the test proves nothing. |
| TC-CF-4 | Emoji Picture ends: results celebrate | PASS | |
| TC-CF-5 | Reload the Emoji results screen: no confetti | **FAIL** | Confetti fires on every mount of the results screen. |

**Causes (from reading the code):**
- **TC-CF-2:** `src/components/ResultsCard.tsx` reads the dismissed flag from `sessionStorage` in one effect, but the celebrate effect runs first and still sees `null`. So a dismissed card celebrates on every mount.
- **TC-CF-5:** `src/games/emoji-picture/PaperPhone.tsx` (and `src/games/sound-guru/PaperPhone.tsx`, same code, not tested) starts a 1.75 s timer on mount that calls `celebrate()`. Any remount of the results screen fires it again.
- **Also (static, not tested):** `raja-mantri/PaperPhone.tsx` and `chor-kaun/PaperPhone.tsx` start a `setTimeout(celebrate)` without clearing it, so confetti can fire after the screen has been left.

## 2. Emoji answers ("What is this?" → "javelin" rejected)

Answer key for `🥇🎯🇮🇳` (static content, `src/content/emoji-picture.ts`): answer "Neeraj Chopra", alt ["Javelin"].
Checked with the same `answerMatches()` the game uses:

| Typed | Accepted? | Why |
|---|---|---|
| `javelin` | yes | exact alt |
| `Javelin` | yes | case ignored |
| `javelin!` | yes | punctuation ignored |
| `javlin` / `javeline` | yes | typo allowance (1 edit for 5–8 letters) |
| `neeraj chopra` | yes | exact answer |
| `it's javelin` / `its javelin` / `it is javelin` | **no** | only "the", "a", "an" are dropped; "it's" becomes "it s" |
| `it's a javelin` | **no** | same |
| `Javelin throw` / `javelin ka khel` | **no** | extra words |
| `Neeraj` / `Chopra` | **no** | partial name not in the key |
| `gold` / `Olympics` / `target` | no | not in the key (correct by design) |

- **TC-EM-1 (plain "javelin" accepted):** PASS.
- **TC-EM-2 (filler words such as "it's" block a correct answer):** **FAIL** — a correct answer is rejected.
- **TC-EM-3 (the judging is not done by the LLM):** PASS. The host judges answers with `answerMatches` against the stored key. No model is called during play.
- **TC-EM-4 (LLM-made puzzles are checked for facts):** **FAIL** — `src/lib/suggest/validate.ts` checks shape, safety and duplicates only. A wrong answer from the model becomes the answer key.

## 3. Repeats

Pool sizes: Emoji family difficulty = 68 puzzles (kids 29 + family 39); a game uses 10. Dare fallback = 12 lines. Draw & Guess family = 146 words (kids 68 + family 78).

| ID | Case | Expected by chance | Result |
|---|---|---|---|
| TC-RP-1 | Two Emoji games share at least one puzzle | 82% (about 1.5 puzzles shared on average) | **FINDING** — matches the pool size; the 68-puzzle pool is too small for variety across sessions |
| TC-RP-2 | Five dare draws contain a repeat (fallback) | 62% | **FINDING** — repeats are common with 12 lines |
| TC-RP-3 | Draw & Guess repeats within one game | none (the deck is shuffled once per game) | PASS |

## 4. LLM suggestions repeat

| ID | Case | Result | Notes |
|---|---|---|---|
| TC-LL-1 | Each new request tells the model what it already gave (dares, puzzles) | **FAIL** | `src/lib/suggest/gemini.ts` prompts have no "avoid" list for dares or emoji puzzles. Only Chor Kaun topic ids are sent. |
| TC-LL-2 | Requests vary (no random seed, no variety hints, default temperature) | **FAIL** | The same prompt goes out every time, and `thinkingBudget: 0`. The model's most likely answers come back again. |
| TC-LL-3 | When the model is unavailable, the app says so | **FAIL** | Emoji's setup panel labels the source "built-in puzzles" versus "puzzles". Dares and What next? don't say which source they used. |
| TC-LL-4 | Rate limit and fallback behave | PASS (by code) | 12 requests per minute per room, then the built-in list. Pressing Draw or Suggest more than 12 times a minute returns built-in lines. |
| TC-LL-5 | Production has a Gemini key | NOT VERIFIED | Environment variables on Vercel can't be read from here. If the key is missing, every "suggestion" is a built-in one. |

## 5. Not covered in this round
- Layout sweep at 390px after the latest changes: PASS (no new overflow, small text, covered buttons or script errors, apart from the known scroll-under-header item).
- Rematch and Lobby flow after the latest changes: PASS (10/10).
- Sound Guru and Emoji confetti on a real phone; real iOS behaviour.
