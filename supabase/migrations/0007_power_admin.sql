-- Round 6: power admin. Audit log, feature flags, content review, cron run log, funnel,
-- quota and health statistics. Run after 0005 in the Supabase SQL editor.
-- Like 0004 and 0005, nothing here is readable by browsers: RLS is on with no policies, and the
-- functions can only be run with the service role key.

-- 1. Audit log: every admin action (and every sensitive admin read) is recorded before it happens.
create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  target text,
  details jsonb not null default '{}'::jsonb,
  ip text
);

create index if not exists admin_audit_at_idx on public.admin_audit (at desc);
alter table public.admin_audit enable row level security;

-- 2. Feature flags / kill switches. A key with no row is ON. Keys: game:<id>, llm:<provider>, suggest.
create table if not exists public.feature_flags (
  key text primary key check (key ~ '^[a-z0-9:_-]{1,64}$'),
  enabled boolean not null default true,
  note text,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.feature_flags enable row level security;

-- 3. Cron run log, so the health view can show when the nightly purge last ran and whether it worked.
create table if not exists public.cron_runs (
  id bigint generated always as identity primary key,
  job text not null,
  ran_at timestamptz not null default now(),
  ok boolean not null,
  detail jsonb not null default '{}'::jsonb
);

create index if not exists cron_runs_job_idx on public.cron_runs (job, ran_at desc);
alter table public.cron_runs enable row level security;

-- 4. Event kinds: add api_error (route failures) and cron_run.
alter table public.app_events drop constraint if exists app_events_kind_check;
alter table public.app_events add constraint app_events_kind_check
  check (kind in ('game_started', 'suggest', 'admin_login', 'api_error', 'cron_run'));

-- 5. Content review: generated items wait here until the owner approves or rejects them.
alter table public.content_items add column if not exists rejected boolean not null default false;
alter table public.content_items add column if not exists reviewed_at timestamptz;
alter table public.content_items add column if not exists reviewed_by text;
alter table public.content_items add column if not exists item_key text;

create unique index if not exists content_items_key_idx on public.content_items (game_id, item_key) where item_key is not null;

-- 6. Funnel: sign-up → created a room → came back more than 7 days after signing up, plus weekly cohorts.
-- "Came back" uses last_sign_in_at, so it means the latest sign-in was at least 7 days after sign-up.
create or replace function public.admin_funnel()
returns jsonb
language sql
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'signedUp', (select count(*) from auth.users),
    'createdRoom', (select count(distinct host_id) from public.rooms),
    'cameBack7d', (select count(*) from auth.users u where u.last_sign_in_at >= u.created_at + interval '7 days'),
    'cohorts', coalesce((
      select jsonb_agg(jsonb_build_object('week', w.week, 'signups', w.signups, 'hosted', w.hosted, 'cameBack', w.came_back) order by w.week)
      from (
        select to_char(date_trunc('week', u.created_at at time zone 'UTC'), 'YYYY-MM-DD') as week,
               count(*) as signups,
               count(*) filter (where exists (select 1 from public.rooms r where r.host_id = u.id)) as hosted,
               count(*) filter (where u.last_sign_in_at >= u.created_at + interval '7 days') as came_back
        from auth.users u
        where u.created_at >= now() - interval '8 weeks'
        group by 1
      ) w
    ), '[]'::jsonb)
  );
$$;

-- 7. Quota: successful provider calls since midnight UTC, per provider. Failed attempts are not logged
-- per provider, so this is a lower bound on what the provider's own dashboard shows.
create or replace function public.admin_quota_today()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(s.p, s.n), '{}'::jsonb)
  from (
    select coalesce(detail ->> 'provider', 'unknown') as p, count(*) as n
    from public.app_events
    where kind = 'suggest'
      and coalesce((detail ->> 'fallback')::boolean, false) = false
      and created_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')
    group by 1
  ) s;
$$;

-- 8. Health: last purge, suggestion volume and fallbacks in the last hour, route errors in the last hour.
create or replace function public.admin_health()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'lastPurge', (
      select jsonb_build_object('ranAt', c.ran_at, 'ok', c.ok, 'detail', c.detail)
      from public.cron_runs c where c.job = 'purge' order by c.ran_at desc limit 1
    ),
    'suggestionsLastHour', (select count(*) from public.app_events where kind = 'suggest' and created_at >= now() - interval '1 hour'),
    'fallbacksLastHour', (select count(*) from public.app_events where kind = 'suggest' and created_at >= now() - interval '1 hour'
                           and coalesce((detail ->> 'fallback')::boolean, false)),
    'errorsLastHour', (select count(*) from public.app_events where kind = 'api_error' and created_at >= now() - interval '1 hour')
  );
$$;

-- 9. Retention, extended: audit log kept 365 days, cron runs 90 days, everything else as in 0005.
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
  n_audit int;
  n_cron int;
begin
  delete from public.rooms where created_at < now() - interval '7 days';
  get diagnostics n_rooms = row_count;
  delete from public.app_events where created_at < now() - interval '180 days';
  get diagnostics n_events = row_count;
  delete from public.admin_login_log where created_at < now() - interval '90 days';
  get diagnostics n_logins = row_count;
  delete from public.admin_audit where at < now() - interval '365 days';
  get diagnostics n_audit = row_count;
  delete from public.cron_runs where ran_at < now() - interval '90 days';
  get diagnostics n_cron = row_count;
  return jsonb_build_object('rooms', n_rooms, 'events', n_events, 'loginAttempts', n_logins, 'audit', n_audit, 'cronRuns', n_cron);
end;
$$;

revoke all on function public.admin_funnel() from public, anon, authenticated;
revoke all on function public.admin_quota_today() from public, anon, authenticated;
revoke all on function public.admin_health() from public, anon, authenticated;
revoke all on function public.purge_old_data() from public, anon, authenticated;
grant execute on function public.admin_funnel() to service_role;
grant execute on function public.admin_quota_today() to service_role;
grant execute on function public.admin_health() to service_role;
grant execute on function public.purge_old_data() to service_role;

-- 10. Find an account by email (for the account panel). Returns the id, or null.
create or replace function public.admin_find_user(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
$$;

revoke all on function public.admin_find_user(text) from public, anon, authenticated;
grant execute on function public.admin_find_user(text) to service_role;
