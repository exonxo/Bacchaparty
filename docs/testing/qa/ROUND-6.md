# Round 6: power admin (items 1 to 8)

Migrations: `supabase/migrations/0007_power_admin.sql`, then `supabase/migrations/0008_review_followups.sql` (round 7 follow-ups). NEITHER is applied yet. Review both, then run them in order in the Supabase SQL editor after 0006. (Round 6 of the migration history already used the name 0006 for the lasting room counts, so this one is 0007.)

## What was built

| # | Feature | Where |
|---|---|---|
| 1 | Audit log. Every admin action and every read of personal data is written first. A failed write stops the action (fail closed). Kept 365 days. | `admin_audit` table, `src/lib/admin/audit.ts`, the audit tab |
| 2 | Feature flags / kill switches: per game, per AI provider, and an all-AI switch. The host screen hides switched-off games. Changes apply within 30 seconds. | `feature_flags` table, `src/lib/admin/flags.ts`, `/api/flags`, the switches tab |
| 3 | Content review queue. The owner generates puzzles with the AI, then approves, edits or rejects each one. Only approved items are served, and only as a fallback. | `content_items` (review columns), `src/lib/admin/bank.ts`, the content tab |
| 4 | Account management: look up by email, export as JSON, disable and re-enable, delete. Disable and delete need a fresh authenticator code. Delete needs the export ticked and the email typed. | `src/lib/admin/actions.ts`, the account panel |
| 5 | Room inspector (read-only): room code → host, created and closed times. Live game state is not stored, and the panel says so. Every lookup is audited. | the room tab |
| 6 | Funnel: signed up → created a room → came back more than 7 days after signing up, plus weekly cohorts. It stops at room creation because game starts are not linked to accounts. | `admin_funnel()`, the funnel tab |
| 7 | Health: last nightly purge (from the new `cron_runs` log), AI calls, fallbacks and route errors in the last hour. | `admin_health()`, `api_error` events, the health tab |
| 8 | Quota meter: successful calls per provider today, with a bar when a daily limit is set in `QUOTA_<NAME>_DAILY`. | `admin_quota_today()`, the LLM tab |

Also changed: the suggestion route honours the switches, uses approved content before the built-in lists, and logs failures as `api_error`. The purge route records each run. The privacy page describes the audit log, lookups and exports.

## Design choices to review

- **Fail closed.** If the audit log can't be written, writes and sensitive reads are refused. The panel shows an error, not the data.
- **Validate before auditing.** A malformed room code or email is refused before it is written to the log.
- **Step-up on destructive actions only.** Disable and delete need a fresh code. Switches and content review do not, to keep everyday work fast.
- **Kill switches fail safe.** If the database can't be reached, the last known switch state is kept. A switch that was turned off stays off.
- **Limits are not guessed.** The quota meter shows counts from this app. Each provider's real limit must come from its own dashboard.

## Tests

| Check | Result |
|---|---|
| `admin-power-sql.test.mjs` (migrations 0004 to 0008 in an in-process Postgres, plus TRUNCATE and app_events privilege checks for 0008) | 49 of 49 pass |
| `llm-chain.test.ts` (adds LLM-13: a switched-off provider is never called) | 13 of 13 pass |
| `admin-power-http.mjs` (session and origin gates, step-up, fail-closed writes, validation, headers, public flags) | 18 of 18 pass, local server |
| `admin-http.mjs` (existing hidden-panel checks) | 26 of 26 pass, local server |
| `admin-ui.mjs` (browser sign-in) | 5 of 5 pass, local server |
| `admin-security.test.ts` (password hash, token, lockout, config) | 16 of 16 pass |
| `npm run lint`, `tsc`, `next build` | pass |

The local runs used a throwaway admin configuration generated for the run. Nothing was run against the live site.

Notes from the test run, all fixed in the tests (not the product): the SQL harness ran several seed statements in one call and silently dropped some, so each now runs on its own; the funnel expectation was wrong (3 accounts come back after 7 days, not 27); and one access check called the destructive purge before the retention checks. The migration check now reports each file, instead of always passing.

## Round 7: review follow-ups

- **0008 (database).** Removes TRUNCATE from `anon` and `authenticated` on every public table. Supabase grants it by default and row-level security does not cover it. Removes all privileges on the admin and event tables from those roles. `content_items` is read-only for them. The account list gets a tie-break on `id`, so pages can't repeat or skip accounts with the same sign-up time.
- **Password hash.** A truncated hash is refused both at sign-in and at startup. Startup logs the problem without the value.
- **Middleware.** Encoded admin paths no longer get past the not-found rewrite.
- **Logging.** Route logging runs after the response (`after()`), not unawaited. The track route checks the rate limit before the room lookup.
- **Keepalive.** Refuses to run when `CRON_SECRET` is missing.
- **Lockout.** Memory for failed attempts is bounded.
- **Live room presence.** The host's presence id uses a hash of the user id, not the raw id.
- **Setup script.** `scripts/admin-setup.mjs password --stdin` keeps the password off the command line.
- **Cleanup.** Unused starter images removed.

## Known and not fixed

- The live room channel (`room:CODE`) is public. Snapshots are signed, not encrypted. Fixing this needs private channels with a database access design, so it is a larger change.
- Logout does not revoke the session token. The token lasts up to 2 hours. A revocation timestamp in the database would fix it.
- The sign-in lockout check and the failure record are not atomic (low risk).
- The track route still loads the user before the rate limit check.
- The `admin_login` event kind is defined but never written.
- Some SQL checks are weak: the cap test uses 30 accounts, and some per-game checks are not isolated.
- The layout sweep script lives outside the repo, so its check can't be reproduced from here.

## Not verified here

- Nothing is live. The migration is not applied, the panel is not deployed with these changes, and no provider key was used for generation.
- Real database behaviour of the new functions (the SQL test uses a simulated Supabase).
- Whether a banned (disabled) account is actually refused at sign-in by Supabase. This depends on Supabase's `ban_duration` behaviour and needs one manual check with a test account.
- The switches' 30-second delay, and the quota figures against real provider limits.

## Before merging

1. Review `0007_power_admin.sql` and `0008_review_followups.sql`, then run them in order in the Supabase SQL editor.
2. Optional: set `QUOTA_GEMINI_DAILY`, `QUOTA_GROQ_DAILY`, `QUOTA_OPENROUTER_DAILY`, `QUOTA_CLOUDFLARE_DAILY` in Vercel, using each provider's own limit.
3. Check one disabled account against the sign-in flow with a throwaway account.
