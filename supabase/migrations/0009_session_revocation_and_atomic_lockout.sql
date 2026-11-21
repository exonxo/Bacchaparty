-- Round 8: admin logout revocation and an atomic login lockout.
-- Run in the Supabase SQL editor AFTER 0007 and 0008. Safe to run more than once.
-- Like 0004 to 0008, nothing here is reachable by browsers: RLS is on with no policies, the public
-- roles have no privileges, and the functions can only be run with the service role key.
-- The app works before this is applied (logout is then enforced per server instance only, and the
-- lockout uses the older two-step check).

-- 1. Logged-out admin sessions. Each admin session token carries a random id; logging out stores
--    it here until the token would have expired. Rows are tiny and the app deletes expired ones.
create table if not exists public.admin_revoked_sessions (
  sid text primary key check (length(sid) between 16 and 64),
  expires_at timestamptz not null,
  revoked_at timestamptz not null default now()
);
create index if not exists admin_revoked_sessions_exp_idx on public.admin_revoked_sessions (expires_at);
alter table public.admin_revoked_sessions enable row level security;
revoke all on table public.admin_revoked_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_revoked_sessions to service_role;

-- 2. Atomic lockout. admin_login_begin takes a per-IP lock for the rest of its transaction, counts
--    recent failures and, if the IP is not locked, inserts this attempt as a failure ('pending')
--    before returning. A second request from the same IP waits for the lock and then sees that row,
--    so parallel requests can't all pass the check before any failure is recorded.
--    Returns the new row id, or null when the IP is locked.
create or replace function public.admin_login_begin(p_ip text, p_max int default 5, p_window_seconds int default 900)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('admin_login:' || coalesce(p_ip, ''), 0));
  if (
    select count(*) from public.admin_login_log
    where ip = p_ip and ok = false
      and created_at >= now() - make_interval(secs => greatest(p_window_seconds, 60))
  ) >= least(greatest(p_max, 1), 100) then
    return null;
  end if;
  insert into public.admin_login_log (ip, ok, reason) values (p_ip, false, 'pending')
  returning id into new_id;
  return new_id;
end;
$$;

-- Records the outcome of a reserved attempt. Only a 'pending' row can be changed, once.
create or replace function public.admin_login_finish(p_id bigint, p_ok boolean, p_reason text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.admin_login_log
  set ok = p_ok, reason = left(coalesce(p_reason, 'unknown'), 32)
  where id = p_id and reason = 'pending';
$$;

revoke all on function public.admin_login_begin(text, int, int) from public, anon, authenticated;
revoke all on function public.admin_login_finish(bigint, boolean, text) from public, anon, authenticated;
grant execute on function public.admin_login_begin(text, int, int) to service_role;
grant execute on function public.admin_login_finish(bigint, boolean, text) to service_role;
