-- Run against a disposable PostgreSQL/Supabase database after applying migrations.
-- The surrounding transaction rolls back every snapshot write.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id) VALUES
  ('00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000000b2')
ON CONFLICT (id) DO NOTHING;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

DO $$
DECLARE
  saved record;
  current_row public.progress_sync_snapshots%ROWTYPE;
  old_records jsonb := jsonb_build_object(
    'coptic-progress', '{"xp":33,"streak":2,"completedLessons":["lesson-1"],"lastCompletedDate":"2026-10-19"}',
    'coptic-unit-progress:unit-1', '["lesson-1-a","lesson-1-b"]',
    'coptic-unit-failed-steps:unit-1', '["lesson-1-c"]',
    'coptic-learning:v1', jsonb_build_object('version', 1, 'skills', jsonb_build_object(
      '["ⲙⲁ","bread"]', jsonb_build_object('word','ⲙⲁ','meaning','bread','unitId','unit-1','unitIds',jsonb_build_array('unit-1'),
        'audio','','pos','noun','explanation','','accepted',jsonb_build_array('ⲙⲁ'),'attempts',2,'correct',1,'lapses',1,
        'dueAt',1792440000000,'lastSeen',1792353600000,'successfulDays',1,'lastSuccessfulDay',null,'needsPractice',true))::text,
    'coptic-vocabulary:v1', jsonb_build_object('version', 1, 'cards', jsonb_build_array(jsonb_build_object(
      'id','["bohairic","ⲙⲁ","noun","bread"]','word','ⲙⲁ','meaning','bread','pos','noun','dialect','bohairic',
      'context','ⲙⲁ ⲛ̀ⲟⲩⲱⲙ','source','reader','audio','','createdAt',1792353600000,'dueAt',1792440000000,
      'intervalDays',1,'reviews',2,'lapses',1,'streak',1,'lastReviewedAt',null)))::text,
    'coptic-reader:v1', '{"version":1,"passageId":"custom","draft":"ⲙⲁ ⲛ̀ⲟⲩⲱⲙ"}'
  );
  changed_records jsonb := jsonb_set(old_records, '{coptic-progress}', to_jsonb('{"xp":33.5,"streak":2.5,"completedLessons":["lesson-1"],"lastCompletedDate":"2026-10-19"}'::text));
  large_records jsonb := jsonb_build_object(
    'coptic-progress', '{"xp":33.5,"streak":2.5,"completedLessons":["lesson-1"],"lastCompletedDate":"2026-10-19"}',
    'coptic-learning:v1', jsonb_build_object('version', 1, 'skills', jsonb_build_object(
      'large-practice-record', jsonb_build_object('word','ⲙⲁ','meaning','bread','attempts',2,'correct',1,'lapses',1,
        'dueAt',1792440000000,'lastSeen',1792353600000,'successfulDays',1,'explanation',repeat('x',1048600)))::text
  );
BEGIN
  SELECT * INTO saved FROM public.save_progress_snapshot(0, old_records);
  IF saved.revision <> 1 OR saved.conflict THEN
    RAISE EXCEPTION 'First realistic snapshot did not create revision 1';
  END IF;

  SELECT * INTO saved FROM public.save_progress_snapshot(1, changed_records);
  IF saved.revision <> 2 OR saved.conflict OR saved.records <> changed_records THEN
    RAISE EXCEPTION 'Compare-and-swap update did not return revision 2';
  END IF;

  SELECT * INTO saved FROM public.save_progress_snapshot(1, old_records);
  IF saved.revision <> 2 OR NOT saved.conflict OR saved.records <> changed_records THEN
    RAISE EXCEPTION 'Stale revision did not return the current snapshot unchanged';
  END IF;

  SELECT * INTO saved FROM public.save_progress_snapshot(2, large_records);
  IF saved.revision <> 3 OR saved.conflict OR saved.records <> large_records THEN
    RAISE EXCEPTION 'App-valid progress above the former 1 MiB per-record limit did not sync';
  END IF;

  BEGIN
    PERFORM * FROM public.save_progress_snapshot(3, '{"coptic-progress":"{\"xp\":-1,\"streak\":0,\"completedLessons\":[],\"lastCompletedDate\":null}"}'::jsonb);
    RAISE EXCEPTION 'Malformed records were unexpectedly accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  SELECT * INTO current_row FROM public.progress_sync_snapshots
    WHERE user_id = '00000000-0000-4000-8000-0000000000a1';
  IF current_row.revision <> 3 OR current_row.records <> large_records THEN
    RAISE EXCEPTION 'Rejected write changed the prior cloud snapshot';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
  SELECT * INTO saved FROM public.save_progress_snapshot(1, changed_records);
  IF saved.revision <> 0 OR NOT saved.conflict OR saved.records <> '{}'::jsonb THEN
    RAISE EXCEPTION 'A different account received or overwrote another account snapshot';
  END IF;
  IF EXISTS (SELECT 1 FROM public.progress_sync_snapshots
      WHERE user_id = '00000000-0000-4000-8000-0000000000b2') THEN
    RAISE EXCEPTION 'Cross-account stale write created a snapshot';
  END IF;
END $$;
ROLLBACK;
