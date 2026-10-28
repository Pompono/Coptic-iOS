-- Disposable database ONLY. Run after all five migrations; no production DDL
-- assumptions beyond the repository-owned snapshot and deletion objects.
begin;
do $$ declare f record; client_role text; permission text; begin
  for f in select p.oid, p.oid::regprocedure as signature, p.prosecdef, p.proconfig,
      p.proacl, p.proowner from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'account_deletion_%' or p.proname = 'claim_account_deletion')
  loop
    foreach client_role in array array['anon', 'authenticated'] loop
      if has_function_privilege(client_role, f.oid, 'EXECUTE') then
        raise exception 'Unexpected client EXECUTE: % on %', client_role, f.signature;
      end if;
    end loop;
    if exists(select 1 from aclexplode(coalesce(f.proacl, acldefault('f', f.proowner)))
      where grantee = 0 and privilege_type = 'EXECUTE') then
      raise exception 'PUBLIC can execute %', f.signature;
    end if;
    if f.prosecdef and not coalesce(f.proconfig @> array['search_path=""'], false) then
      raise exception 'Unsafe definer search path: %', f.signature;
    end if;
  end loop;
  if has_function_privilege('anon', 'public.save_progress_snapshot(bigint,jsonb)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.save_progress_snapshot(bigint,jsonb)', 'EXECUTE') then
    raise exception 'Snapshot RPC grant regression';
  end if;
  if not exists(select 1 from pg_proc where oid = 'public.save_progress_snapshot(bigint,jsonb)'::regprocedure
    and prosecdef and proconfig @> array['search_path=""']) then raise exception 'Unsafe snapshot definer'; end if;
  if has_function_privilege('anon', 'public.account_allows_storage()', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.account_allows_storage()', 'EXECUTE') then
    raise exception 'Storage policy helper grant regression';
  end if;
  foreach client_role in array array['anon', 'authenticated'] loop
    foreach permission in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
      if has_table_privilege(client_role, 'public.account_deletion_requests', permission) then
        raise exception 'Receipt privilege leak: % %', client_role, permission;
      end if;
    end loop;
  end loop;
  foreach permission in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
    if has_table_privilege('authenticated', 'public.progress_sync_snapshots', permission) then
      raise exception 'Direct snapshot write grant: %', permission;
    end if;
  end loop;
end $$;
insert into auth.users(id) values ('00000000-0000-4000-8000-0000000000a1');
-- Definer functions must ignore attacker-controlled temporary relation names.
create temporary table progress_sync_snapshots(user_id uuid);
create temporary table account_deletion_requests(user_id uuid);
grant all on progress_sync_snapshots, account_deletion_requests to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1"}', true);
select * from public.save_progress_snapshot(0, '{}'::jsonb);
reset role;
do $$ begin
  if exists(select 1 from pg_temp.progress_sync_snapshots) then raise exception 'Temp snapshot shadow used'; end if;
  if not exists(select 1 from public.progress_sync_snapshots
    where user_id = '00000000-0000-4000-8000-0000000000a1') then raise exception 'Real snapshot missing'; end if;
end $$;
select public.claim_account_deletion('00000000-0000-4000-8000-0000000000a1', repeat('a',64));
set local role authenticated;
do $$ begin
  begin
    perform public.save_progress_snapshot(1, '{}'::jsonb);
    raise exception 'Pending JWT wrote through snapshot RPC';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from auth.users where id = '00000000-0000-4000-8000-0000000000a1';
set local role authenticated;
do $$ begin
  begin
    perform public.save_progress_snapshot(0, '{}'::jsonb);
    raise exception 'Deleted JWT recreated snapshot';
  exception when foreign_key_violation then null; end;
end $$;
reset role;
rollback;
