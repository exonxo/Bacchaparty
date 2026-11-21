-- Round 4: event log for the admin panel, login audit log, and admin-only statistics.
-- Run in the Supabase SQL editor after 0003. Nothing here is readable by browsers: RLS is on
-- with no policies, and the functions can only be run with the service role key.

-- What the app did: games started, suggestions served (with provider and fallback flag).
create table if not exists public.app_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('game_started', 'suggest', 'admin_login')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_events_kind_time_idx on public.app_events (kind, created_at desc);

alter table public.app_events enable row level security;

-- Every admin login attempt. The password and the typed username are never stored.
create table if not exists public.admin_login_log (
  id bigint generated always as identity primary key,
  ip text not null,
  ok boolean not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_login_log_ip_time_idx on public.admin_login_log (ip, created_at desc);

alter table public.admin_login_log enable row level security;

-- Counts for the admin overview. Reads auth.users, so it runs as the owner and is locked to the
-- service role.
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
    'rooms_total', (select count(*) from public.rooms),
    'rooms_7d', (select count(*) from public.rooms where created_at >= now() - interval '7 days'),
    'hosts_total', (select count(distinct host_id) from public.rooms),
    'last_signin_7d', (select count(*) from auth.users where last_sign_in_at >= now() - interval '7 days')
  );
$$;

-- One page of users, newest first. The search matches the email. Email is shown to the admin only.
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
    (select count(*) from public.rooms r where r.host_id = u.id)
  from auth.users u
  where p_search is null or p_search = '' or u.email ilike '%' || p_search || '%'
  order by u.created_at desc
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.admin_overview() from public, anon, authenticated;
revoke all on function public.admin_users(text, int, int) from public, anon, authenticated;
grant execute on function public.admin_overview() to service_role;
grant execute on function public.admin_users(text, int, int) to service_role;
