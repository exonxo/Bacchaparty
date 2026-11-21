# Content review: uuid ids

**Bug.** `content.review` turned the id into a number and refused anything that wasn't a positive whole
number, but `content_items.id` is a `uuid` (0001_init.sql, `gen_random_uuid()`; confirmed on the live
project's schema, read-only). The panel sends the uuid it read from the queue, so every approve and
reject came back `400 bad_id`. A whole-number id got past the check and failed at the database instead.

**Fix.** The id must be a uuid string (any case; stored lower case). Anything else is `400 bad_id` before
anything is audited or read. The panel's type now says the id is a string. No SQL change: no database
function takes a content id, and the route updates the table directly with the service role. No migration.

**Tests (local, throwaway admin settings).**

| Suite | Result |
| --- | --- |
| `content-review-http.mjs` (new; local server pointed at a stand-in for Supabase's REST API) | 19 of 19 |
| same suite against the code before the fix | 7 of 19 (12 fail: approve, reject, unknown id, whole-number ids) |
| `admin-power-http.mjs` (now checks a whole-number id is `bad_id`, and a uuid reaches the audit step) | 19 of 19 |
| `admin-http.mjs` / `admin-ui.mjs` | 27 of 27 / 5 of 5 |
| `admin-security.test.ts` / `llm-chain.test.ts` | 22 of 22 / 13 of 13 |
| eslint, tsc, `next build` | pass |

**Not verified.** Against real Supabase (the stand-in imitates only the calls these routes make), and
approving from the panel UI by clicking (the route was tested directly).
