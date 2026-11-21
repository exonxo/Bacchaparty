-- News questions for Kaun Banega Champion. Run in the Supabase SQL editor AFTER 0011. Safe to run more
-- than once. Nothing is deleted or rewritten: it allows one more kind of library item ('kbc-question'),
-- adds an optional expiry so stale news stops being served, and replaces library_pick and library_add
-- (same arguments) to respect and store it. Like 0010, nothing here is reachable by browsers.

alter table public.content_library drop constraint if exists content_library_kind_check;
alter table public.content_library add constraint content_library_kind_check
  check (kind in ('chor-kaun-topic', 'emoji-puzzle', 'dare', 'kbc-question'));
alter table public.content_library add column if not exists expires_at timestamptz;
create index if not exists content_library_expires_idx on public.content_library (kind, expires_at) where expires_at is not null;

-- A timestamp from text, or null if it isn't one (so one bad date can't fail a whole batch).
create or replace function public.library_ts(p text)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}' then
    return null;
  end if;
  return p::timestamptz;
exception when others then
  return null;
end;
$$;
revoke all on function public.library_ts(text) from public, anon, authenticated;
grant execute on function public.library_ts(text) to service_role;

-- library_pick, as in 0010, but never serves an expired item.
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
      and (l.expires_at is null or l.expires_at > now())
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

revoke all on function public.library_pick(uuid, text, text, text[], text, int, int, text[], text[]) from public, anon, authenticated;
grant execute on function public.library_pick(uuid, text, text, text[], text, int, int, text[], text[]) to service_role;

-- library_add, as in 0011, plus an optional "expires_at" on each item.
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
           nullif(btrim(left(btrim(regexp_replace(coalesce(e ->> 'theme', ''), '\s+', ' ', 'g')), 60)), '') as theme,
           -- Optional expiry (news questions): never later than 90 days from now; unreadable values mean none.
           -- (least() ignores nulls, so the null case is spelled out: no expiry stays no expiry.)
           case when public.library_ts(e ->> 'expires_at') is null then null
                else least(public.library_ts(e ->> 'expires_at'), now() + interval '90 days') end as expires_at,
           left(btrim(e ->> 'key'), 200) as text_key,
           public.library_norm(e ->> 'key') as text_norm,
           e -> 'data' as data
    from jsonb_array_elements(p_items) e
  ), ins as (
    insert into public.content_library (kind, game_id, category, lang, text_key, text_norm, data, source, created_for, theme, expires_at)
    select distinct on (text_norm) p_kind, p_game, category, coalesce(p_lang, 'en'), text_key, text_norm, data, p_source, p_user, theme, expires_at
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

revoke all on function public.library_add(text, text, text, text, jsonb, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.library_add(text, text, text, text, jsonb, uuid, text, boolean) to service_role;
