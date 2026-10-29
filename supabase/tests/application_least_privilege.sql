-- Run only in a disposable PostgreSQL replay of the private public-schema export.
begin;
do $$ declare t text; p text; r text; begin
  foreach t in array array['courses','lessons','questions','reviews','streaks','user_progress','xp_events'] loop
    foreach p in array (array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] || case when current_setting('server_version_num')::int >= 170000 then array['MAINTAIN'] else array[]::text[] end) loop
      if not has_table_privilege('service_role',format('public.%I',t),p) then raise exception 'Service access changed'; end if;
      foreach r in array array['anon','authenticated'] loop
        if has_table_privilege(r,format('public.%I',t),p) is distinct from (p in ('SELECT','INSERT','UPDATE','DELETE')) then
          raise exception 'Wrong preserved access: % % %',r,t,p;
        end if;
      end loop;
    end loop;
  end loop;
  if has_function_privilege('anon','public.save_progress_snapshot(bigint,jsonb)','EXECUTE')
    or not has_function_privilege('authenticated','public.save_progress_snapshot(bigint,jsonb)','EXECUTE')
    or not has_function_privilege('service_role','public.save_progress_snapshot(bigint,jsonb)','EXECUTE') then
    raise exception 'Existing snapshot grants changed'; end if;
end $$;
-- REINDEX gives an error (unlike VACUUM/ANALYZE warning-and-skip behavior).
-- Prove both client roles lose maintenance while service_role retains it.
do $$ declare r text; begin
  if current_setting('server_version_num')::int >= 170000 then
    foreach r in array array['anon','authenticated'] loop
      execute format('set local role %I',r);
      begin
        execute 'reindex table public.courses';
        raise exception 'Client REINDEX unexpectedly succeeded';
      exception when insufficient_privilege then null; end;
      reset role;
    end loop;
    set local role service_role;
    execute 'reindex table public.courses';
    reset role;
  end if;
end $$;
set local role anon;
do $$ begin
  begin truncate public.courses cascade; raise exception 'Anonymous truncate succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  begin truncate public.reviews; raise exception 'Authenticated truncate succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into auth.users(id) values ('00000000-0000-4000-8000-0000000000e6');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000000e6"}',true);
select * from public.save_progress_snapshot(0,'{}');
do $$ begin
  if (select count(*) from public.progress_sync_snapshots)<>1 then raise exception 'Snapshot read broken'; end if;
end $$;
insert into public.reviews(user_id,key,prompt,due_at)
values ('00000000-0000-4000-8000-0000000000e6','probe','probe',now());
update public.reviews set prompt='updated';
delete from public.reviews;
do $$ begin
  if (select count(*) from public.reviews)<>1 then raise exception 'Existing RLS delete restriction changed'; end if;
end $$;
insert into public.xp_events(user_id,amount,reason) values ('00000000-0000-4000-8000-0000000000e6',1,'probe');
reset role;
-- Narrow migration intentionally preserves defaults, including unsafe defaults
-- deferred for separate managed-platform review. Assert no incidental change.
create table public.hardening_future_table(id int);
create sequence public.hardening_future_sequence;
create function public.hardening_future_function() returns int language sql as 'select 1';
create schema hardening_other_schema;
create function hardening_other_schema.future_function() returns int language sql as 'select 1';
do $$ declare r text; p text; begin
  foreach r in array array['anon','authenticated'] loop
    foreach p in array (array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] || case when current_setting('server_version_num')::int >= 170000 then array['MAINTAIN'] else array[]::text[] end) loop
      if not has_table_privilege(r,'public.hardening_future_table',p) then raise exception 'Existing future table default changed'; end if;
    end loop;
    foreach p in array array['SELECT','UPDATE','USAGE'] loop
      if not has_sequence_privilege(r,'public.hardening_future_sequence',p) then raise exception 'Existing future sequence default changed'; end if;
    end loop;
    if not has_function_privilege(r,'public.hardening_future_function()','EXECUTE')
      or not has_function_privilege(r,'hardening_other_schema.future_function()','EXECUTE') then
      raise exception 'Existing future function default changed'; end if;
  end loop;
  if not has_table_privilege('service_role','public.hardening_future_table','SELECT')
    or not has_function_privilege('service_role','public.hardening_future_function()','EXECUTE') then
    raise exception 'Service default changed'; end if;
end $$;
rollback;
