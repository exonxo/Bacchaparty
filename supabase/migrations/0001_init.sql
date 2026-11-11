-- Bacchaparty schema. Run in the Supabase SQL editor (or `supabase db push`).

-- Party rooms. Only the host (a signed-in Google user) creates rows.
-- Players never write here; they join over Realtime with the room code.
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-Z]{4}$'),
  host_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists rooms_code_created_idx on public.rooms (code, created_at desc);

alter table public.rooms enable row level security;

-- Anyone (including anonymous phones) may look up a room by code to validate it.
drop policy if exists "rooms are readable" on public.rooms;
create policy "rooms are readable" on public.rooms
  for select using (true);

drop policy if exists "hosts create their rooms" on public.rooms;
create policy "hosts create their rooms" on public.rooms
  for insert to authenticated with check (host_id = auth.uid());

drop policy if exists "hosts update their rooms" on public.rooms;
create policy "hosts update their rooms" on public.rooms
  for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());

-- Content bank for the future weekly LLM refresh (fresh movies, quiz questions…).
-- The app currently ships its content in src/content; this table is where
-- reviewed, generated items will land once the LLM pipeline is added.
create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  level text not null check (level in ('kids', 'family', 'adults')),
  data jsonb not null,
  source text not null default 'manual',
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists content_items_game_idx on public.content_items (game_id, level) where approved;

alter table public.content_items enable row level security;

drop policy if exists "approved content is readable" on public.content_items;
create policy "approved content is readable" on public.content_items
  for select using (approved);
-- Inserts/updates happen with the service role key from a server job only.
