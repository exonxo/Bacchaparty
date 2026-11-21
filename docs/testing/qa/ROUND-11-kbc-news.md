# Round 11: KBC news questions

## What changed

- **Kaun Banega Champion** can mix in questions written from recent Indian news. The host taps
  **📰 News questions** in the game options; up to 10 come from the library (never from the AI
  during a game). They take every other rung (2nd, 4th, 6th, 8th, 10th) while any are left, and the
  built-in bank fills the rest. Kids games never get news; Family games only get family-level news.
  Each news question shows "📰 In the news · 6 Nov 2026 · Outlet" above it, on the TV and on phones.
- **Where questions come from** (fetched only by the weekly top-up and the admin Generate more
  button, never per game):
  - NewsAPI `/everything` over Indian outlets, titles only, last 30 days, two family-friendly topic
    searches (sport; science/culture/films/heritage), or one search for a theme. `top-headlines`
    with `country=in` returned no articles, so it isn't used. The free plan may refuse calls from a
    production server: that is reported (e.g. `corsNotAllowed`) and the Bharat API carries on.
  - Bharat News API: up to 12 headlines per state, no links or summaries; its date is the feed's
    `last_updated`. Downtime is reported (e.g. `http_503`, `timeout`) and NewsAPI carries on.
- **Filtering and checking**:
  1. A word filter drops crime, violence, death, disasters, illness, elections/parties, conflicts and
     market/money stories, live blogs and round-ups, very short or older than 35 days headlines, and
     stories already used.
  2. The AI keeps only family-friendly, India-related, guessable stories and writes one 4-option
     question (1 correct) from the story's own text.
  3. The answer must appear in the story text (checked in code).
  4. A second AI call answers each question from the story alone and quotes the words it relied on;
     it must pick the same answer and the quote must be in the story. Unsure means rejected.
- **Stored** in the content library as kind `kbc-question`, tagged `news:newsapi` or `news:bharat`,
  with the headline, article date, link (NewsAPI only) and an expiry 60 days after the article
  (capped at 90 days by the database). Expired questions are never served.
- **Admin**: "KBC news questions" in Generate more (up to 10; theme required: "Current affairs" for
  any news, or a topic like Cricket), an item list showing each question, its answer, source headline,
  date and expiry, and news counts (being served, expired, by source) on the Library tab. The weekly
  top-up adds about 10 after the movie puzzles, in time kept back for it within the 45 s budget.
- **Migration 0012** (`supabase/migrations/0012_kbc_news.sql`): allows the new kind, adds
  `expires_at` and a safe date parser, and replaces `library_pick` / `library_add` (same arguments).

## Tests

| Suite | Result |
| --- | --- |
| `kbc-news.test.ts` (new: sources, filter, validation, two-step pipeline with fake APIs, saving, in-game pick) | 25 passed |
| `themed-generation.test.ts` | 26 passed |
| `content-library.test.ts` | 11 passed |
| `llm-chain.test.ts` | 13 passed |
| `admin-security.test.ts` | 22 passed |
| `content-library-sql.test.mjs` (adds MIG-4, NEWS-1 to NEWS-9) | 74 passed |
| `admin-power-sql.test.mjs` / `admin-sql.test.mjs` | 72 / 53 passed |
| `content-library-race.mjs` / `admin-lockout-race.mjs` (real Postgres) | 4 / 4 passed |
| `admin-http.mjs` / `admin-power-http.mjs` | 27 / 19 passed |
| `content-library-http.mjs` (adds LVAL-11/12, LTHEME-8/9, LFAIL-5, LITEMS-4, LSUG-2) | 43 passed |
| `content-review-http.mjs` | 19 passed |
| `admin-ui.mjs` (adds KBC-UI) | 9 passed |

Local end-to-end top-up (embedded Postgres + PostgREST, real NewsAPI, Bharat and AI): NewsAPI 70
and Bharat 261 headlines; 8 news questions kept and stored with their sources and expiry. A first
run put news before the movie puzzles and starved them (0 puzzles), so news now runs last in time
kept back for it; the rerun kept 28 movie puzzles (done for the week) in 9 s, but no news: locally only Groq (rate-limited by then) and OpenRouter were available, and both failed. Production also has Gemini.
