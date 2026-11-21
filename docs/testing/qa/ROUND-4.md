# Round 4 — multi-LLM fallback chain, anti-repeat, hidden admin panel

Status column: **planned** → **pass** / **fail** / **not verified (why)**. Filled in after the build and test run.

## A. LLM provider chain (Chor Kaun topics, Emoji puzzles)

| ID | Case | Expected |
|---|---|---|
| LLM-1 | Provider order | Gemini → Groq → OpenRouter (free models) → Cloudflare Workers AI → built-in list. A provider with no key set is skipped. |
| LLM-2 | Rate limit on one provider | A 429 from a provider moves to the next one in the same request, and the failed provider is skipped for 60 s. |
| LLM-3 | Server error / timeout | The next provider is used; the failed one is skipped for 20 s. |
| LLM-4 | Malformed output | Non-JSON or JSON that fails validation counts as a failure and moves on. |
| LLM-5 | All providers fail | Built-in content is returned with `fallback: true`. The request never errors. |
| LLM-6 | Rotation | With `LLM_MODE=rotate` (default), consecutive requests start on different healthy providers. With `LLM_MODE=primary`, Gemini is always tried first. |
| LLM-7 | Total time budget | One request finishes within about 8 s, even if every provider is slow. |
| LLM-8 | Keys stay on the server | No API key appears in any HTTP response or in the client bundle. |
| LLM-9 | Anti-repeat memory | The client sends the last 40 items it was shown (topic labels / puzzle answers). The server includes them in the prompt and drops any model answer that repeats one. |
| LLM-10 | Variety | Each request gets a random theme from a server-side list, so two requests with the same input get different prompts. |
| LLM-11 | Safety unchanged | Model output still passes the existing validators (length, safety words, categories). Unsafe items are dropped. |
| LLM-12 | Observability | Every suggestion writes an `app_events` row with provider, fallback flag and latency. |

## B. Hidden admin panel

| ID | Case | Expected |
|---|---|---|
| ADM-1 | Direct `/admin-internal` (with or without session) | 404 page. |
| ADM-2 | `/admin`, `/login-admin`, random paths | Normal 404. Nothing admin-like in the response. |
| ADM-3 | `ADMIN_PATH` not set | Admin disabled: the secret path is a 404 too. |
| ADM-4 | `ADMIN_PATH` shorter than 24 characters | Admin disabled, with a server log warning. |
| ADM-5 | Secret path | Login form. The path appears in no link, sitemap or client bundle. |
| ADM-6 | Wrong password, or unknown username | Same generic message for both. No username hint. |
| ADM-7 | 5 failed logins from one IP | Locked for 15 min. Correct password is refused during the lock. |
| ADM-8 | Correct username, password and TOTP code | Session cookie: `HttpOnly`, `Secure` (on https), `SameSite=Strict`, path = secret path, 2 h lifetime. |
| ADM-9 | Tampered, expired or missing cookie | Data endpoints return 401. The page shows the login form. |
| ADM-10 | POST from another origin or without JSON type | 403. |
| ADM-11 | Data endpoints | `Cache-Control: no-store`, `X-Robots-Tag: noindex`. Data only with a valid session. |
| ADM-12 | Service-role key | Never in a response or the client bundle (grep of `.next/static`). |
| ADM-13 | Audit log | Every login attempt (ok / reason / IP / time) is stored. The password is never stored. |
| ADM-14 | Logout | Cookie cleared. A copied token still works until it expires (stateless; documented). |
| ADM-15 | TOTP | RFC 6238 test vector gives the expected code; a code from ±1 step is accepted, others refused. |

## C. Admin data correctness

| ID | Case | Expected |
|---|---|---|
| DATA-1 | User count | Equals the number of rows in `auth.users`. |
| DATA-2 | Signups per day | Counts by `created_at` in UTC, matches the table. |
| DATA-3 | Games started | One `game_started` event per host start (not per tap, not from lobby). |
| DATA-4 | Suggestion stats | Fallback rate and provider split match the `app_events` rows. |
| DATA-5 | Track endpoint | Unknown game id → 400. Caller who doesn't own the room → 403. |

## D. Regression

| ID | Case | Expected |
|---|---|---|
| REG-1 | `tsc`, eslint, `next build` | Pass. |
| REG-2 | Chor Kaun and Emoji start normally with no LLM keys (built-in content) | Pass. |
| REG-3 | Public pages still return 200 and the layout sweep (tests/audit) still passes | Pass. |

## Results (filled after the run)

Runs: `npx -y tsx docs/testing/qa/llm-chain.test.ts`, `npx -y tsx docs/testing/qa/admin-security.test.ts`, `BASE=… node docs/testing/qa/admin-http.mjs` and `node docs/testing/qa/admin-ui.mjs` against a dev server started with throwaway admin settings, the production build with the bundle scan, and the layout sweep (`/tmp/claude-0/audit/audit.js 390`).

| ID | Status | Note |
|---|---|---|
| LLM-1, 2, 3, 4, 5, 6a, 6b, 7, 9, 9b, 10, 11 | pass | `llm-chain.test.ts`, 12 checks |
| LLM-8 | pass (by build scan) | No key value in the client bundle. Responses only carry validated suggestion data. |
| LLM-12 | not verified | Needs the Supabase tables; code path is in `src/app/api/suggest/route.ts` (`logEvent`). |
| LLM (live providers) | not verified | No provider keys in this environment. Each provider's adapter is code-reviewed only. |
| ADM-1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15 | pass | `admin-http.mjs` 26 checks, `admin-security.test.ts` 14 checks, `admin-ui.mjs` 5 steps |
| ADM-12 | pass | Build with admin values set: no secret value, no `SUPABASE_SERVICE_ROLE_KEY` in client chunks. |
| ADM-13 | not verified | Writes to `admin_login_log` need the Supabase tables. |
| DATA-1..5 | not verified | Needs the migration applied and real data. The SQL functions are in `supabase/migrations/0004_admin_and_events.sql`. |
| REG-1 | pass | `tsc`, eslint, `next build` (25 static pages + admin routes). |
| REG-2 | pass (by sweep) | Chor Kaun and Emoji start with the built-in content. |
| REG-3 | pass | Public pages 200, `/admin-internal` 404, layout sweep: no new issues. |
