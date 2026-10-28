-- Disposable actual-export replay ONLY. No production DDL is reproduced here.
-- Required columns and policy names were inspected in the owner's private export.
begin;
do $$ declare t text; begin
  if not public.account_deletion_ready() then raise exception 'Production shape not ready'; end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r') <> 9 then raise exception 'Unexpected table inventory'; end if;
  foreach t in array array['reviews','streaks','user_progress','xp_events','progress_sync_snapshots'] loop
    if not exists(select 1 from pg_constraint where conrelid=format('public.%I',t)::regclass
      and confrelid='auth.users'::regclass and contype='f' and confdeltype='c'
      and convalidated and not condeferrable) then raise exception 'Cascade missing: %',t; end if;
    if not exists(select 1 from pg_attribute where attrelid=format('public.%I',t)::regclass
      and attname='user_id' and attnotnull and atttypid='uuid'::regtype) then raise exception 'Owner invalid'; end if;
  end loop;
  if not exists(select 1 from pg_policy where polrelid='public.reviews'::regclass
    and polname='reviews_update_own' and polpermissive) then raise exception 'Original policy lost'; end if;
end $$;
insert into auth.users(id) values ('00000000-0000-4000-8000-0000000000a1'),('00000000-0000-4000-8000-0000000000b2');
insert into public.courses(id,slug,title) values ('10000000-0000-4000-8000-000000000001','audit','Audit');
insert into public.lessons(id,course_id,unit,order_in_unit,slug,title)
values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',1,1,'audit','Audit');
insert into public.questions(lesson_id,qtype,prompt,answer)
values ('20000000-0000-4000-8000-000000000001','mcq','Audit','Answer');
insert into public.reviews(user_id,key,prompt,due_at) select id,'audit','Audit',now() from auth.users;
insert into public.streaks(user_id) select id from auth.users;
insert into public.user_progress(user_id,lesson_id) select id,'20000000-0000-4000-8000-000000000001' from auth.users;
insert into public.xp_events(user_id,amount,reason) select id,1,'audit' from auth.users;
insert into public.progress_sync_snapshots(user_id,revision,records) select id,1,'{}' from auth.users;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000000a1"}',true);
do $$ declare t text; n int; begin
  foreach t in array array['reviews','streaks','user_progress','xp_events','progress_sync_snapshots'] loop
    execute format('select count(*) from public.%I',t) into n;
    if n<>1 then raise exception 'Cross-account RLS read: %',t; end if;
  end loop;
  begin
    update public.reviews set user_id='00000000-0000-4000-8000-0000000000b2';
    raise exception 'RLS reassignment accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.xp_events(user_id,amount,reason) values ('00000000-0000-4000-8000-0000000000b2',1,'wrong');
    raise exception 'Cross-account insert accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select public.claim_account_deletion('00000000-0000-4000-8000-0000000000a1',repeat('a',64));
set local role service_role;
do $$ declare t text; begin
  foreach t in array array['reviews','streaks','user_progress','xp_events'] loop
    begin
      execute format('update public.%I set user_id=user_id where user_id=''00000000-0000-4000-8000-0000000000a1''',t);
      raise exception 'Privileged pending write accepted: %',t;
    exception when insufficient_privilege then null; end;
    begin
      execute format('update public.%I set user_id=''00000000-0000-4000-8000-0000000000a1'' where user_id=''00000000-0000-4000-8000-0000000000b2''',t);
      raise exception 'Reassignment into pending account accepted';
    exception when insufficient_privilege then null; end;
    begin
      execute format('update public.%I set user_id=''00000000-0000-4000-8000-0000000000b2'' where user_id=''00000000-0000-4000-8000-0000000000a1''',t);
      raise exception 'Reassignment out of pending account accepted';
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    insert into public.reviews(key,prompt,due_at) values ('null','Audit',now());
    raise exception 'Null owner bypassed guard';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.xp_events(amount,reason) values (1,'null');
    raise exception 'Null event owner bypassed guard';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Constraints independently defend ownership if a privileged operator disables guards.
alter table public.reviews disable trigger account_deletion_application_guard;
alter table public.xp_events disable trigger account_deletion_application_guard;
do $$ begin
  begin insert into public.reviews(key,prompt,due_at) values ('null','Audit',now());
    raise exception 'Missing NOT NULL reviews'; exception when not_null_violation then null; end;
  begin insert into public.xp_events(amount,reason) values (1,'null');
    raise exception 'Missing NOT NULL events'; exception when not_null_violation then null; end;
end $$;
alter table public.reviews enable trigger account_deletion_application_guard;
alter table public.xp_events enable trigger account_deletion_application_guard;
delete from auth.users where id='00000000-0000-4000-8000-0000000000a1';
do $$ declare t text; n int; begin
  foreach t in array array['reviews','streaks','user_progress','xp_events','progress_sync_snapshots'] loop
    execute format('select count(*) from public.%I',t) into n;
    if n<>1 then raise exception 'Cascade removed other user or left orphan: %',t; end if;
    execute format('select count(*) from public.%I where user_id=''00000000-0000-4000-8000-0000000000b2''',t) into n;
    if n<>1 then raise exception 'Survivor is wrong user'; end if;
  end loop;
  foreach t in array array['courses','lessons','questions'] loop
    execute format('select count(*) from public.%I',t) into n;
    if n<>1 then raise exception 'Shared content lost: %',t; end if;
  end loop;
end $$;
set local role authenticated;
do $$ begin
  if exists(select 1 from public.reviews) then raise exception 'Stale JWT sees rows'; end if;
  begin insert into public.xp_events(user_id,amount,reason)
    values ('00000000-0000-4000-8000-0000000000a1',1,'stale');
    raise exception 'Stale JWT inserted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
