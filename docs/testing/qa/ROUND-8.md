# Round 8: the seven known issues from round 7

New migration: `supabase/migrations/0009_session_revocation_and_atomic_lockout.sql`. **Not applied.**
Run order in the Supabase SQL editor, after 0006: **0007, then 0008, then 0009**. 0009 can be run twice safely.
The app works before 0009 is applied (see items 2 and 3 for what is weaker until then).

## Decisions

| # | Issue | Decision | What changed |
| --- | --- | --- | --- |
| 1 | Room channel `room:CODE` is public | **Design only, not built** | `docs/realtime-private-channel.md`: who can do what today, Supabase private channels (needs two dashboard settings and anonymous sign-ins, and still admits anyone with the code), and the recommended first step, encrypting the snapshot with a room key. It touches every game screen, so it belongs in its own PR. |
| 2 | Logout does not revoke the 2-hour token | **Fixed** | Each session token carries a random id (`sid`). Logout stores it in `admin_revoked_sessions` (0009) and in memory; every admin request checks it. Tokens without an id (issued before this change) are refused, so the owner signs in once after deploy. If the database can't be asked, the session is refused; only a missing table (0009 not run yet) falls back to this server instance's memory. |
| 3 | Lockout check and failure record not atomic | **Fixed** | `admin_login_begin` (0009) takes a per-IP advisory lock, counts, and records the attempt as a pending failure in one transaction; `admin_login_finish` sets the outcome. In memory, the check and reservation happen in the same synchronous step. An attempt that dies mid-way stays a failure. Malformed JSON now counts as a failed attempt. Until 0009 runs, the old two-step check is used against the database. |
| 4 | Track route calls `getUser` before the rate limit | **Fixed** | A per-IP limit (12 a minute per instance, the proxy-appended IP) runs before `getUser`. The per-user limit stays before the room lookup. |
| 5 | `admin_login` event kind never written | **Fixed (written)** | The login route writes `admin_login` with the outcome only (`ok`, `reason`: ok, bad_credentials, bad_totp, locked). No IP, username or password. `admin_login_log` keeps the per-IP detail for 90 days; the events are kept 180 days. |
| 6 | Weak SQL checks | **Fixed** | See below. |
| 7 | Layout sweep script outside the repo | **Re-created in the repo** | `docs/testing/qa/layout-sweep.mjs`. The original (`/tmp/claude-0/audit/audit.js`) is gone, so this is a re-creation of the same six checks, not the same file. |

## Stronger SQL checks (item 6)

Both SQL harnesses now simulate Supabase's default privileges (every new table, sequence and function in
`public` granted to `anon`, `authenticated` and `service_role`), so a missing revoke fails a test.

- Cap test: 259 accounts in `admin-sql`, 260 in `admin-power-sql`. Page size is exactly 200, the second page holds the rest, no repeats.
- Paging with 230 accounts that share one sign-up time: no repeats, no gaps (tests 0008's tie-break).
- Generic privilege checks: no admin table (7 of them) grants any privilege to `anon`/`authenticated`; no public table is truncatable by them; no `admin_*` function (or `purge_old_data`, `bump_host_room_count`) is executable by them. Checked by mutation: removing a revoke makes these fail.
- Exact values instead of "is a number" or "is not an error": empty LLM stats (inside a rolled-back transaction), per-game 30-day and 7-day counts, the 14-day per-day window, funnel cohorts adding up to the totals, the last purge run, the email lookup returning the right id, retention removing exactly the old rows.
- Constraint checks match the constraint's own error, so an unrelated failure can't pass them.
- The trigger function check now requires "permission denied", not just any error.
- New 0009 checks: lockout reservations, refusal, success frees a slot, finish runs once, the window, role access, revoked-session storage.
- `admin-lockout-race.mjs` (new, needs a real local Postgres): 20 parallel connections, one IP. The old two-step check let 20 through; `admin_login_begin` lets exactly 5.

## Test results (local, round 8)

| Suite | Result |
| --- | --- |
| `npx eslint`, `npx tsc --noEmit`, `next build` | pass |
| `admin-sql.test.mjs` (0004 to 0006, PGlite) | 53 of 53 |
| `admin-power-sql.test.mjs` (0004 to 0009, PGlite) | 72 of 72 |
| `admin-lockout-race.mjs` (0004 and 0009, real Postgres 18, local) | 4 of 4 |
| `admin-security.test.ts` | 22 of 22 |
| `admin-http.mjs` (local server, throwaway admin settings) | 27 of 27 (new: a replayed logged-out cookie is refused) |
| `admin-power-http.mjs` (local) | 18 of 18 |
| `admin-ui.mjs` (local) | 5 of 5 |
| `llm-chain.test.ts` | 13 of 13 |
| `layout-sweep.mjs` at 390, 360 and 1400 px (8 public pages) | 0 issues. Checked against a planted bad page: all six checks fire. |

## Not verified

- Nothing is live. 0007, 0008 and 0009 are not applied, and this branch is not deployed to production.
- Revocation and the atomic lockout **through Supabase** (PostgREST `rpc` and table calls). The HTTP suites run without a database, so they test the in-memory paths. The SQL runs in PGlite and a local Postgres, not Supabase.
- Supabase's real default grants. The harness simulates them; the generic checks should be run once against the real project after 0009.
- Whether a disabled account is refused at sign-in (unchanged from round 7).
- The layout sweep covers public pages only, not signed-in host screens or games in play.
