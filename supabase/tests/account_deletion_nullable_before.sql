-- Disposable fixture only. The compatibility migration is installed but owners
-- are still nullable, matching production before the new forward migration.
do $$ declare t text; begin
  if public.account_deletion_ready() then raise exception 'Nullable schema passed readiness'; end if;
  foreach t in array array['reviews', 'xp_events'] loop
    if (select attnotnull from pg_attribute where attrelid = format('public.%I', t)::regclass
      and attname = 'user_id') then raise exception 'Fixture should start nullable: %', t; end if;
  end loop;
end $$;
set role service_role;
do $$ declare t text; begin
  foreach t in array array['reviews', 'xp_events'] loop
    begin
      execute format('insert into public.%I(user_id, payload) values (null, ''bypass'')', t);
      raise exception 'Privileged null insert bypassed trigger: %', t;
    exception when insufficient_privilege then null; end;
    begin
      execute format('insert into public.%I(payload) values (''omitted owner'')', t);
      raise exception 'Omitted owner bypassed trigger: %', t;
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    perform public.fixture_write_review(null);
    raise exception 'Null RPC owner bypassed trigger';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
