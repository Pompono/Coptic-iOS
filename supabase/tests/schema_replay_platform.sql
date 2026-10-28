-- Minimal managed-platform stand-in for isolated PostgreSQL schema replay.
-- NOT a dump of Supabase Auth/Storage internals. Real local Supabase integration
-- is a separate required test; never use this fixture on any deployed database.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create schema storage;
create table storage.objects(bucket_id text, name text, owner uuid, owner_id text);
create table storage.buckets(id text, owner uuid, owner_id text);
alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;
