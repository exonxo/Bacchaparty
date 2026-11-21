# Bacchaparty — memory log

Last updated: 14 Nov 2026 (session 707ce999-bb27-5d0b-80b4-cc48d1e659ab)
Working branch: `claude/peaceful-fermi-o078sd` (merges go to `main` via draft-then-merge PRs)
Repo: `exonxo/Bacchaparty` · Live: `bacchaparty.vercel.app` (Vercel deploys `main`)

---

## 1. Who the user is and how to talk to them

- Owner/product lead. Writes in Hinglish ("go more", "Khel khatam", "Teri baari"). Uses phones (iPhone Safari) for testing, not just desktop.
- Standing instruction: act as an **advisor, not an assistant**.
  1. First sentence challenges an assumption or asks a gap-exposing question. Never open by agreeing.
  2. Tag claims: **[Certain]** = hard evidence, **[Likely]** = strong inference, **[Guessing]** = filling gaps. If most of a reply is guessing, say so first.
  3. Banned phrases: "Great question", "You're absolutely right", "That makes a lot of sense", "Absolutely", "Definitely".
  4. When disagreeing: "I disagree because… Here's what I'd do instead… The risk in your approach is…"
  5. Uncomfortable truth first. 6. No warm-up paragraphs. 7. Don't fold under pushback without new information.
- Pronouns: use they/them unless stated.
- Don't commit/push unless asked (the user's standing request has been "push" each time, so pushing feature-branch work after tests is expected). Never force-push. Always end PRs with the Claude Code footer; commits with the Co-Authored-By + Claude-Session lines.
- Confirm before anything outward-facing that isn't already authorised (merging PRs has been authorised case by case: "Merge pr", "Yes" to merge #11).

## 2. Product: Bacchaparty

Indian family party-games web app. Next.js 15 (App Router), Tailwind v4, Supabase (realtime broadcast + DB), Vercel, Google login for the **host only**. Players join with a 4-letter room code on their phones; a TV view is optional (`/room/CODE/tv`).

Core architecture (see README and `src/lib/`):
- `useHostRoom.ts` — the host phone is authoritative. Signs ECDSA room snapshots; sends encrypted private views (ECDH + AES-GCM). `usePlayerRoom.ts` on phones. Protocol version is checked.
- Presence: a player counts as **connected** only while their id is in realtime presence (or joined <6s ago). Offline players are greyed in the lobby and excluded from game start.
- Test mode (profile menu toggle, saved in `localStorage` key `bacchaparty-testmode`): 3 bots (Bunty, Pinky, Golu) live in host state only.
- Saved host state: `localStorage` key `bacchaparty-host-CODE`. To hand-edit it, navigate away first (page saves on pagehide), edit, then return.
- Games are modules in `src/games/<id>/` with `index.tsx` (reduce/publicView/privateView/tick), `PaperPhone.tsx`, `TvScreen.tsx`, `bot.ts`. Registered in `src/games/catalog.ts` (copy, rules text, sizes) and `src/games/modules.ts`.
- Design system: "Chit & Envelope" paper look. Tokens on `:root` (`--bg #fbf6ee`, `--ink #1e1a17`, turmeric, vermilion, leaf). Classes: `text-p-note/body/lead/title/show`, `cut`, `rounded-cut`, `.cut` hard shadows. Components: `PaperSheet`, `PaperButton`, `Sticker`, `ResultsCard`, `RoomShell`, `TestBanner`.
- Audio: `src/lib/roomAudio.tsx` `useSfx()` — `shared()` plays on one device per room (TV if present, else host phone when together-mode), `mine()` plays on this device only. `src/lib/sfx.ts` has synthesized sounds plus file-backed ones (`FILES` map → `/public/sfx/*.mp3`).
- Results: `src/lib/results.ts` `summarizeGame` builds the "Khel khatam" scorecard; `lastResult` is in the room snapshot.
- End-of-game detection: `src/lib/gameOver.ts` `isGameOver(gameId, view)`.
- Rematch/finish: room actions `REMATCH_ACTION` (`__rematch`) and `FINISH_ACTION` (`__finish`) in `src/lib/room.ts`; snapshot field `rematch: string[]`; host keeps `gameOptions` for replays.

Games (13): Chor Kaun, Housie (Tambola), Emoji Picture, Dumb Charades, Antakshari Battle, Sound Guru, Draw & Guess, Kaun Banega Champion (KBC), Raja Mantri Chor Sipahi, Odd Word Out, Ludo Yatra, Jaldi Bolo, **Puno** (own card game, the newest).

Games that show the end-of-game bar (Rematch vote + Lobby): Puno, Ludo, Housie, Emoji Picture, Draw & Guess, Sound Guru, KBC, Jaldi Bolo. Games that never "finish" (use the header to end them): Chor Kaun, Charades, Antakshari, Raja Mantri, Odd Word Out.

## 3. Puno (the game we spent most time on)

Files: `src/games/puno/` — `rules.ts` (pure reducers), `shared.ts` (types, `TURN_MS = 20_000`, `DEAL_MS = 3_600`), `PaperPhone.tsx` (hand, drag, pile, action row), `Cards.tsx` (card art: suit patterns, action art, paper overlay), `TvScreen.tsx`, `DealIntro.tsx` (shuffle-and-deal opening), `CardFlight.tsx`, `bot.ts`, `index.tsx`.

Rules (current): colours Haldi/Sindoor/Mehndi/Neel; numbers 0–9 (2 each of 1–9); actions Ruk Ja (skip), Ulta (reverse; with 2 players it skips), Do Le (+2 stack); wilds Rang Badal (choose colour), Chaar Le (+4 stack, colour), **Rishtedaar** (new: 2 in deck; choose colour, swap whole hand with the player opposite; can't go on a stack; winning with it as last card = no swap). Jump-in: an exact identical card out of turn. Ek Bacha: call at 1 card; Pakdo catches and draws 2. Deal: 7 each, flip first non-wild non-penalty card.

Interaction (current):
- Tap a card to lift; tap again or "Phenko" to play.
- **Drag** a playable card up and drop on the pile (pile outlines and says "Yahan chhodo"); flick also plays; drop elsewhere slides back.
- Sideways swipe scrolls the hand. Unplayable card shakes with a reason.
- Playable cards lift on your move; others fade.
- Wilds dropped by drag always send after colour pick.

Visuals (current): suit patterns (marigold / bindi / leaf / peacock eye) plus corner marks; action art (raised palm, rickshaw U-turn, two chits, four laddoos, two relatives swapping); paper grain and a fold line; pile keeps last 8 cards scattered; slap + thud + dust on each new card. TV shows "Seedha/Ulta" label and a "Badle!" badge for swaps.

Opening: when a game starts or rematches, a 3.6 s shuffle-and-deal plays on phones and TV (sounds: Kenney Casino Audio CC0 — `card-shuffle` trimmed to 1.65 s and `card-slide-1` as `card-deal`, MP3 in `public/sfx/`, credit in `public/sfx/CREDITS.txt`). Moves are ignored during the deal; first turn clock starts after it. Late joiners skip it.

Name: "Puno" is still unresolved. It sits close to a well-known branded card game. Old art copied that game's trade dress and was replaced (F8 finding). **Open product decision: rename before launch.**

Test docs: `docs/testing/puno-test-cases.md` (findings F1–F8, cases 1–37, results tables).

## 4. Timeline of what was shipped (PRs merged to main)

| PR | Title (short) | Notes |
|---|---|---|
| #10 | Puno added by another agent | Merged earlier this round |
| #11 | Puno phone gestures, Ek Bacha fix, original card look, last 4 TV views paper | Tested at 390×844, 360×740 with real touch events |
| #12 | Test-mode banner squashing the host lobby | Room shell children were a flex row; now stacked |
| #13 | Popups on phones; trim host lobby | Global `body > * {position:relative}` was unlayered and beat Tailwind `fixed`; moved into `@layer base`. Removed Ek hi room/Alag alag switch, "What next?" and "Dare/prompt" cards from lobby. Deleted `src/components/suggest/HostSuggestCards.tsx` |
| #14 | Puno drag to pile, suit patterns, new art, Rishtedaar | Rishtedaar rules: 38 scripted checks passed (2–5 players) |
| #15 | "Kaise khelein" looks tappable | Chevron + "N steps" while closed |
| #16 | Rematch vote + Lobby button; stop endless confetti | Confetti refired every tick (Puno result id used ticking clock). Test-mode reload ended games (fixed: wait for saved setting) |
| #17 | Puno shuffle-and-deal opening with Kenney sounds | Tested: overlay shows, deck tap ignored during deal, clock starts full, files load (200) |

Pending, not yet committed (working tree): `src/app/room/[code]/host/HostScreen.tsx` — start-warning now names away players ("N online, X away — unka phone wapas kholne do…") instead of only "Needs at least 3 players". Typecheck and lint pass; not yet tested in a browser and not committed.

## 5. Open investigation (current)

**Symptom (user, 14 Nov):** 3 people in the room, but Chor Kaun says "Shuru karo · 2 players" and "Needs at least 3 players".
- **Diagnosis so far:** [Certain] the host counts only players whose realtime presence is live (`useHostRoom.ts` presence handler; `online = players.filter(connected)`). [Certain] A clean 3-phone test in our browser (host + 2 phones, no bots) shows "3 players" and starts. So the code path works; the difference is a phone whose presence dropped.
- [Likely] Cause on device: a phone's tab was backgrounded or locked (iOS suspends websockets), or the connection blipped. It's greyed out in the lobby, which the user may have missed.
- **Not yet done:** confirm which phone is away (ask the user to look for a greyed-out name in the lobby list), and decide whether a game should start with away players left out (current behaviour) or wait for them.
- Also consider: when a phone returns, it re-tracks presence on SUBSCRIBED (`transport.ts`), so it should recover once foregrounded; verify with the user.

## 6. Environment and tooling facts

- Dev server: `npx next dev -p 3000` (kill before `next build`; `rm -rf .next` if the build output is corrupted).
- Build check: `npx tsc --noEmit && npx eslint src && npx next build` (expect 25 static pages).
- Browser tests: Playwright from `require('playwright')`, Chromium at `/opt/pw-browsers/`. Use `isMobile`/`hasTouch`, CDP `Input.dispatchTouchEvent` for swipes, `tap({force:true})` on animating elements. Pass `--trace off` if using the test runner.
- Test helpers (outside repo, in `/tmp/claude-0/`): `puno/lib.js` (`setup({w,h,bots,players})`, `startGame(host, tile)`, `touchSwipe`), `audit/audit.js <width>` (UI sweep: overflow, text <11px, tap targets, popups, covered buttons, script errors), `audit/drag.js`, `audit/rematch.js`, `audit/deal.js`, `audit/three.js`, `rt/r.ts` (Rishtedaar rules, run with `npx -y tsx`). These are in `/tmp`, which can be cleared, so re-create if needed.
- Git: branch `claude/peaceful-fermi-o078sd`. After a merge, fast-forward: `git fetch origin main && git merge --ff-only origin/main && git push origin claude/peaceful-fermi-o078sd`. Vercel status: `curl https://api.github.com/repos/exonxo/Bacchaparty/commits/<sha>/status`.
- GitHub via MCP tools (`mcp__github__create_pull_request`, `merge_pull_request`). GitHub search goes via `gh api`. Repo access limited to `exonxo/bacchaparty`.
- **Network:** `kenney.nl` and `vercel.app` are blocked from this container. The user supplied the Kenney zip as an upload instead.
- Model in this session switched to `claude-haiku-5-5` via `/model`.

## 7. Decisions made (and why)

- **Rishtedaar opposite-player rule:** start with "opposite" rather than player-picks-target, which needs a picker screen. Revisit if families find it unfair.
- **Sounds:** shared room sounds play on one device (TV or host phone) to avoid a room of phones all shuffling. The user was told this and asked to confirm on their phone.
- **Kaise khelein kept:** the one-paragraph description doesn't cover stacking, Ek Bacha, Pakdo or Rishtedaar.
- **Lobby room-mode switch removed:** rooms now always use the same-room sound behaviour. The user was told the side effect for families in separate homes.
- **Rematch:** a vote, not a host action. Bots count as yes. Lobby needs no confirmation (scorecard stays in the lobby, so nothing is lost).
- **Confetti:** fires once per result id.

## 8. Known gaps and risks (be honest about these)

- **Not tested on real iPhone/Android:** swipe/drag feel, sound output (the test browser has no speakers), reduced-motion on the pile.
- **Puno name:** legal/brand risk. Unresolved.
- **Presence:** an away phone silently drops out of game start (current investigation).
- **Games without an ending** have no rematch; the header "Lobby" button remains the only exit.
- **Ludo/Raja Mantri** were not started in the full sweep (room player limits). Not verified end-to-end after the latest changes.
- **iOS Safari address-bar strip** in the sheet: an uncovered cream strip under the toolbar, the same colour as the sheet. Page code can't reliably cover it.
- **Chor Kaun topic picker** is long in a sheet (not inspected this round).

## 9. Next steps (in order)

1. Finish the away-player investigation: ask the user which phone is greyed out, and decide whether to start with away players excluded or wait for them.
2. Test the pending start-warning change in the browser (away player case), then commit and open a draft PR, then merge if the user approves.
3. Ask the user to listen to the shuffle and deal on a phone and the TV.
4. Ask the user to decide the Puno name before any launch.
5. Consider committing this memory log to a branch so it survives the ephemeral container.
