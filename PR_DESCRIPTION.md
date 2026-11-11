# Bacchaparty — handoff for continuing development

Context for assistants working on `exonxo/Bacchaparty` after the cloud-agent branch `cursor/fix-host-refresh-takeover-b151` (host refresh, responsive shell, loaders). Preserve these decisions unless the product owner asks to change them.

## Branch / PR status

- **This work:** `cursor/fix-host-refresh-takeover-b151` (not merged at time of writing).
- **Separate open PR:** [#2 “Paper redesign: Housie and Emoji Picture”](https://github.com/exonxo/Bacchaparty/pull/2) — touches `src/games/housie/*` and `src/games/emoji-picture/*` only. Low conflict with host/room/loaders work. If you merge PR #2 first, rebase this branch; game `PaperPhone` files and `index.tsx` splits may need a quick conflict resolve. TV view for those games may still be dark-themed per PR #2 notes.

---

## Chor Kaun topic packs

- Topics live under **`src/content/chor-kaun/`**, **one file per topic**.
- **10 Indian topics:** Places, Street food, Bollywood movies, Bollywood stars, Festivals, Desi kitchen, Shaadi, Jobs around you, Indian brands, TV serials.
- **Default “All topics”** picks a **random topic each round**.
- The **chor gets a different word** from the **same topic** as everyone else (not the same word).

---

## End party flow

1. Host taps **door icon** in room header → confirm sheet.
2. **`POST /api/rooms/[code]/close`** (signed-in host).
3. Host sets room phase **`closed`** in realtime state; players see **party ended** / cannot rejoin with that code.
4. **Supabase:** `supabase/migrations/0003_close_room.sql` — `close_room` RPC and `room_is_ended`. **Already applied in production. Do not edit 0001–0003**; add `0004_*.sql` only if needed.

---

## Host refresh fix (critical)

**Bug:** Reloading `/room/[code]/host` showed “another device” / takeover.

**Cause:** Host contention used **random tab id** in presence (`host:${tabId}`). After refresh, **stale Supabase presence** from the same browser looked like a different host.

**Fix (in `src/lib/useHostRoom.ts`):**

- Identify host by **`rooms.host_id` / auth user id**, not tab or socket.
- Presence id: `host:${authUserId}:${tabId}` (demo: stable `demoHostOwnerId()` in localStorage).
- **Same user, different tab:** block only if the other tab is **actively broadcasting** `room` events (live second tab), not stale presence alone after reload.
- Server passes `ownerAuthId` from `host/page.tsx`.

**Tests:** `scripts/host-presence-unit.mjs`, `scripts/host-refresh-e2e.mjs`.

---

## Responsive UI & header (no manual layout switch)

- **Breakpoints (automatic):** mobile &lt;640, tablet 640–1023, desktop ≥1024, large ≥1440 (Tailwind `sm`/`md`/`lg`/`xl`/`min-[1440px]`).
- **`RoomShell`:** `width="wide"` → `max-w-6xl` (lobby, join); `width="cozy"` → capped width in-game.
- **Host lobby (desktop):** left column invite + players + together toggle; right column games grid (4–6 cols via `GameTable`).
- **“Ek hi room mein / Alag alag jagah”** is **game audio mode**, not a viewport layout switch — keep it.
- **TV mode:** header **TV** button → **`/room/[code]/tv`** (existing `TvScreen`, read-only big screen).
- **Profile dropdown** (`ProfileMenu` in header): **Edit name** (live via `saveIdentity` + host `upsertPlayer`), **account email + Sign out** when signed in; guests get Edit name only.
- Removed lobby “copy big-screen link” in favour of header TV button.

---

## Five loaders (`src/components/loaders/`)

| Name | Component | Use |
|------|-----------|-----|
| Chit Shuffle | `BusyPaperButton` + `ChitShuffle` | Any button waiting on server (join, login, start game, end party, take over, leave, …) |
| Party Post | `PartyPost` | Overlay while **creating** (`/host`) or **joining** room |
| Games Skeleton | `GamesSkeleton` + `GamesCatalogClient` | Home `/games`, host lobby while connecting |
| Shuffle & Deal | `ShuffleDeal` | Host starting a **non–music** game |
| Cassette Cue | `CassetteCue` | Host starting **Antakshari** or **Sound Guru** |

**Rules:**

- Show **only while the request is actually pending** — no artificial delay to “finish” animation.
- Decorative motion starts after **`useDelayedVisible` 150ms** to avoid flicker on fast responses.
- **`prefers-reduced-motion`:** no shimmer/spin; still copy + static illustration (`loaders.css`).
- **Party Post:** **4.5s** loop — sealed envelope → seal pop → flap open → **“You’re invited!”** card (clipped above pocket; opaque pocket) → hold → return → flap close → seal. CSS: `party-post-*` in `loaders.css`.
- Styles: cream paper, turmeric, vermilion, ink outlines, hard shadows; **Bricolage Grotesque / Mukta** (already loaded — don’t embed font files).

---

## Player limits

- **`MAX_PLAYERS = 50`** in `src/lib/useHostRoom.ts` (lobby cap).
- Per-game min/max in **`src/games/catalog.ts`** (start buttons respect these).

---

## Repo rules (do not undo)

1. **Never commit screenshots, GIFs, MP4s, or other binaries** — use `/opt/cursor/artifacts` (or similar) for QA assets only.
2. **Paper design language** unless game is intentionally still on dark classic/TV: `--bg` cream, `--card` paper, turmeric accents, vermilion, 1.5px ink, 2px hard shadows.
3. **Supabase schema:** new migrations only as **`0004_*.sql`**; **do not edit `0001`–`0003`** (including `0003_close_room.sql`).
4. **Host identity** for contention: auth `host_id`, not presence tab id (see above).

---

## Useful scripts

- `node scripts/host-refresh-e2e.mjs` — host reload, no takeover prompt.
- `node scripts/responsive-screenshots.mjs` — widths 393/768/1280/1920, overflow check (artifacts dir).
- `node scripts/host-presence-unit.mjs` — presence conflict logic unit checks.

---

## Files touched by this branch (orientation)

- Host/presence: `src/lib/useHostRoom.ts`, `src/app/room/[code]/host/*`
- Shell/UI: `src/components/RoomShell.tsx`, `ProfileMenu.tsx`, `HostScreen.tsx`, `PlayerScreen.tsx`, `join/JoinForm.tsx`
- Loaders: `src/components/loaders/*`, `src/app/globals.css` (@import loaders)
- Create room: `src/app/host/CreateRoom.tsx` (strict-mode-safe fetch + `PartyPost`)
