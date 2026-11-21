-- Themed generation: each library item can carry the topic the admin asked for ("Bollywood movies").
-- Run in the Supabase SQL editor AFTER 0010. Safe to run more than once. Nothing is deleted or rewritten:
-- it adds one nullable column and replaces library_add (same arguments) so the theme is saved.
-- Existing rows keep theme = null. Like 0010, nothing here is reachable by browsers.

alter table public.content_library add column if not exists theme text;
alter table public.content_library drop constraint if exists content_library_theme_check;
alter table public.content_library add constraint content_library_theme_check
  check (theme is null or (length(theme) between 1 and 60 and theme !~ '[\r\n\t]'));
create index if not exists content_library_theme_idx on public.content_library (kind, theme) where theme is not null;

-- library_add, as in 0010, plus an optional "theme" on each item.
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
           left(btrim(e ->> 'key'), 200) as text_key,
           public.library_norm(e ->> 'key') as text_norm,
           e -> 'data' as data
    from jsonb_array_elements(p_items) e
  ), ins as (
    insert into public.content_library (kind, game_id, category, lang, text_key, text_norm, data, source, created_for, theme)
    select distinct on (text_norm) p_kind, p_game, category, coalesce(p_lang, 'en'), text_key, text_norm, data, p_source, p_user, theme
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
