-- Isolated CI fixture ONLY. Never execute against a deployed project.
begin;
insert into auth.users(id) values ('00000000-0000-4000-8000-0000000000a1'), ('00000000-0000-4000-8000-0000000000b2');
insert into public.progress_sync_snapshots(user_id, revision, records)
values ('00000000-0000-4000-8000-0000000000a1', 1, '{}'), ('00000000-0000-4000-8000-0000000000b2', 1, '{}');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1"}', true);
do $$ begin
  begin
    perform public.claim_account_deletion('00000000-0000-4000-8000-0000000000b2', repeat('a', 64));
    raise exception 'SECURITY FAILURE: user A can request admin deletion of B';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.account_deletion_requests;
    raise exception 'SECURITY FAILURE: authenticated can alter receipts';
  exception when insufficient_privilege then null; end;
  begin
    perform public.account_deletion_objects('00000000-0000-4000-8000-0000000000b2');
    raise exception 'SECURITY FAILURE: authenticated can inventory other storage';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select public.claim_account_deletion('00000000-0000-4000-8000-0000000000a1', repeat('a',64));
do $$ begin
  if public.claim_account_deletion('00000000-0000-4000-8000-0000000000a1', repeat('a',64)) then raise exception 'Duplicate lease granted'; end if;
  begin
    update public.progress_sync_snapshots set revision = 2 where user_id = '00000000-0000-4000-8000-0000000000a1';
    raise exception 'Pending account can still upload';
  exception when insufficient_privilege then null; end;
end $$;
delete from auth.users where id = '00000000-0000-4000-8000-0000000000a1';
do $$ begin
  if exists(select 1 from public.progress_sync_snapshots where user_id = '00000000-0000-4000-8000-0000000000a1') then raise exception 'Orphaned snapshot'; end if;
  if not exists(select 1 from public.account_deletion_requests where receipt_hash = repeat('a',64) and user_id is null) then raise exception 'Deletion receipt not finalized atomically'; end if;
  if not exists(select 1 from auth.users where id = '00000000-0000-4000-8000-0000000000b2') then raise exception 'Other account affected'; end if;
  begin
    insert into public.progress_sync_snapshots values ('00000000-0000-4000-8000-0000000000a1', 1, '{}', now());
    raise exception 'Stale upload recreated deleted account data';
  exception when foreign_key_violation then null; end;
  if public.account_allows_storage() then raise exception 'Deleted JWT still allowed storage'; end if;
end $$;
rollback;
