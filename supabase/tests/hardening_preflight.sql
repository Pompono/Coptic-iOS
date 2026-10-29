-- Owner-run read-only metadata review for the EXISTING-TABLE migration only.
-- Never run this file automatically against a live project. Keep results private.
begin read only;
select version(), current_setting('server_version_num') as server_version_num;
with targets(name) as (values ('courses'),('lessons'),('questions'),('reviews'),
  ('streaks'),('user_progress'),('xp_events'))
select t.name,c.oid::regclass as relation,c.relkind,c.relowner::regrole as owner,
  c.relrowsecurity,c.relforcerowsecurity,c.relacl
from targets t left join pg_class c on c.oid=to_regclass(format('public.%I',t.name)) order by 1;

select rolname,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication,
  rolinherit,rolcanlogin from pg_roles where rolname in ('anon','authenticated','service_role');
-- Include both directions. Client membership in another role is a blocker;
-- authenticator membership in a client role is normally expected.
select pg_get_userbyid(roleid) as granted_role,pg_get_userbyid(member) as member_role,
  admin_option from pg_auth_members
where roleid in (select oid from pg_roles where rolname in ('anon','authenticated'))
   or member in (select oid from pg_roles where rolname in ('anon','authenticated')) order by 1,2;

select c.oid::regclass,r.rolname,p.permission,has_table_privilege(r.oid,c.oid,p.permission) as allowed
from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r
cross join unnest((array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] || case when current_setting('server_version_num')::int >= 170000 then array['MAINTAIN'] else array[]::text[] end)) p(permission)
where n.nspname='public' and c.relname in ('courses','lessons','questions','reviews',
  'streaks','user_progress','xp_events','progress_sync_snapshots')
  and r.rolname in ('anon','authenticated','service_role') order by 1,2,3;
select a.attrelid::regclass,a.attname,a.attacl,r.rolname,p.permission,
  has_column_privilege(r.oid,a.attrelid,a.attnum,p.permission) as allowed
from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
cross join pg_roles r cross join unnest(array['SELECT','INSERT','UPDATE','REFERENCES']) p(permission)
where n.nspname='public' and c.relname in ('courses','lessons','questions','reviews',
  'streaks','user_progress','xp_events') and a.attnum>0 and not a.attisdropped
  and r.rolname in ('anon','authenticated','service_role') order by 1,2,4,5;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename in ('courses','lessons','questions','reviews',
  'streaks','user_progress','xp_events','progress_sync_snapshots') order by 1,2,3;
select oid::regprocedure,proowner::regrole,prosecdef,proconfig,proacl from pg_proc
where oid=to_regprocedure('public.save_progress_snapshot(bigint,jsonb)');
-- Baseline only: no default ACLs are changed by the narrower migration.
select defaclrole::regrole,defaclnamespace,defaclobjtype,defaclacl from pg_default_acl order by 1,2,3;
select evtname,evtevent,evtenabled,evttags,evtfoid::regprocedure,
  pg_get_functiondef(evtfoid) as definition from pg_event_trigger order by evtname;
select l.relation::regclass,l.mode,l.granted,a.pid,a.usename,a.state,a.xact_start
from pg_locks l left join pg_stat_activity a on a.pid=l.pid
where l.relation in (select oid from pg_class where relnamespace='public'::regnamespace
  and relname in ('courses','lessons','questions','reviews','streaks','user_progress','xp_events'))
order by 1,2;
commit;
