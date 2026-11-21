-- Round 6: lasting room counts, and admin stats that can't be broken by one malformed event.
--
-- Why: rooms are deleted after 7 days (0005 purge and create_room's housekeeping), so counting
-- the rooms table made "rooms created" and "hosts" shrink over time. A small per-host counter,
-- bumped by a trigger whenever a room is created, keeps lasting totals. It stores only the host's
-- account id, a number and two timestamps, and is removed with the account (on delete cascade).
-- Rooms that were already purged before this migration can't be recovered: the backfill counts
-- the rooms that exist when it runs.
--
-- Purely additive for older app code: admin_overview() and admin_users() keep the same names,
-- arguments and output keys. Run after 0005. Like 0004/0005, only the service role can call them.

create table if not exists public.host_room_counts (
  host_id uuid primary key references auth.users (id) on delete cascade,
  rooms_created bigint not null default 0,
  first_room_at timestamptz,
  last_room_at timestamptz
);

alter table public.host_room_counts enable row level security;
revoke all on table public.host_room_counts from public, anon, authenticated;
grant select on table public.host_room_counts to service_role;

-- Bumps the host's counter. Runs as the owner so hosts don't need any access to the table.
create or replace function public.bump_host_room_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.host_room_counts as c (host_id, rooms_created, first_room_at, last_room_at)
  values (new.host_id, 1, new.created_at, new.created_at)
  on conflict (host_id) do update
    set rooms_created = c.rooms_created + 1,
        first_room_at = least(c.first_room_at, excluded.first_room_at),
        last_room_at = greatest(c.last_room_at, excluded.last_room_at);
  return new;
end;
$$;

revoke all on function public.bump_host_room_count() from public, anon, authenticated;

drop trigger if exists rooms_bump_host_count on public.rooms;
create trigger rooms_bump_host_count
  after insert on public.rooms
  for each row execute function public.bump_host_room_count();

-- Backfill from the rooms that still exist (only hosts without a counter yet, so re-running is safe).
insert into public.host_room_counts (host_id, rooms_created, first_room_at, last_room_at)
select host_id, count(*), min(created_at), max(created_at)
from public.rooms
group by host_id
on conflict (host_id) do nothing;

-- Overview: same keys as before. rooms_total and hosts_total are now lasting totals;
-- rooms_active is the rooms currently kept (the last 7 days).
create or replace function public.admin_overview()
returns jsonb
language sql
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'users_total', (select count(*) from auth.users),
    'users_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'users_30d', (select count(*) from auth.users where created_at >= now() - interval '30 days'),
    'providers', coalesce((
      select jsonb_object_agg(p, n) from (
        select coalesce(raw_app_meta_data ->> 'provider', 'email') as p, count(*) as n
        from auth.users group by 1
      ) s
    ), '{}'::jsonb),
    'rooms_total', (select coalesce(sum(rooms_created), 0) from public.host_room_counts),
    'rooms_7d', (select count(*) from public.rooms where created_at >= now() - interval '7 days'),
    'rooms_active', (select count(*) from public.rooms),
    'hosts_total', (select count(*) from public.host_room_counts where rooms_created > 0),
    'last_signin_7d', (select count(*) from auth.users where last_sign_in_at >= now() - interval '7 days')
  );
$$;

-- Users page: same columns as before; rooms_hosted is now the lasting count.
create or replace function public.admin_users(p_search text default null, p_limit int default 50, p_offset int default 0)
returns table (
  email text,
  provider text,
  signed_up timestamptz,
  last_sign_in timestamptz,
  rooms_hosted bigint
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.email::text,
    coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
    u.created_at,
    u.last_sign_in_at,
    coalesce((select c.rooms_created from public.host_room_counts c where c.host_id = u.id), 0)
  from auth.users u
  where p_search is null or p_search = '' or u.email ilike '%' || p_search || '%'
  order by u.created_at desc
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

-- Suggestion stats (replaces 0005's version): a malformed "fallback" or "ms" value in one event
-- is treated as false / 0 instead of making the whole view fail.
create or replace function public.admin_llm_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with s as (
    select coalesce(nullif(detail ->> 'provider', ''), 'unknown') as provider,
           coalesce(
             (jsonb_typeof(detail -> 'fallback') = 'boolean' and (detail ->> 'fallback') = 'true')
             or (jsonb_typeof(detail -> 'fallback') = 'string' and lower(detail ->> 'fallback') in ('true', 't', '1')),
             false
           ) as fb,
           case
             when jsonb_typeof(detail -> 'ms') = 'number' then least(greatest((detail ->> 'ms')::numeric, 0), 600000)
             when jsonb_typeof(detail -> 'ms') = 'string' and (detail ->> 'ms') ~ '^\s*[0-9]{1,9}(\.[0-9]+)?\s*$'
               then least((detail ->> 'ms')::numeric, 600000)
             else 0
           end as ms
    from public.app_events
    where kind = 'suggest' and created_at >= now() - interval '7 days'
  ),
  per as (
    select provider,
           count(*) as served,
           count(*) filter (where fb) as fallback,
           coalesce(round(avg(ms)), 0)::int as avg_ms
    from s
    group by provider
  )
  select jsonb_build_object(
    'total', (select count(*) from s),
    'fallbackRate', (
      select case when count(*) = 0 then 0
                  else round(100.0 * count(*) filter (where fb) / count(*))::int end
      from s
    ),
    'providers', coalesce((
      select jsonb_object_agg(per.provider, jsonb_build_object('count', per.served, 'fallback', per.fallback, 'avgMs', per.avg_ms))
      from per
    ), '{}'::jsonb)
  );
$$;

revoke all on function public.admin_overview() from public, anon, authenticated;
revoke all on function public.admin_users(text, int, int) from public, anon, authenticated;
revoke all on function public.admin_llm_stats() from public, anon, authenticated;
grant execute on function public.admin_overview() to service_role;
grant execute on function public.admin_users(text, int, int) to service_role;
grant execute on function public.admin_llm_stats() to service_role;
