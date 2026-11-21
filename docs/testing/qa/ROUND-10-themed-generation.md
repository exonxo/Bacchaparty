# Round 10: themed generation, TMDB movies and the weekly top-up

## Why the admin panel made gibberish emoji quizzes

Read-only look at the live review queue (`content_items`, from the Content tab's "Generate emoji puzzles"):

- One batch was ten made-up "rickshaw" phrases ("Rickshaw ambulance service", "Rickshaw in a kite festival"),
  filed as Cartoon. Another had real answers with emoji that didn't spell them (Lagaan 🎬🪔🐘) and an invented "Cheese Chaat".
- Parsing was fine: every field arrived where it should. The cause was the prompt:
  - the server picked a hidden random theme ("auto-rickshaw life"), and the admin couldn't choose one;
  - the prompt said "be surprising, choose less obvious items", which invites invention;
  - nothing required a real, well-known answer, or emoji that stand for parts of it;
  - there was no worked example, and temperature was 1.1;
  - the check only looked at presence, length and safety (no "emoji only", no category match).

## What changed

- **Theme, required.** Free text up to 60 characters plus quick picks (Bollywood movies, Movies, Indian food, Cricket,
  Festivals, Songs, Places in India).
  - Cleaned against prompt injection: letters, digits and a few punctuation marks only; instruction words such as
    ignore, system, prompt, reply or JSON are refused.
  - The prompt quotes it as a topic name only. It's used for emoji puzzles, Chor Kaun topics and dares.
  - It's stored on each library item (migration 0011, column `theme`) and exported in the CSV.
- **Better prompt.** Rules state a real, well-known answer and 2–6 emoji only, each standing for part of the answer. The model must give a "decode" line and a hint without the answer, and includes a worked example. Admin runs use temperature 0.7.
- **Server-side screening.** Items are rejected for:
  - emojis missing or not only emoji
  - the answer missing or too long
  - the hint missing or containing the answer
  - the wrong category for the theme
  - the wrong level, unsafe text, or a repeat

  Rejected items are never stored. The panel shows made, kept and rejected counts, with reasons.
- **Movies come from TMDB.**
  - For a movie theme, the server takes very popular Indian films from TMDB: discover with
    `with_origin_country=IN`, original language hi or the main Indian languages, sorted by vote count, with at least 100 votes.
  - It skips titles already in the library or built in, and passes the AI each title with its year and a short overview, marked as data.
  - The AI only draws the emoji. Any answer that isn't one of those titles is rejected, and the stored answer is the TMDB title.
  - The romanized title is chosen over TMDB's English translation: "Taare Zameen Par", not "Like Stars on Earth". It's the candidate whose sound is closest to the Devanagari original.
  - Lists are cached for 12 h in memory and in Next's fetch cache.
  - The credit "Movie data from TMDB" is on the privacy page.
- **Chor Kaun movie topics** use no AI: one decade of real popular titles ("Bollywood movies: 2010s").
  - About a third of top-up topics are movie topics (`CHOR_MOVIE_SHARE`, default 1/3). The rest are AI topics on non-movie themes.
- **Library tab.** Lists the newest 50 items per game, with a Deactivate / Reactivate button (`library.set_active`).
- **Weekly top-up.**
  - It runs from the existing nightly `/api/cron/purge` (vercel.json unchanged). After the purge, if the last finished top-up is 7 or more days old, it runs.
  - One run makes Chor Kaun topics (about a third from movies), then 2 dares, then about 40 TMDB movies as emoji puzzles.
  - It respects a 45 s budget, and a failed batch waits once and retries (Groq's free tier answers 429 after about three big calls a minute).
  - A run that keeps fewer than 20 puzzles isn't "done", so the next night continues.
  - Each run is recorded in `cron_runs` (job `topup`) and `app_events` (`cron_run`). The Library and Health tabs show the last run, and there's a "Run top-up now" button.

## Tests (this round)

| Suite | Result |
|---|---|
| lint, tsc, next build | clean |
| admin-sql / admin-power-sql | 53 / 72 passed |
| content-library-sql (0004–0011 on PGlite, theme checks THEME-1..8) | 64 passed |
| content-library.test.ts / llm-chain.test.ts / admin-security.test.ts | 11 / 13 / 22 passed |
| themed-generation.test.ts (themes, emoji-only, screening, prompts, TMDB with a fake API, movie topics, share, top-up guards) | 26 passed |
| suggest-validate-unit | OK |
| race tests (embedded Postgres, 0010 + 0011) | 4 + 4 passed |
| admin-http / admin-power-http / content-library-http / content-review-http | 27 / 19 / 36 / 19 passed |
| admin-ui (adds THEME-UI, TOPUP-UI) | 8 PASS |

Local end-to-end (embedded Postgres + PostgREST + supabase-js, real TMDB and Groq, nothing live):

- **Direct run:** due → 31 stored in 18.6 s (26 emoji from 40 movies, 1 movie + 2 AI Chor Kaun topics, 2 dares) → not due. Next week's 40 picks don't overlap the library.
- **Cron route** on a local server with a throwaway CRON_SECRET:
  - no token → 401
  - 1st call: purge plus top-up (33 kept, 19.4 s)
  - 2nd call: purge only (not due)
  - one cron_runs row and one app_events row

## Not verified

- The live cron path runs at 03:40 UTC (09:10 IST). It's tested locally only; the real cron token was never used.
- The Gemini fallback inside the top-up wasn't exercised locally (Groq only).
