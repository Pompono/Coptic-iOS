-- Only the trusted Edge Function can access receipts or these administrative helpers.
create table public.account_deletion_requests (
  receipt_hash text primary key check (receipt_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  locked_until timestamptz not null default now()
);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public, anon, authenticated;
grant all on public.account_deletion_requests to service_role;
create index account_deletion_requests_user on public.account_deletion_requests(user_id) where user_id is not null;

create function public.account_deletion_receipt_completed() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.user_id is not null and new.user_id is null then new.completed_at := now(); end if;
  return new;
end $$;
revoke all on function public.account_deletion_receipt_completed() from public, anon, authenticated;
create trigger account_deletion_receipt_completed before update on public.account_deletion_requests
for each row execute function public.account_deletion_receipt_completed();

create function public.account_deletion_sync_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 31));
  if exists (select 1 from public.account_deletion_requests where user_id = new.user_id) then
    raise exception 'Account deletion is pending.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.account_deletion_sync_guard() from public, anon, authenticated;
create trigger account_deletion_sync_guard before insert or update on public.progress_sync_snapshots
for each row execute function public.account_deletion_sync_guard();

create function public.claim_account_deletion(p_user_id uuid, p_receipt_hash text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare claimed boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 31));
  if exists (select 1 from public.account_deletion_requests where user_id = p_user_id and receipt_hash <> p_receipt_hash and locked_until > now()) then
    return false;
  end if;
  insert into public.account_deletion_requests(receipt_hash, user_id, locked_until)
    values(p_receipt_hash, p_user_id, now() + interval '2 minutes')
    on conflict (receipt_hash) do update set locked_until = now() + interval '2 minutes'
      where account_deletion_requests.user_id = p_user_id and account_deletion_requests.locked_until < now()
    returning true into claimed;
  return coalesce(claimed, false);
end $$;
revoke all on function public.claim_account_deletion(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_account_deletion(uuid, text) to service_role;

-- Inventory storage metadata; remove actual objects only through the Storage API.
create function public.account_deletion_objects(p_user_id uuid)
returns table(bucket_id text, name text)
language sql security definer set search_path = '' as $$
  select o.bucket_id, o.name from storage.objects o
  where o.owner_id = p_user_id::text or o.owner = p_user_id limit 100;
$$;
revoke all on function public.account_deletion_objects(uuid) from public, anon, authenticated;
grant execute on function public.account_deletion_objects(uuid) to service_role;

-- Fail closed if the public application schema gains an unaudited table or an owned bucket.
create function public.account_deletion_ready() returns boolean
language sql security definer set search_path = '' as $$
  select not exists (
    select 1 from pg_catalog.pg_tables where schemaname = 'public'
      and tablename not in ('progress_sync_snapshots', 'account_deletion_requests')
  ) and not exists (select 1 from storage.buckets where owner_id is not null or owner is not null);
$$;
revoke all on function public.account_deletion_ready() from public, anon, authenticated;
grant execute on function public.account_deletion_ready() to service_role;

-- Restrictive policies never grant access; they prevent old JWTs from accessing
-- Storage once deletion starts, even when an existing permissive policy allows it.
create function public.account_allows_storage() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users where id = auth.uid())
    and not exists(select 1 from public.account_deletion_requests where user_id = auth.uid());
$$;
revoke all on function public.account_allows_storage() from public, anon;
grant execute on function public.account_allows_storage() to authenticated;
create policy account_deletion_storage_guard on storage.objects as restrictive
for all to authenticated using ((select public.account_allows_storage()))
with check ((select public.account_allows_storage()));
create policy account_deletion_bucket_guard on storage.buckets as restrictive
for all to authenticated using ((select public.account_allows_storage()))
with check ((select public.account_allows_storage()));

-- Serialize owned-object creation against Auth deletion, including requests that
-- already passed RLS before deletion started. Do not mutate storage metadata.
create function public.account_deletion_object_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner_uid uuid;
begin
  owner_uid := coalesce(new.owner_id::uuid, new.owner);
  if owner_uid is not null then
    perform 1 from auth.users where id = owner_uid for key share;
    if not found or exists(select 1 from public.account_deletion_requests where user_id = owner_uid) then
      raise exception 'Account is absent or deleting.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.account_deletion_object_guard() from public, anon, authenticated;
create trigger account_deletion_object_guard before insert or update on storage.objects
for each row execute function public.account_deletion_object_guard();
create trigger account_deletion_bucket_owner_guard before insert or update on storage.buckets
for each row execute function public.account_deletion_object_guard();

-- Last transactional guard against a concurrently created object slipping
-- between the Edge Function inventory and Auth's administrative delete call.
create function public.account_deletion_auth_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from storage.objects where owner_id = old.id::text or owner = old.id)
    or exists(select 1 from storage.buckets where owner_id = old.id::text or owner = old.id) then
    raise exception 'Owned storage must be removed through Storage API first.' using errcode = '23503';
  end if;
  return old;
end $$;
revoke all on function public.account_deletion_auth_guard() from public, anon, authenticated;
create trigger account_deletion_auth_guard before delete on auth.users
for each row execute function public.account_deletion_auth_guard();
