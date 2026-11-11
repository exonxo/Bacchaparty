# Bacchaparty QA testing report

**Branch tested:** `claude/peaceful-fermi-o078sd` (local commit at QA time)  
**Environment:** Local demo mode (`npm run dev`, no Supabase env) — host + 4 mobile players (393×852) in one Chromium context (BroadcastChannel sync). Spot checks on production **https://bacchaparty.vercel.app/join** (wrong code only; no room spam).  
**Tools:** `scripts/qa-games.mjs`, `scripts/qa-e2e.mjs` (Playwright 1.49).  
**Host OAuth:** Not tested (requires Google sign-in); production host flow not exercised.

## Per-game summary

| Game | Status | What we exercised | Bugs found | Fixed vs recommended |
|------|--------|-------------------|------------|----------------------|
| chor-kaun | **PASS** | Start, round 1 UI, vote section, host “count votes”, end → lobby | None | — |
| housie | **PASS** | Start, host Next number, player ticket, auto-call UI, end; host refresh mid-game resumed | None | — |
| emoji-picture | **PASS** | Start, puzzle + timer, host Reveal, end | None | **Rec:** Classic dark “TV” layout on host phone (see GameStage message) |
| charades | **PASS** | Start with 5 players, team split, end | None | **Rec:** `minPlayers: 2` in catalog vs “4–20, in 2 teams” copy |
| antakshari | **PASS** | Start, team/letter UI, end | None | **Rec:** Speaking game needs video call when “Alag alag jagah” |
| draw-guess | **PASS** | Start, canvas visible on mobile, end | None | **Rec:** Classic mode on phone; touch drawing not stressed in headless |
| kaun-banega-champion | **PASS** | Lobby → hot-seat pick screen; host picks player, end | None | **Rec:** Hot-seat choice is on “big screen” UI squeezed onto host phone |
| raja-mantri | **PARTIAL** | Blocked at **5** players (Max 4). **PASS** with host + 3 bots (4 total): deal roles, in-game UI, end | Low: 5th player silently dropped if start bypassed | **Fixed:** `startGame` enforces min/max (`useHostRoom.ts`) |
| odd-word-out | **PASS** | Start, clue/vote phases visible, end | None | **Rec:** `minPlayers: 3` vs catalog “4–12” |
| ludo-yatra | **PARTIAL** | Blocked at 5 players (Max 4). **PASS** with 4 players: roll turn, end | Same bypass risk as raja | **Fixed:** same `startGame` guard |
| sound-guru | **PASS** | Start, guess input, end | None | Classic phone UI |
| jaldi-bolo | **PASS** | Start, letter grid inputs, end | None | — |

## Shared flows

| Flow | Result | Notes |
|------|--------|-------|
| Home `/` | **PASS** | Mobile 393×852 layout OK |
| `/games` | **PASS** | All 12 games listed |
| Host create → lobby | **PASS** | Demo `/host` auto-creates code |
| QR / invite link | **PASS** | QR sheet renders; join URL includes `?code=` |
| Join wrong code (production) | **PASS** | Alert: `No party with that code. Ask the host to check it.` |
| Join wrong code (demo) | **N/A** | API returns `exists: true` for any code — player stays on “Party dhoondh rahe hain…” **Rec:** dev-only warning on join when demo |
| Player leave | **PASS** | Confirm sheet → home |
| Host remove player | **PASS** | Removed player sees “The host removed you…”; cannot play again in room |
| Player rejoin (voluntary leave) | **PASS** | Same code works |
| Player refresh mid-game | **PASS** | Housie state re-synced |
| Host refresh mid-game | **PASS** | Housie host controls returned (`_hostRefreshMidGame`) |
| Second host device | **PASS** | “This room is open on another device” + takeover CTA |
| Too few / too many players | **PASS** | Start disabled + red copy (e.g. Raja/Ludo max 4) |
| Switch games | **PASS** | End game → pick another from lobby |
| Mobile layout 393×852 | **PASS** | Player join + chor-kaun paper UI |

## Bugs (detail)

### High

_None reproduced in the latest `qa-games` cycle._

### Medium

1. **Host could start games outside player limits if UI were bypassed**  
   - **File:** `src/lib/useHostRoom.ts` (~514–524)  
   - **Repro:** Call `startGame` with 5 players for Raja Mantri/Ludo (slice silently drops 5th).  
   - **Fix applied:** Abort when `players.length` outside `getGameInfo(id)` min/max.

### Low

1. **Join submit could read stale React state for room code**  
   - **File:** `src/app/join/JoinForm.tsx` (~20–39)  
   - **Repro:** Controlled input value out of sync with DOM (e.g. autofill edge cases); submit thinks code length &lt; 4.  
   - **Fix applied:** Read `codeInput.current?.value` on submit via `normalizeCode()`.

## UX issues (recommendations only)

1. **11/12 games** still use classic dark controller on phones; only **Chor Kaun** has the paper redesign (`mod.paper`). Host lobby already warns — consider prioritising paper `Phone` views for emoji, housie, charades.
2. **Kaun Banega Champion** hot-seat picker is built for TV; host on phone sees cramped shared view + “Your controls” empty.
3. **Demo mode** accepts any 4-letter code → players wait forever without a host. Consider a banner on `/join` when `demo: true`.
4. **Catalog vs enforced mins:** odd-word-out (3 vs 4–12), charades (2 vs 4–20 teams) — align copy or limits.
5. **Raja Mantri / Ludo** with 5 in lobby: start correctly blocked; host may need hint to remove one player (only “Max 4 players”).

## What could not be tested

| Item | Why |
|------|-----|
| Production host + Google OAuth | No credentials |
| Supabase Realtime across real devices | Demo-only local run |
| Full game completion (all rounds) | Smoke scope only |
| `/room/<code>/tv` on real TV | Headless only |
| Audio / video / Antakshari singing | Headless |
| Production player joins (beyond wrong-code) | Avoid DB spam |
| Vercel cron / keepalive | Out of scope |

## Screenshots

Under `docs/testing/e2e-run/`:

- `lobby-4-players.png` — host lobby with code + roster  
- `start-chor-kaun-host.png` — paper game UI  
- `blocked-raja-mantri.png` — max-player gate  
- `error-emoji-picture.png` — classic-mode host play  
- `cycle-*.png` — post-game lobby after each cycle  

## Fixes in this PR

1. `useHostRoom.ts` — enforce per-game min/max player counts in `startGame`.  
2. `JoinForm.tsx` — submit uses live room-code input value.  
3. `scripts/qa-games.mjs` / `scripts/qa-e2e.mjs` — repeatable Playwright smoke harness (demo mode).  
4. `playwright` added as devDependency for local QA.
