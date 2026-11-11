-- Bacchaparty: host can close a party room (sets closed_at). Safe to run more than once.

-- End a party: only the signed-in host who owns the room. Idempotent if already closed.
create or replace function public.close_room(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  update public.rooms r
    set closed_at = coalesce(r.closed_at, now())
    where r.code = upper(p_code)
      and r.host_id = auth.uid()
      and r.created_at > now() - interval '24 hours';
  if not found then
    raise exception 'not your room';
  end if;
end;
$$;

-- Has this code been closed recently? (join flow: show "party has ended".)
create or replace function public.room_is_ended(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rooms r
    where r.code = upper(p_code)
      and r.closed_at is not null
      and r.created_at > now() - interval '24 hours'
  );
$$;

revoke all on function public.close_room(text) from public;
revoke all on function public.room_is_ended(text) from public;
grant execute on function public.close_room(text) to authenticated;
grant execute on function public.room_is_ended(text) to anon, authenticated;
