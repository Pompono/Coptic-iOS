-- Forward-only: production reports these two tables empty with nullable UUID
-- owners. Never delete, backfill, or guess ownership if that inventory is stale.
-- A single DO statement makes both changes atomic, even outside a migration
-- runner's transaction. Original staging installations may omit these tables.
do $$
declare table_name text; relation_id oid; has_null boolean;
begin
  perform set_config('lock_timeout', '5s', true);
  foreach table_name in array array['reviews', 'xp_events'] loop
    relation_id := to_regclass(format('public.%I', table_name));
    if relation_id is null then continue; end if;
    -- Validate catalog properties under the same lock as enforcement.
    execute format('lock table public.%I in access exclusive mode', table_name);
    if not exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_attribute a on a.attrelid = c.oid
      where c.oid = relation_id and c.relkind = 'r' and a.attname = 'user_id'
        and a.atttypid = 'uuid'::regtype and not a.attisdropped) then
      raise exception 'Unexpected public.% ownership schema; review required.', table_name;
    end if;
    -- Lock both tables before checking data so concurrent writers cannot add
    -- unowned rows between the inventory check and constraint enforcement.
  end loop;
  foreach table_name in array array['reviews', 'xp_events'] loop
    if to_regclass(format('public.%I', table_name)) is null then continue; end if;
    execute format('select exists(select 1 from public.%I where user_id is null)', table_name) into has_null;
    if has_null then
      raise exception 'public.% contains unowned rows; stop and review ownership. No rows were changed.', table_name
        using errcode = '23502';
    end if;
    execute format('alter table public.%I alter column user_id set not null', table_name);
  end loop;
end $$;
