-- Disposable fixture ONLY. Never run against a live project.
begin;
do $$ begin
  if not public.account_deletion_ready() then raise exception 'Expanded schema not ready'; end if;
end $$;
create table public.unknown_personal_data(id int);
do $$ begin
  if public.account_deletion_ready() then raise exception 'Unknown table was allowed'; end if;
end $$;
drop table public.unknown_personal_data;
alter table public.courses add column created_by uuid references auth.users;
do $$ begin
  if public.account_deletion_ready() then raise exception 'Shared content ownership was allowed'; end if;
end $$;
alter table public.courses drop column created_by;
alter table public.reviews drop constraint reviews_user_id_fkey;
alter table public.reviews add constraint reviews_user_id_fkey foreign key(user_id) references auth.users(id);
do $$ begin
  if public.account_deletion_ready() then raise exception 'Non-cascade FK was allowed'; end if;
end $$;
alter table public.reviews drop constraint reviews_user_id_fkey;
alter table public.reviews add constraint reviews_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade not valid;
do $$ begin
  if public.account_deletion_ready() then raise exception 'Unvalidated FK was allowed'; end if;
end $$;
alter table public.reviews validate constraint reviews_user_id_fkey;
alter table public.streaks disable trigger account_deletion_application_guard;
do $$ begin
  if public.account_deletion_ready() then raise exception 'Disabled guard was allowed'; end if;
end $$;
alter table public.streaks enable trigger account_deletion_application_guard;
alter table public.xp_events disable row level security;
do $$ begin
  if public.account_deletion_ready() then raise exception 'Disabled RLS was allowed'; end if;
end $$;
alter table public.xp_events enable row level security;
alter table public.user_progress drop constraint user_progress_pkey;
alter table public.user_progress alter column user_id drop not null;
do $$ begin
  if public.account_deletion_ready() then raise exception 'Nullable ownership was allowed'; end if;
end $$;
alter table public.user_progress add primary key(user_id);
alter table public.user_progress add column owner_id uuid;
do $$ begin
  if public.account_deletion_ready() then raise exception 'Additional ownership was allowed'; end if;
end $$;
alter table public.user_progress drop column owner_id;
insert into auth.users(id) values ('00000000-0000-4000-8000-0000000000a1'), ('00000000-0000-4000-8000-0000000000b2');
do $$ declare t text; begin
  foreach t in array array['reviews', 'streaks', 'user_progress', 'xp_events'] loop
    execute format('insert into public.%I(user_id, lesson_id, payload) values
      (''00000000-0000-4000-8000-0000000000a1'', 1, ''a''),
      (''00000000-0000-4000-8000-0000000000b2'', 1, ''b'')', t);
  end loop;
end $$;
insert into storage.buckets(id, owner_id) values ('owned-readiness-fixture', '00000000-0000-4000-8000-0000000000b2');
do $$ begin
  if public.account_deletion_ready() then raise exception 'Owned bucket was allowed'; end if;
end $$;
delete from storage.buckets where id = 'owned-readiness-fixture';
select public.claim_account_deletion('00000000-0000-4000-8000-0000000000a1', repeat('a', 64));
-- Privileged writers bypass RLS but must still be stopped by row triggers.
set local role service_role;
do $$ declare t text; begin
  foreach t in array array['reviews', 'streaks', 'user_progress', 'xp_events'] loop
    begin
      execute format('update public.%I set payload = ''late'' where user_id = ''00000000-0000-4000-8000-0000000000a1''', t);
      raise exception 'Pending privileged write allowed: %', t;
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    perform public.fixture_write_review('00000000-0000-4000-8000-0000000000a1');
    raise exception 'SECURITY DEFINER RPC bypassed guard';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  begin
    update public.reviews set user_id = '00000000-0000-4000-8000-0000000000b2'
      where user_id = '00000000-0000-4000-8000-0000000000a1';
    raise exception 'Pending owner reassignment allowed';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1"}', true);
do $$ begin
  if exists(select 1 from public.reviews) then raise exception 'Pending JWT can read personal rows'; end if;
  begin
    perform public.account_deletion_ready();
    raise exception 'Authenticated can call administrative readiness';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from auth.users where id = '00000000-0000-4000-8000-0000000000a1';
do $$ declare t text; remaining int; begin
  foreach t in array array['reviews', 'streaks', 'user_progress', 'xp_events'] loop
    execute format('select count(*) from public.%I', t) into remaining;
    if remaining <> 1 then raise exception 'Cascade/isolation failed: %', t; end if;
    execute format('update public.%I set payload = ''still works'' where user_id = ''00000000-0000-4000-8000-0000000000b2''', t);
    begin
      execute format('insert into public.%I(user_id, payload) values (''00000000-0000-4000-8000-0000000000a1'', ''stale'')', t);
      raise exception 'Deleted owner write allowed: %', t;
    exception when insufficient_privilege then null; end;
  end loop;
  if (select count(*) from public.courses) <> 1 or (select count(*) from public.lessons) <> 1
    or (select count(*) from public.questions) <> 1 then raise exception 'Shared content removed'; end if;
  if not public.account_deletion_ready() then raise exception 'Readiness did not recover'; end if;
end $$;
rollback;
