-- READ ONLY: owner must review results in the intended project before enabling.
-- Include non-public application schemas and tables without foreign keys.
select schemaname, tablename from pg_catalog.pg_tables
where schemaname not in ('pg_catalog', 'information_schema') order by 1,2;
select conrelid::regclass as dependent_table, confrelid::regclass as referenced_table,
  convalidated, condeferrable, pg_get_constraintdef(oid) as definition
from pg_constraint where contype = 'f' order by 1,2;
select table_schema, table_name, column_name, data_type, is_nullable from information_schema.columns
where table_schema = 'public' or column_name ~* '(user|owner|email|account|customer|profile|identity|created_by|updated_by)' order by 1,2,3;
select id, public, owner_id from storage.buckets;
select bucket_id, owner_id, count(*) from storage.objects group by 1,2;
select schemaname, tablename, policyname, roles, cmd, qual, with_check from pg_policies order by 1,2,3;
select event_object_schema, event_object_table, trigger_name, action_statement
from information_schema.triggers order by 1,2,3;
-- Keep function bodies private: existing code may contain operational details.
-- Review triggers on Auth too, including cascade DELETE effects and external calls.
select c.oid::regclass as relation, t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) as definition,
  t.tgfoid::regprocedure as function_name
from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and n.nspname in ('public', 'auth', 'storage') order by 1,2;
select p.oid::regprocedure as function_name, p.prosecdef, p.proconfig, p.proacl,
  pg_get_userbyid(p.proowner) as owner, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.prokind in ('f', 'p') and (n.nspname = 'public' or p.oid in (
  select t.tgfoid from pg_trigger t join pg_class c on c.oid = t.tgrelid
  join pg_namespace tn on tn.oid = c.relnamespace
  where not t.tgisinternal and tn.nspname in ('public', 'auth', 'storage')))
order by 1;
select c.oid::regclass as relation, c.relkind, c.relrowsecurity, c.relforcerowsecurity, c.relacl
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f') order by 1;
select schemaname, viewname, definition from pg_views where schemaname = 'public';
-- Effective grants include PUBLIC/default ACLs and inherited memberships.
select p.oid::regprocedure as function_name, r.rolname,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') as can_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
cross join pg_roles r
where n.nspname = 'public' and p.prokind = 'f'
  and r.rolname in ('anon', 'authenticated', 'service_role') order by 1,2;
select pg_get_userbyid(roleid) as granted_role, pg_get_userbyid(member) as member_role, admin_option
from pg_auth_members order by 1,2;
select pg_get_userbyid(defaclrole) as owner, defaclnamespace::regnamespace as schema,
  defaclobjtype, defaclacl from pg_default_acl order by 1,2,3;
