-- Round 7: follow-ups from the review of rounds 5 and 6. Run after 0007 in the Supabase SQL editor.

-- 1. TRUNCATE is not covered by row-level security. Supabase's default privileges give the anon and
--    authenticated roles broad table privileges on public tables, so without this a client with the
--    public key could empty a table even though every row-level policy says no. Removing TRUNCATE is
--    safe: the app never truncates. Row-level security still governs select, insert, update and delete.
revoke truncate on all tables in schema public from anon, authenticated;

-- 2. The admin and event tables are never read or written by the browser. Remove every privilege.
revoke all on table public.app_events, public.admin_login_log, public.admin_audit,
                   public.feature_flags, public.cron_runs from anon, authenticated;

-- 3. The review bank: approved items stay readable by everyone (the 0001 policy), nothing else.
revoke insert, update, delete, truncate on table public.content_items from anon, authenticated;

-- 4. Account list paging: break ties on the id, so pages can't repeat or skip accounts that share a
--    sign-up time. Same columns and signature as 0006.
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
  order by u.created_at desc, u.id
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.admin_users(text, int, int) from public, anon, authenticated;
grant execute on function public.admin_users(text, int, int) to service_role;
