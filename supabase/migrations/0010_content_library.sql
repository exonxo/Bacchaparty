-- Content library: every AI-made item (Chor Kaun topics, Emoji Picture puzzles, dares) is kept and
-- served again to other hosts, so the app asks the AI services only when the library has nothing
-- new for this viewer. Run in the Supabase SQL editor AFTER 0009. Safe to run more than once.
-- The app works before this is applied: it skips the library and calls the AI services as before.
--
-- Like 0004 to 0009, nothing here is reachable by browsers: RLS is on with no policies, the public
-- roles have no privileges, and the functions can only be run with the service role key.
-- No email is stored. Viewers are keyed by account id ('u:<uuid>') or an anonymous id ('a:<id>').

-- 1. Normalised text used for de-duplication: lower case, punctuation and extra spaces removed.
create or replace function public.library_norm(p_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select left(btrim(regexp_replace(lower(coalesce(p_text, '')), '[^[:alnum:]]+', ' ', 'g')), 200);
$$;

-- 2. The library itself.
create table if not exists public.content_library (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('chor-kaun-topic', 'emoji-puzzle', 'dare')),
  game_id text not null check (game_id ~ '^[a-z0-9-]{1,40}$'),
  -- Emoji: the puzzle's level (kids, family, adults). Dares: the audience (family, mixed). Chor Kaun: 'any'.
  category text not null default 'any' check (category ~ '^[a-z0-9_-]{1,32}$'),
  lang text not null default 'en' check (lang ~ '^[a-z]{2}(-[a-z0-9]{2,8})?$'),
  text_key text not null check (length(text_key) between 1 and 200),
  text_norm text not null check (length(text_norm) between 1 and 200),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  -- Where it came from: 'llm:<provider>' (made during a game) or 'admin:llm:<provider>' (Generate more).
  source text not null check (source ~ '^[a-z0-9:_.-]{1,64}$'),
  -- The host whose game caused it to be made. Kept for counts; cleared if the account is deleted.
  created_for uuid references auth.users (id) on delete set null,
  active boolean not null default true,
  served_count bigint not null default 0,
  last_served_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists content_library_dedupe_idx on public.content_library (kind, lang, text_norm);
create index if not exists content_library_pick_idx on public.content_library (kind, lang, category) where active;
create index if not exists content_library_created_for_idx on public.content_library (created_for) where created_for is not null;
alter table public.content_library enable row level security;

-- 3. What each viewer has been shown. Rows older than 30 days no longer block anything and are
--    removed the next time that viewer asks. Account rows go when the account is deleted.
create table if not exists public.content_seen (
  viewer text not null check (viewer ~ '^(u:[0-9a-f-]{36}|a:[A-Za-z0-9_-]{16,64})$'),
  user_id uuid references auth.users (id) on delete cascade,
  item_id bigint not null references public.content_library (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (viewer, item_id),
  check ((user_id is null and viewer like 'a:%') or (user_id is not null and viewer = 'u:' || user_id::text))
);
create index if not exists content_seen_item_idx on public.content_seen (item_id);
create index if not exists content_seen_user_idx on public.content_seen (user_id) where user_id is not null;
alter table public.content_seen enable row level security;

revoke all on table public.content_library, public.content_seen from public, anon, authenticated;
revoke all on sequence public.content_library_id_seq from public, anon, authenticated;
grant select, insert, update, delete on table public.content_library, public.content_seen to service_role;
grant usage, select on sequence public.content_library_id_seq to service_role;

-- Internal: the viewer key for an account id or an anonymous id. Raises on bad input.
create or replace function public.library_viewer(p_user uuid, p_anon text)
returns text
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_user is not null then return 'u:' || p_user::text; end if;
  if p_anon ~ '^[A-Za-z0-9_-]{16,64}$' then return 'a:' || p_anon; end if;
  raise exception 'library: a viewer (account id or anonymous id) is required';
end;
$$;

-- 4. Serving. Returns up to p_count random items of this kind that the viewer has not been shown in
--    the last 30 days (never-shown items first), and records them as shown. If fewer than p_min are
--    eligible it returns nothing and records nothing, so the caller can ask the AI services instead.
create or replace function public.library_pick(
  p_user uuid,
  p_anon text,
  p_kind text,
  p_categories text[],
  p_lang text default 'en',
  p_count int default 1,
  p_min int default 1,
  p_exclude_norms text[] default '{}',
  p_exclude_ids text[] default '{}'
)
returns table (id bigint, category text, data jsonb)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_viewer text := public.library_viewer(p_user, p_anon);
  v_count int := least(greatest(coalesce(p_count, 1), 1), 30);
  v_min int := least(greatest(coalesce(p_min, 1), 1), least(greatest(coalesce(p_count, 1), 1), 30));
  v_ids bigint[];
begin
  -- One pick at a time per viewer, so two requests at the same moment can't both get the same item.
  perform pg_advisory_xact_lock(hashtextextended('library:' || v_viewer, 0));
  delete from public.content_seen s where s.viewer = v_viewer and s.seen_at < now() - interval '30 days';

  select array_agg(x.id) into v_ids from (
    select l.id
    from public.content_library l
    where l.active
      and l.kind = p_kind
      and l.lang = coalesce(p_lang, 'en')
      and l.category = any(coalesce(p_categories, array['any']))
      and not (l.text_norm = any(coalesce(p_exclude_norms, '{}')))
      and not (coalesce(l.data ->> 'id', '') = any(coalesce(p_exclude_ids, '{}')))
      and not exists (select 1 from public.content_seen s where s.viewer = v_viewer and s.item_id = l.id)
    order by random()
    limit v_count
  ) x;

  if coalesce(array_length(v_ids, 1), 0) < v_min then
    return;
  end if;

  insert into public.content_seen (viewer, user_id, item_id, seen_at)
  select v_viewer, p_user, i, now() from unnest(v_ids) i
  on conflict (viewer, item_id) do update set seen_at = excluded.seen_at;

  update public.content_library l set served_count = l.served_count + 1, last_served_at = now()
  where l.id = any(v_ids);

  return query select l.id, l.category, l.data from public.content_library l where l.id = any(v_ids);
end;
$$;

-- 5. Saving. p_items is a JSON array of {"category": ..., "key": ..., "data": {...}} (at most 50).
--    Items whose normalised key is already in the library are skipped. When a viewer is given, every
--    item in the batch (new or already known) is recorded as shown to them, because they just saw it.
--    Returns how many new items were stored.
create or replace function public.library_add(
  p_kind text,
  p_game text,
  p_lang text,
  p_source text,
  p_items jsonb,
  p_user uuid default null,
  p_anon text default null,
  p_mark_seen boolean default false
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_added int;
  v_viewer text;
begin
  if jsonb_typeof(p_items) <> 'array' then raise exception 'library: items must be an array'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'library: at most 50 items at a time'; end if;

  with input as (
    select coalesce(nullif(e ->> 'category', ''), 'any') as category,
           left(btrim(e ->> 'key'), 200) as text_key,
           public.library_norm(e ->> 'key') as text_norm,
           e -> 'data' as data
    from jsonb_array_elements(p_items) e
  ), ins as (
    insert into public.content_library (kind, game_id, category, lang, text_key, text_norm, data, source, created_for)
    select distinct on (text_norm) p_kind, p_game, category, coalesce(p_lang, 'en'), text_key, text_norm, data, p_source, p_user
    from input where text_norm <> ''
    order by text_norm
    on conflict (kind, lang, text_norm) do nothing
    returning 1
  )
  select count(*) into v_added from ins;

  if p_mark_seen then
    v_viewer := public.library_viewer(p_user, p_anon);
    insert into public.content_seen (viewer, user_id, item_id, seen_at)
    select v_viewer, p_user, l.id, now()
    from public.content_library l
    where l.kind = p_kind and l.lang = coalesce(p_lang, 'en')
      and l.text_norm in (select public.library_norm(e ->> 'key') from jsonb_array_elements(p_items) e)
    on conflict (viewer, item_id) do update set seen_at = excluded.seen_at;
  end if;

  return v_added;
end;
$$;

-- 6. Admin counts per game, kind and category. Counted in the database, not in the app.
create or replace function public.admin_library_counts()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total', (select count(*) from public.content_library),
    'active', (select count(*) from public.content_library where active),
    'servedTotal', (select coalesce(sum(served_count), 0) from public.content_library),
    'viewers30d', (select count(distinct viewer) from public.content_seen where seen_at >= now() - interval '30 days'),
    'rows', coalesce((
      select jsonb_agg(r order by r.game_id, r.kind, r.category)
      from (
        select game_id, kind, category, lang,
               count(*) as total,
               count(*) filter (where active) as active,
               count(*) filter (where created_at >= now() - interval '7 days') as added7d,
               coalesce(sum(served_count), 0) as served,
               count(*) filter (where source like 'admin:%') as from_admin
        from public.content_library
        group by game_id, kind, category, lang
      ) r
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.library_norm(text) from public, anon, authenticated;
revoke all on function public.library_viewer(uuid, text) from public, anon, authenticated;
revoke all on function public.library_pick(uuid, text, text, text[], text, int, int, text[], text[]) from public, anon, authenticated;
revoke all on function public.library_add(text, text, text, text, jsonb, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.admin_library_counts() from public, anon, authenticated;
grant execute on function public.library_norm(text) to service_role;
grant execute on function public.library_viewer(uuid, text) to service_role;
grant execute on function public.library_pick(uuid, text, text, text[], text, int, int, text[], text[]) to service_role;
grant execute on function public.library_add(text, text, text, text, jsonb, uuid, text, boolean) to service_role;
grant execute on function public.admin_library_counts() to service_role;
