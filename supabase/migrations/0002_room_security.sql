-- Bacchaparty: lock down the rooms table. Run once in the Supabase SQL editor.
-- Safe to run more than once. The app works before and after this migration.
--
-- Before: anyone could list every active room code, and any signed-in user
-- could insert a row with a code of their choosing.
-- After: the table is only reachable through the functions below.

-- The key the host's device signs room updates with; phones use it to reject fakes.
alter table public.rooms add column if not exists host_key text;

drop policy if exists "rooms are readable" on public.rooms;
drop policy if exists "hosts create their rooms" on public.rooms;
drop policy if exists "hosts update their rooms" on public.rooms;

-- A host may read their own rooms; nobody else can read the table.
drop policy if exists "hosts read their rooms" on public.rooms;
create policy "hosts read their rooms" on public.rooms
  for select to authenticated using (host_id = auth.uid());

-- Does an active room with this code exist? Returns its host's signing key.
-- Returns no row when the code is unknown, so codes can't be listed.
create or replace function public.room_lookup(p_code text)
returns table (host_key text)
language sql
stable
security definer
set search_path = public
as $$
  select r.host_key
  from public.rooms r
  where r.code = upper(p_code)
    and r.closed_at is null
    and r.created_at > now() - interval '24 hours'
  order by r.created_at desc
  limit 1;
$$;

-- Creates a room for the signed-in user with a fresh, unused code.
create or replace function public.create_room()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  new_code text;
  attempt int := 0;
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;

  -- Housekeeping: room records are kept for 7 days.
  delete from public.rooms where created_at < now() - interval '7 days';

  -- At most 20 rooms per host per day.
  if (select count(*) from public.rooms where host_id = auth.uid() and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'too many rooms today';
  end if;

  loop
    attempt := attempt + 1;
    new_code := '';
    for i in 1..4 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.rooms r
      where r.code = new_code and r.closed_at is null and r.created_at > now() - interval '24 hours'
    );
    if attempt > 20 then
      raise exception 'could not find a free room code';
    end if;
  end loop;

  insert into public.rooms (code, host_id) values (new_code, auth.uid());
  return new_code;
end;
$$;

-- The host records the signing key of the device running their room.
create or replace function public.set_room_key(p_code text, p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  if p_key is null or length(p_key) > 200 then
    raise exception 'bad key';
  end if;
  update public.rooms r
    set host_key = p_key
    where r.code = upper(p_code)
      and r.host_id = auth.uid()
      and r.closed_at is null
      and r.created_at > now() - interval '24 hours';
  if not found then
    raise exception 'not your room';
  end if;
end;
$$;

revoke all on function public.room_lookup(text) from public;
revoke all on function public.create_room() from public;
revoke all on function public.set_room_key(text, text) from public;
grant execute on function public.room_lookup(text) to anon, authenticated;
grant execute on function public.create_room() to authenticated;
grant execute on function public.set_room_key(text, text) to authenticated;
