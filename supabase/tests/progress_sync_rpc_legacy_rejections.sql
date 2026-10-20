-- Run only against the disposable PostgreSQL job after applying the original
-- Phase 2B migration and before the compatibility correction.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id) VALUES ('00000000-0000-4000-8000-0000000000a1')
ON CONFLICT (id) DO NOTHING;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.save_progress_snapshot(0,
      '{"coptic-progress":"{\"xp\":0.5,\"streak\":0.5,\"completedLessons\":[],\"lastCompletedDate\":null}"}'::jsonb);
    RAISE EXCEPTION 'Original RPC unexpectedly accepted fractional totals';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  BEGIN
    PERFORM * FROM public.save_progress_snapshot(0, jsonb_build_object(
      'coptic-learning:v1', jsonb_build_object('version', 1, 'skills', jsonb_build_object(
        'large-practice-record', jsonb_build_object('word','ⲙⲁ','meaning','bread','attempts',1,'correct',1,
          'lapses',0,'dueAt',1792440000000,'lastSeen',1792353600000,'successfulDays',1,
          'explanation',repeat('x',1048600))))::text));
    RAISE EXCEPTION 'Original RPC unexpectedly accepted an app-valid record over 1 MiB';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  IF EXISTS (SELECT 1 FROM public.progress_sync_snapshots
      WHERE user_id = '00000000-0000-4000-8000-0000000000a1') THEN
    RAISE EXCEPTION 'Rejected first uploads unexpectedly created a cloud snapshot';
  END IF;
END $$;
ROLLBACK;
