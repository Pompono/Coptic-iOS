-- Run against a disposable local Supabase database after applying migrations.
-- Supply two existing auth.users UUIDs with psql -v user_a=... -v user_b=...
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'user_a', 'role', 'authenticated')::text, true);
SELECT set_config('coptic.test_user_a', :'user_a', true);
SELECT set_config('coptic.test_user_b', :'user_b', true);
SELECT * FROM public.save_progress_snapshot(0, '{"coptic-progress":"{\"xp\":5,\"streak\":0,\"completedLessons\":[],\"lastCompletedDate\":null}"}'::jsonb);

SELECT set_config('request.jwt.claims', json_build_object('sub', :'user_b', 'role', 'authenticated')::text, true);
SELECT * FROM public.save_progress_snapshot(0, '{"coptic-progress":"{\"xp\":9,\"streak\":0,\"completedLessons\":[],\"lastCompletedDate\":null}"}'::jsonb);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.progress_sync_snapshots WHERE user_id = current_setting('coptic.test_user_a')::uuid) THEN
    RAISE EXCEPTION 'User B can read User A progress';
  END IF;
END $$;

SELECT set_config('request.jwt.claims', json_build_object('sub', :'user_a', 'role', 'authenticated')::text, true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.progress_sync_snapshots WHERE user_id = current_setting('coptic.test_user_b')::uuid) THEN
    RAISE EXCEPTION 'User A can read User B progress';
  END IF;
END $$;

-- The function never accepts a target user ID. Under B's JWT, a revision-zero write
-- can create only B's row; the RLS query above must never expose A's row.
RESET ROLE;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.progress_sync_snapshots;
    RAISE EXCEPTION 'Anonymous table read unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM * FROM public.save_progress_snapshot(0, '{}'::jsonb);
    RAISE EXCEPTION 'Anonymous RPC call unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;
ROLLBACK;
