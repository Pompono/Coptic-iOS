-- READ ONLY: owner must review results in the intended project before enabling.
-- Include non-public application schemas and tables without foreign keys.
select schemaname, tablename from pg_catalog.pg_tables
where schemaname not in ('pg_catalog', 'information_schema') order by 1,2;
select conrelid::regclass as dependent_table, confrelid::regclass as referenced_table,
  pg_get_constraintdef(oid) as definition
from pg_constraint where contype = 'f' order by 1,2;
select table_schema, table_name, column_name, data_type from information_schema.columns
where column_name ~* '(user|owner|email|account|customer|profile|identity)' order by 1,2,3;
select id, public, owner_id from storage.buckets;
select bucket_id, owner_id, count(*) from storage.objects group by 1,2;
select schemaname, tablename, policyname, roles, cmd, qual, with_check from pg_policies order by 1,2,3;
select event_object_schema, event_object_table, trigger_name, action_statement
from information_schema.triggers order by 1,2,3;
