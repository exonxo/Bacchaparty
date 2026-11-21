# Round 9: content library

New migration: `supabase/migrations/0010_content_library.sql`. **Not applied.**
Run order in the Supabase SQL editor: **0007, 0008, 0009, then 0010**. 0010 can be run twice safely.
The app works before 0010 is applied: the library calls fail quietly and the AI services are asked as before.

## What it does

- Every Chor Kaun topic, Emoji Picture puzzle and dare the AI makes is saved to `content_library`, tagged
  with kind, game, category (puzzle level, dare audience, or `any`), language (`en`) and source
  (`llm:<provider>` from a game, `admin:llm:<provider>` from Generate more). Duplicates are skipped on
  normalised text (lower case, punctuation and extra spaces removed) per kind and language.
- `content_seen` records what each viewer was shown. Viewers are `u:<account id>` (hosts) or
  `a:<anonymous id>` (guests). No email is stored anywhere. Account rows are deleted with the account.
- Serving (`library_pick`): random items this viewer hasn't been shown in the last 30 days, never-shown
  first. Items shown more than 30 days ago are eligible again. A per-viewer lock stops two requests at
  the same moment from getting the same item. An Emoji round needs a full set (the requested count);
  if the library can't fill it, the AI is asked. If the AI then fails, a smaller library set (at least
  3) is used before the review bank and the built-in lists.
- Order in `/api/suggest` for library kinds: rate limit → kill switches → **library** → AI chain (new
  output saved to the library after the response, and marked as shown to this host) → library partial
  (emoji) → approved review bank → built-in content. `next-game` is not a library kind (it depends on
  the party's own state).
- Kill switches: `suggest` off now also stops the library (no AI-made content at all). New `library`
  switch: off stops serving and saving library items; the AI is asked every time.
- Admin panel → **Library** tab: counts per game, kind and category (items, switched on, added in 7
  days, times served, from admin), hosts served in 30 days, **Generate more** (game, batch size: up to
  50 emoji puzzles, 5 topics or 5 dares; at most 5 AI calls per request) and **Download CSV** (up to
  20,000 rows; no account ids; formula-looking cells are defused). Generate more and the export are
  written to the audit log first and refused if it can't be written. `library.set_active` switches one
  item off or on (API only for now; no button yet).
- Browsers have no access: RLS on with no policies, every privilege revoked from `anon` and
  `authenticated` (tables, the id sequence and all functions), functions are `security definer` with a
  fixed `search_path`, executable by `service_role` only.

## Providers

- Groq is first in the chain, read from `GROQ_API_KEY`; model from `GROQ_MODEL`, defaulting to a current
  Groq production model (see `GROQ_DEFAULT_MODEL` in `src/lib/suggest/chain.ts`). In the default
  `rotate` mode each request still starts with a different configured provider; `LLM_MODE=primary`
  makes Groq always go first.
- OpenRouter stays, read from `OPENROUTER_API_KEY` / `OPENROUTER_MODEL`. Its old default model was
  withdrawn by OpenRouter, so the default changed (see `OPENROUTER_DEFAULT_MODEL`).
- Missing keys: the provider is skipped. No keys at all: library, then review bank, then built-in content.

## Test results (local)

| Suite | Result |
| --- | --- |
| `npx eslint`, `npx tsc --noEmit`, `next build` | pass |
| `content-library-sql.test.mjs` (0004 to 0010, PGlite) | 55 of 55 |
| `content-library-race.mjs` (0010, real local Postgres) | 4 of 4 |
| `content-library.test.ts` (app helpers) | 11 of 11 |
| `content-library-http.mjs` (local server, throwaway admin settings, no database) | 24 of 24 |
| `admin-ui.mjs` (local, now with a Library tab check) | 6 of 6 |
| `admin-sql.test.mjs` / `admin-power-sql.test.mjs` | 53 of 53 / 72 of 72 |
| `admin-lockout-race.mjs` (real local Postgres) | 4 of 4 |
| `admin-security.test.ts` / `llm-chain.test.ts` | 22 of 22 / 13 of 13 |
| `admin-http.mjs` / `admin-power-http.mjs` (local) | 27 of 27 / 18 of 18 |

Checked by mutation: removing the revoke on `library_pick` fails 3 SQL checks; shortening the 30-day
window fails 2; removing the per-viewer lock makes 20 parallel picks return 17 distinct items.

## Not verified

- Nothing is live. 0010 is not applied and this branch is not deployed.
- Library reads and writes **through Supabase** (PostgREST `rpc`, the service-role client, `after()` on
  Vercel). The HTTP suites run with no database; the SQL runs in PGlite and a local Postgres.
- Generate more end to end (AI call → saved rows → counts) and the CSV download with real rows.
- Supabase's real default grants (simulated in the harness).
- `library_norm` uses `[:alnum:]`; how it treats non-English letters depends on the database locale.
  All content is English today.
- Guests: the schema and functions support anonymous viewer ids, but only signed-in hosts call
  `/api/suggest` today, so in practice the seen log is per host account.
