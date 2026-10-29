-- Read-only. Verify the connection targets neqpcwxlayczgoqnpwyt BEFORE execution.
-- Do not run application RPCs or inspect Auth users/data for this inventory.
begin read only;
select version(), current_setting('server_version_num'),current_database(),current_user;
select version,to_jsonb(m)->>'name' as name from supabase_migrations.schema_migrations m order by version;
with targets(name) as (values ('courses'),('lessons'),('questions'),('reviews'),
  ('streaks'),('user_progress'),('xp_events'))
select name,to_regclass(format('public.%I',name)) as relation,
  case when to_regclass(format('public.%I',name)) is null then 'ABSENT: no hardening coverage'
    else 'PRESENT: inspect grants before/after' end as coverage from targets;
select n.nspname,c.relname,c.relkind,c.relowner::regrole,c.relrowsecurity,c.relacl
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p') order by 1,2;
select p.oid::regprocedure,p.proowner::regrole,p.prosecdef,p.proconfig,p.proacl,
  md5(pg_get_functiondef(p.oid)) as definition_digest
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f' order by 1;
select extname,extversion from pg_extension order by 1;
select table_schema,table_name,column_name,data_type,is_nullable from information_schema.columns
where (table_schema='auth' and table_name='users' and column_name='id')
  or (table_schema='storage' and table_name in ('objects','buckets')
      and column_name in ('id','bucket_id','name','owner','owner_id')) order by 1,2,3;
commit;
