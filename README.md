# Bacchaparty 🪅

Desi party games for the whole family. Put the **big screen** on a TV or laptop and everyone joins from their **phones** with a 4-letter room code. No app to install, and players don't need an account. Only the host signs in with Google.

## Games

| Game | Ages | Players |
|---|---|---|
| 🎬 Dumb Charades (no timer) | 7+ | 2 teams |
| 🎤 Antakshari Battle | 7+ | 2 teams |
| 🔔 Sound Guru | 6+ | 3–20 |
| 🧩 Emoji Picture | 7+ | 1–30 |
| 🎨 Draw & Guess | 7+ | 2–16 |
| 🕵️ Chor Kaun? | 8+ | 3–12 |
| 👑 Raja Mantri Chor Sipahi | 6+ | exactly 4 |
| 🤫 Odd Word Out | 9+ | 3–12 |
| 🏆 Kaun Banega Champion | 8+ | 1–20 |
| 🎟️ Housie (Tambola) | 6+ | 1–50 |
| 🎲 Ludo Yatra | 6+ | 2–4 |
| ⚡ Jaldi Bolo | 8+ | 1–20 |

The full rules for every game are in the app at `/games` (source: `src/games/catalog.ts`).

## How it works

```
 Phones (players)                       Big screen (host, signed in)
 ─────────────────                      ─────────────────────────────
 join / action  ──►  Supabase Realtime  ──►  game reducer runs here
                     channel room:CODE        │
 public view    ◄──  (broadcast)        ◄──  broadcasts public view
 private view   ◄──                     ◄──  + each player's secret view
```

- **The host device runs the game.** Each game is a module in `src/games/<id>/` with a pure `reduce()`, a `publicView()` for everyone and a `privateView()` for each player's secrets (roles, tickets, words). Its `Screen` component is for the TV and its `Controller` component is for phones.
- **Realtime** uses Supabase broadcast channels and presence. Game state is not stored in the database. The host keeps it in memory and in `localStorage`, so refreshing the TV page resumes the game.
- **Database:** `rooms` records which signed-in host owns which code. `content_items` is reserved for the future LLM content refresh.
- **Demo mode:** if the Supabase env vars are missing, login is skipped and rooms sync between tabs of the same browser using `BroadcastChannel`. This is useful for development: open `/host` in one tab and `/join` in others.

> Secrets are sent to phones as broadcast messages that are filtered on the device. A determined player with browser devtools could peek at them. That's fine for a family party game; a server-authoritative design would be needed for anything competitive.

## Run locally

```bash
npm install
npm run dev            # demo mode, no setup needed
```

## Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/migrations/0001_init.sql`.
3. Go to **Authentication → Sign In / Providers → Google**, enable it and paste a Google OAuth client ID and secret:
   - Create the client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) under **Create credentials → OAuth client ID → Web application**.
   - Under **Authorized redirect URIs**, add `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.
   - On the **OAuth consent screen**, add your app name and support email.
4. Go to **Authentication → URL Configuration**:
   - Set **Site URL** to your Vercel URL, e.g. `https://bacchaparty.vercel.app`.
   - Under **Redirect URLs**, add `https://bacchaparty.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`, and `https://*-YOUR-TEAM.vercel.app/auth/callback` if you want preview deploys to work.
5. Go to **Project Settings → API** and copy the URL and the `anon` key into `.env.local` (see `.env.example`).
6. Make sure **Realtime** allows public channels. This is the default; check **Realtime → Settings** if phones can't connect.

## Deploy on Vercel

1. Import the GitHub repo in Vercel. The framework is detected as Next.js automatically.
2. Add the environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy, then put the production URL into the Supabase URL Configuration (step 4 above).

## Keep-alive

Free Supabase projects pause after about a week without activity. `vercel.json` schedules a daily Vercel Cron call to `/api/keepalive`, which runs a tiny query. Optionally set a `CRON_SECRET` env var in Vercel; the endpoint then only accepts Vercel's authenticated cron calls.

## Adding a game

1. Write `src/games/<id>/index.tsx` exporting a `GameModule` (see `src/lib/types.ts` and `src/games/housie` for a complete example).
2. Register it in `src/games/modules.ts`.
3. Add its description to `src/games/catalog.ts`.

## Roadmap: fresh content with an LLM

Content currently ships in `src/content/`. The plan is a weekly server job (for example a Vercel Cron hitting an API route) that:

1. asks an LLM with web search for new items (recent films, cricket, festivals),
2. runs a safety and moderation pass,
3. inserts them into `content_items` with `approved = false`,
4. waits for a quick review in an admin page before games read them.

Games never call the LLM live during play, which keeps them fast, cheap and kid-safe.
