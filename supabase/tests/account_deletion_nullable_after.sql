-- Disposable fixture ONLY. Verify trigger and constraint defenses separately.
begin;
do $$ declare t text; begin
  if not public.account_deletion_ready() then raise exception 'Hardened schema not ready'; end if;
  foreach t in array array['reviews', 'xp_events'] loop
    if not (select attnotnull from pg_attribute where attrelid = format('public.%I', t)::regclass
      and attname = 'user_id') then raise exception 'Owner still nullable: %', t; end if;
    if not exists(select 1 from pg_policy where polrelid = format('public.%I', t)::regclass
      and polname = 'fixture_owner' and polpermissive) then raise exception 'Original policy lost'; end if;
  end loop;
end $$;
insert into auth.users(id) values ('00000000-0000-4000-8000-0000000000a1');
insert into public.reviews(user_id, payload) values ('00000000-0000-4000-8000-0000000000a1', 'owned');
insert into public.xp_events(user_id, payload) values ('00000000-0000-4000-8000-0000000000a1', 'owned');
set local role service_role;
do $$ declare t text; begin
  foreach t in array array['reviews', 'xp_events'] loop
    begin
      execute format('insert into public.%I(user_id) values (null)', t);
      raise exception 'Privileged null insert accepted';
    exception when insufficient_privilege then null; end;
    begin
      execute format('insert into public.%I(payload) values (''missing owner'')', t);
      raise exception 'Privileged omitted owner accepted';
    exception when insufficient_privilege then null; end;
    begin
      execute format('update public.%I set user_id = null', t);
      raise exception 'Privileged ownership erasure accepted';
    exception when insufficient_privilege then null; end;
  end loop;
end $$;
reset role;
-- Test-only: disabling the row guard must not remove NOT NULL protection.
alter table public.reviews disable trigger account_deletion_application_guard;
alter table public.xp_events disable trigger account_deletion_application_guard;
set local role service_role;
do $$ declare t text; begin
  foreach t in array array['reviews', 'xp_events'] loop
    begin
      execute format('insert into public.%I(user_id) values (null)', t);
      raise exception 'NOT NULL insert protection missing';
    exception when not_null_violation then null; end;
    begin
      execute format('update public.%I set user_id = null', t);
      raise exception 'NOT NULL update protection missing';
    exception when not_null_violation then null; end;
  end loop;
  begin
    perform public.fixture_write_review(null);
    raise exception 'SECURITY DEFINER null owner bypassed NOT NULL';
  exception when not_null_violation then null; end;
end $$;
reset role;
alter table public.reviews enable trigger account_deletion_application_guard;
alter table public.xp_events enable trigger account_deletion_application_guard;
delete from auth.users where id = '00000000-0000-4000-8000-0000000000a1';
do $$ begin
  if exists(select 1 from public.reviews) or exists(select 1 from public.xp_events) then
    raise exception 'Ownership erasure left orphan rows after deletion';
  end if;
end $$;
rollback;
