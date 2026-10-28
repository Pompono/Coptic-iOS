-- Read-only metadata queries for owner review. No connection is made by this file.
-- Keep output private: role topology and function definitions may be sensitive.
select rolname, rolinherit, rolcanlogin, rolsuper, rolbypassrls, rolcreaterole,
  rolcreatedb, rolreplication from pg_roles order by rolname;
select pg_get_userbyid(roleid) as granted_role, pg_get_userbyid(member) as member_role,
  admin_option from pg_auth_members order by 1,2;
select nspname, nspowner::regrole, nspacl from pg_namespace order by 1;
select defaclrole::regrole, defaclnamespace, defaclobjtype, defaclacl
  from pg_default_acl order by 1,2,3;
select n.nspname,c.relname,c.relowner::regrole,c.relrowsecurity,c.relacl,r.rolname,p.permission,
  has_table_privilege(r.oid,c.oid,p.permission) as allowed
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join pg_roles r cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p(permission)
where n.nspname='public' and c.relkind in ('r','p','v','m','f')
  and r.rolname in ('anon','authenticated','service_role') order by 1,2,6,7;
select attrelid::regclass,attname,attacl from pg_attribute
where attacl is not null and attnum>0 and not attisdropped order by 1,2;
select p.oid::regprocedure,p.proowner::regrole,p.prosecdef,p.proconfig,p.proacl,r.rolname,
  has_function_privilege(r.oid,p.oid,'EXECUTE') as allowed
from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join pg_roles r
where n.nspname not in ('pg_catalog','information_schema') and p.prokind='f'
  and r.rolname in ('anon','authenticated','service_role') order by 1,6;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies order by 1,2,3;
