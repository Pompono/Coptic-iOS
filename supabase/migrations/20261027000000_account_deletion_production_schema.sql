-- Forward-only compatibility for the owner's reported inventory. Do not create
-- or guess definitions for production-only tables. Absent tables remain optional
-- for the original staging schema; incompatible definitions fail readiness.
create function public.account_deletion_application_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if new.user_id is null then
    raise exception 'Account ownership is required.' using errcode = '42501';
  end if;
  -- Check both owners on reassignment. Lock order is deterministic, and matches
  -- claim_account_deletion's advisory lock before checking the durable fence.
  for target in
    select distinct id from unnest(case when tg_op = 'UPDATE'
      then array[old.user_id, new.user_id] else array[new.user_id] end) as owners(id)
    where id is not null order by id
  loop
    perform pg_advisory_xact_lock(hashtextextended(target::text, 31));
    perform 1 from auth.users where id = target for key share;
    if not found or exists(select 1 from public.account_deletion_requests where user_id = target) then
      raise exception 'Account is absent or deleting.' using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;
revoke all on function public.account_deletion_application_guard() from public, anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['reviews', 'streaks', 'user_progress', 'xp_events'] loop
    if exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      join pg_catalog.pg_attribute a on a.attrelid = c.oid
      where n.nspname = 'public' and c.relname = table_name and c.relkind = 'r'
        and a.attname = 'user_id' and a.atttypid = 'uuid'::regtype and not a.attisdropped) then
      execute format('create trigger account_deletion_application_guard before insert or update on public.%I
        for each row execute function public.account_deletion_application_guard()', table_name);
      -- Add a restriction, never an access grant. Owner/service-role RPC writes
      -- bypassing RLS still encounter the row trigger above.
      execute format('create policy account_deletion_application_policy on public.%I as restrictive
        for all to authenticated using (public.account_allows_storage())
        with check (public.account_allows_storage())', table_name);
    end if;
  end loop;
end $$;

create or replace function public.account_deletion_ready() returns boolean
language plpgsql security definer set search_path = '' as $$
declare t record; owner_column smallint;
begin
  if exists(select 1 from pg_catalog.pg_tables where schemaname = 'public' and tablename not in
    ('courses', 'lessons', 'questions', 'reviews', 'streaks', 'user_progress', 'xp_events',
     'progress_sync_snapshots', 'account_deletion_requests'))
    or exists(select 1 from storage.buckets where owner_id is not null or owner is not null) then
    return false;
  end if;
  for t in select c.oid, c.relname, c.relkind, c.relrowsecurity
    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in
      ('courses', 'lessons', 'questions', 'reviews', 'streaks', 'user_progress', 'xp_events')
  loop
    if t.relkind <> 'r' then return false; end if;
    -- Shared content must not silently gain a personal-data ownership path.
    -- Names cannot detect arbitrary personal text/JSON: manual inventory is still required.
    if exists(select 1 from pg_catalog.pg_attribute where attrelid = t.oid and attnum > 0 and not attisdropped
      and attname ~* '(user|owner|email|account|customer|profile|identity|created_by|updated_by)'
      and not (t.relname in ('reviews', 'streaks', 'user_progress', 'xp_events') and attname = 'user_id')) then
      return false;
    end if;
    if t.relname in ('courses', 'lessons', 'questions') then
      if exists(select 1 from pg_catalog.pg_constraint where conrelid = t.oid
        and contype = 'f' and confrelid = 'auth.users'::regclass) then return false; end if;
    else
      select attnum into owner_column from pg_catalog.pg_attribute where attrelid = t.oid
        and attname = 'user_id' and atttypid = 'uuid'::regtype and attnotnull and not attisdropped;
      if owner_column is null or not t.relrowsecurity then return false; end if;
      if not exists(select 1 from pg_catalog.pg_constraint k where k.conrelid = t.oid
        and k.contype = 'f' and k.confrelid = 'auth.users'::regclass and k.confdeltype = 'c'
        and k.convalidated and not k.condeferrable and k.conkey = array[owner_column]
        and k.confkey = array[(select attnum from pg_catalog.pg_attribute
          where attrelid = 'auth.users'::regclass and attname = 'id')]) then return false; end if;
      if exists(select 1 from pg_catalog.pg_constraint where conrelid = t.oid and contype = 'f'
        and confrelid = 'auth.users'::regclass and conkey <> array[owner_column]) then return false; end if;
      if not exists(select 1 from pg_catalog.pg_trigger where tgrelid = t.oid
        and tgname = 'account_deletion_application_guard' and not tgisinternal
        and tgfoid = 'public.account_deletion_application_guard()'::regprocedure
        and tgenabled in ('O', 'A') and tgtype = 23) then return false; end if;
      if not exists(select 1 from pg_catalog.pg_policy where polrelid = t.oid
        and polname = 'account_deletion_application_policy' and not polpermissive and polcmd = '*'
        and polroles = array[(select oid from pg_catalog.pg_roles where rolname = 'authenticated')]) then
        return false;
      end if;
    end if;
  end loop;
  return true;
end $$;
-- CREATE OR REPLACE preserves the original service-only grants; repeat explicitly.
revoke all on function public.account_deletion_ready() from public, anon, authenticated;
grant execute on function public.account_deletion_ready() to service_role;
