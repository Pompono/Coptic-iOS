-- SYNTHETIC fixture regression, not evidence of exact production DDL.
begin;
insert into auth.users(id) values ('00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000000b2'), ('00000000-0000-4000-8000-0000000000c3');
do $$ declare t text; begin
  foreach t in array array['reviews', 'streaks', 'user_progress', 'xp_events'] loop
    execute format('insert into public.%I(user_id, payload) values
      (''00000000-0000-4000-8000-0000000000a1'', ''a''),
      (''00000000-0000-4000-8000-0000000000b2'', ''b'')', t);
  end loop;
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1"}', true);
do $$ declare t text; rows_seen int; changed int; begin
  foreach t in array array['reviews', 'streaks', 'user_progress', 'xp_events'] loop
    execute format('select count(*) from public.%I', t) into rows_seen;
    if rows_seen <> 1 then raise exception 'Cross-user read: %', t; end if;
    execute format('update public.%I set payload = ''stolen'' where user_id = ''00000000-0000-4000-8000-0000000000b2''', t);
    get diagnostics changed = row_count;
    if changed <> 0 then raise exception 'Cross-user update: %', t; end if;
    begin
      execute format('update public.%I set user_id = ''00000000-0000-4000-8000-0000000000c3''', t);
      raise exception 'Owner reassignment through RLS: %', t;
    exception when insufficient_privilege then null; end;
  end loop;
end $$;
reset role;
select public.claim_account_deletion('00000000-0000-4000-8000-0000000000a1', repeat('a',64));
-- Reassignment INTO a pending owner must fail even for a privileged writer.
set local role service_role;
do $$ declare t text; begin
  foreach t in array array['reviews', 'streaks', 'user_progress', 'xp_events'] loop
    begin
      execute format('update public.%I set user_id = ''00000000-0000-4000-8000-0000000000a1''
        where user_id = ''00000000-0000-4000-8000-0000000000b2''', t);
      raise exception 'Privileged reassignment to pending owner: %', t;
    exception when insufficient_privilege then null; end;
  end loop;
end $$;
reset role;
rollback;
