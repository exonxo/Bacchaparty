# Room realtime channel: why it is still public, and the recommended fix

Status: **design only, not built** (round 8). Decision needed from the owner before any code is written.

## What happens today

- Every room uses one Supabase Realtime broadcast channel, `room:CODE` (`src/lib/transport.ts`). It is a
  **public** channel: anyone with the project's public (anon) key can subscribe to any topic.
- Room codes are 4 letters from a 24-letter alphabet: 331,776 codes. A code is shown on the TV and in the QR.
- What protects a room now (`src/lib/secure.ts`, `src/lib/useHostRoom.ts`):
  - Room snapshots are **signed** by the host (ECDSA P-256). Phones reject fakes. Snapshots are **not encrypted**.
  - Each player's private view (their hand, their secret word) is **encrypted** with a key shared only with that player (ECDH, AES-GCM).
  - Player actions are authenticated with the same per-player key, so nobody can act as another player.
  - The host accepts at most 8 new joins per 2 seconds and has a player cap. The host can kick a player.

## What an outsider can do

| Who | Can | Cannot |
| --- | --- | --- |
| Knows the code (was in the room, saw the TV) | Join as a visible player. Read the public snapshot. | Read other players' private views. Act as someone else. Forge host updates. |
| Guesses codes, never joins | **Silently** read the public snapshot of an active room: player nicknames, scores, the shared board, the phase. See join and action envelopes (encrypted). | Same as above. Is not shown in the player list. |

So the real gap is the second row: a silent listener on a guessed code. The public snapshot holds nicknames and
game progress, no emails, no account ids.

## Options

### A. Supabase private channels (what the brief asked for)

1. Owner turns on **Anonymous sign-ins** in Supabase Auth, so phones get a user id without a Google account
   (players never sign in today). This is a dashboard setting.
2. New table `room_members (code, user_id, joined_at)` and a `security definer` function `join_room(code)` that
   adds the caller when the room is active, with a per-user rate limit. Kicking removes the row.
3. RLS policies on `realtime.messages` for `extension in ('broadcast', 'presence')`: allow read and write only when
   `realtime.topic() = 'room:' || code` for a row in `room_members` with `user_id = auth.uid()`, or when the caller
   is the room's host.
4. Client: `supabase.channel('room:CODE', { config: { private: true } })` after the phone has a session.
5. Owner turns **off** "Allow public access" in Realtime settings, otherwise public channels keep working.

Cost and risk:
- Two dashboard settings the owner must change, and anonymous sign-ins add abuse surface (captcha is advised).
- Every phone gets an auth session; the join flow gains a network round trip and a new failure mode.
- Rooms that are live during the switch break unless both channels run side by side for a while.
- **It does not stop people who know the code.** `join_room(code)` must accept anyone with the code, or the
  party can't join. What it adds: guessers must call a rate-limited server function first, and they then show
  up as members.
- [Likely] about 1 to 2 days of work plus a careful rollout. Not something to half-build.

### B. Encrypt the snapshot with a room key (recommended first step)

1. The host makes a random AES-GCM room key when the room opens.
2. When a phone joins, the host sends it the room key inside that phone's already-encrypted private envelope
   (the ECDH key it already shares).
3. The host encrypts the room snapshot with the room key, then signs it as today. Phones decrypt, then verify.
4. TV screens need the key too. Today the TV only sends `sync` and reads the public snapshot
   (`src/app/room/[code]/tv/TvScreen.tsx`), so it needs its own key exchange: a viewer join the host
   shows on its screen ("TV connected") and can remove.

Effect: a silent listener on a guessed code sees only ciphertext. To read anything they must join, which puts
them in the host's player list where the host can see and kick them. No Supabase settings change, no new
accounts, no migration. Old phones in a live room need a reload once.

Cost: changes the snapshot path (`useHostRoom.ts` broadcast, `roomReceiver.ts`, the TV screen and its new viewer join) and needs the
full game sweep (`scripts/qa-games.mjs`) on phones. [Likely] half a day plus testing.

## Recommendation

Do **B** as its own PR, then decide on **A** only if silent joins (row 1 of the table) become a real problem.
A without B still leaves the snapshot readable to anyone who passes `join_room`, which is everyone with the code.
Either way this is not bundled into the admin PR (#21): it touches every game screen and needs its own test pass.
