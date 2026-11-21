-- Round 5: admin statistics computed in the database, and data retention for the privacy policy.
--
-- Why: the API returns at most 1000 rows per request, so counting events in JavaScript silently
-- undercounts once there are more. These functions count inside Postgres instead.
-- Run after 0004 in the Supabase SQL editor. Like 0004, they can only be run by the service role.

-- Games started, per game and per day (UTC). Only game names are read: no user or room ids.
create or replace function public.admin_game_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'totalSample', (
      select count(*) from public.app_events
      where kind = 'game_started' and created_at >= now() - interval '30 days'
    ),
    'byGame', coalesce((
      select jsonb_object_agg(g.game, jsonb_build_object('d7', g.d7, 'd30', g.d30))
      from (
        select coalesce(detail ->> 'game', 'unknown') as game,
               count(*) filter (where created_at >= now() - interval '7 days') as d7,
               count(*) as d30
        from public.app_events
        where kind = 'game_started' and created_at >= now() - interval '30 days'
        group by 1
      ) g
    ), '{}'::jsonb),
    'byDay', coalesce((
      select jsonb_object_agg(d.day, d.n)
      from (
        select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as day, count(*) as n
        from public.app_events
        where kind = 'game_started' and created_at >= now() - interval '14 days'
        group by 1
      ) d
    ), '{}'::jsonb)
  );
$$;

-- Suggestions served in the last 7 days: total, share served from the built-in lists, and per provider.
create or replace function public.admin_llm_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with s as (
    select coalesce(detail ->> 'provider', 'unknown') as provider,
           coalesce((detail ->> 'fallback')::boolean, false) as fb,
           coalesce((detail ->> 'ms')::numeric, 0) as ms
    from public.app_events
    where kind = 'suggest' and created_at >= now() - interval '7 days'
  ),
  per as (
    select provider,
           count(*) as served,
           count(*) filter (where fb) as fallback,
           round(avg(ms))::int as avg_ms
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

-- Retention, run every night by the cron route. Returns how many rows were removed (no personal data).
--   rooms: 7 days · game and suggestion events: 180 days · admin login attempts: 90 days.
-- Host accounts are kept until the host asks for deletion.
create or replace function public.purge_old_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_rooms int;
  n_events int;
  n_logins int;
begin
  delete from public.rooms where created_at < now() - interval '7 days';
  get diagnostics n_rooms = row_count;
  delete from public.app_events where created_at < now() - interval '180 days';
  get diagnostics n_events = row_count;
  delete from public.admin_login_log where created_at < now() - interval '90 days';
  get diagnostics n_logins = row_count;
  return jsonb_build_object('rooms', n_rooms, 'events', n_events, 'loginAttempts', n_logins);
end;
$$;

revoke all on function public.admin_game_stats() from public, anon, authenticated;
revoke all on function public.admin_llm_stats() from public, anon, authenticated;
revoke all on function public.purge_old_data() from public, anon, authenticated;
grant execute on function public.admin_game_stats() to service_role;
grant execute on function public.admin_llm_stats() to service_role;
grant execute on function public.purge_old_data() to service_role;
