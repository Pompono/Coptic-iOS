-- PROPOSAL ONLY: outside supabase/migrations; never applied by the test runner.
-- Requires separate approval after managed Auth/Storage/extensions compatibility review.
-- See docs/database-hardening.md. No existing-object grants are changed.
do $proposal$
begin
  -- Defaults are specific to the creating role. Global and schema-specific ACLs
  -- are additive, so both must be cleared. Existing objects are unaffected.
  -- PostgreSQL's built-in PUBLIC EXECUTE is global: changing it also changes the
  -- default for future postgres-created functions outside public (review gate).
  execute 'alter default privileges for role postgres revoke all on tables from public, anon, authenticated';
  execute 'alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated';
  execute 'alter default privileges for role postgres revoke all on sequences from public, anon, authenticated';
  execute 'alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated';
  execute 'alter default privileges for role postgres revoke execute on functions from public, anon, authenticated';
  execute 'alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated';
end $proposal$;
