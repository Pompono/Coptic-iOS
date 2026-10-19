-- One account-owned progress snapshot. The client uses only the publishable key;
-- auth.uid() and row-level security bind every operation to the signed-in user.
create table if not exists public.progress_sync_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  revision bigint not null check (revision > 0 and revision <= 9007199254740991),
  records jsonb not null check (jsonb_typeof(records) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.progress_sync_snapshots enable row level security;
revoke all on table public.progress_sync_snapshots from anon, authenticated;
grant select on table public.progress_sync_snapshots to authenticated;

drop policy if exists "Users read their own progress snapshot" on public.progress_sync_snapshots;
create policy "Users read their own progress snapshot"
  on public.progress_sync_snapshots for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.save_progress_snapshot(
  p_expected_revision bigint,
  p_records jsonb
)
returns table (revision bigint, records jsonb, updated_at timestamptz, conflict boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
  v_records jsonb;
  v_updated_at timestamptz;
  v_key text;
  v_raw jsonb;
  v_item jsonb;
  v_skill jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;
  if p_expected_revision is null or p_expected_revision < 0
     or p_expected_revision > 9007199254740991 then
    raise exception 'Invalid expected progress revision.' using errcode = '22023';
  end if;
  if p_records is null or jsonb_typeof(p_records) <> 'object'
     or octet_length(p_records::text) > 20971520
     or (select count(*) from jsonb_each(p_records)) > 10000 then
    raise exception 'Invalid or oversized progress snapshot.' using errcode = '22023';
  end if;

  -- Store only local progress records understood by the application. Reject arbitrary keys,
  -- non-string payloads, malformed JSON, and oversized individual records at the trust boundary.
  for v_key in select key from jsonb_each(p_records) loop
    if not (v_key in ('coptic-progress', 'coptic-learning:v1', 'coptic-vocabulary:v1', 'coptic-reader:v1')
        or v_key ~ '^coptic-unit-(progress|failed-steps):[^[:space:]]{1,256}$') then
      raise exception 'Unsupported progress record key.' using errcode = '22023';
    end if;
    if jsonb_typeof(p_records -> v_key) <> 'string'
       or octet_length(p_records ->> v_key) > 1048576 then
      raise exception 'Invalid or oversized progress record.' using errcode = '22023';
    end if;
    begin
      v_raw := (p_records ->> v_key)::jsonb;
    exception when others then
      raise exception 'Malformed progress record.' using errcode = '22023';
    end;
    if v_key = 'coptic-progress' then
      if jsonb_typeof(v_raw) <> 'object'
         or jsonb_typeof(v_raw -> 'xp') is distinct from 'number'
         or jsonb_typeof(v_raw -> 'streak') is distinct from 'number'
         or jsonb_typeof(v_raw -> 'completedLessons') is distinct from 'array'
         or not (v_raw ? 'lastCompletedDate')
         or (v_raw -> 'lastCompletedDate' <> 'null'::jsonb and
             (jsonb_typeof(v_raw -> 'lastCompletedDate') is distinct from 'string'
              or (v_raw ->> 'lastCompletedDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')) then
        raise exception 'Invalid progress totals record.' using errcode = '22023';
      end if;
      if (v_raw ->> 'xp')::numeric < 0 or trunc((v_raw ->> 'xp')::numeric) <> (v_raw ->> 'xp')::numeric
         or (v_raw ->> 'streak')::numeric < 0 or trunc((v_raw ->> 'streak')::numeric) <> (v_raw ->> 'streak')::numeric
         or exists (select 1 from jsonb_array_elements(v_raw -> 'completedLessons') as lesson(value) where jsonb_typeof(lesson.value) <> 'string') then
        raise exception 'Invalid progress totals record.' using errcode = '22023';
      end if;
    elsif v_key = 'coptic-reader:v1' then
      if jsonb_typeof(v_raw) <> 'object' or v_raw -> 'version' <> '1'::jsonb
         or jsonb_typeof(v_raw -> 'passageId') is distinct from 'string'
         or jsonb_typeof(v_raw -> 'draft') is distinct from 'string'
         or length(v_raw ->> 'draft') > 6000 then
        raise exception 'Invalid saved reader record.' using errcode = '22023';
      end if;
    elsif v_key = 'coptic-learning:v1' then
      if jsonb_typeof(v_raw) is distinct from 'object' or v_raw -> 'version' is distinct from '1'::jsonb
         or jsonb_typeof(v_raw -> 'skills') is distinct from 'object' then
        raise exception 'Invalid practice record.' using errcode = '22023';
      end if;
      for v_skill in select value from jsonb_each(v_raw -> 'skills') loop
        if jsonb_typeof(v_skill) is distinct from 'object' or jsonb_typeof(v_skill -> 'word') is distinct from 'string'
           or jsonb_typeof(v_skill -> 'meaning') is distinct from 'string'
           or exists (select 1 from unnest(array['unitId','audio','pos','explanation']) as field(name)
             where v_skill ? field.name and jsonb_typeof(v_skill -> field.name) is distinct from 'string')
           or exists (select 1 from unnest(array['unitIds','accepted']) as field(name)
             where v_skill ? field.name and (jsonb_typeof(v_skill -> field.name) is distinct from 'array'
               or exists (select 1 from jsonb_array_elements(v_skill -> field.name) as item(value) where jsonb_typeof(item.value) is distinct from 'string')))
           or (v_skill ? 'needsPractice' and jsonb_typeof(v_skill -> 'needsPractice') is distinct from 'boolean')
           or (v_skill ? 'lastSuccessfulDay' and v_skill -> 'lastSuccessfulDay' <> 'null'::jsonb
             and (jsonb_typeof(v_skill -> 'lastSuccessfulDay') is distinct from 'number'
               or (v_skill ->> 'lastSuccessfulDay')::numeric < 0))
           or exists (select 1 from unnest(array['attempts','correct','lapses','dueAt','lastSeen','successfulDays']) as field(name)
             where jsonb_typeof(v_skill -> field.name) is distinct from 'number'
                or (v_skill ->> field.name)::numeric < 0) then
          raise exception 'Invalid practice skill.' using errcode = '22023';
        end if;
      end loop;
    elsif v_key = 'coptic-vocabulary:v1' then
      if jsonb_typeof(v_raw) is distinct from 'object' or v_raw -> 'version' is distinct from '1'::jsonb
         or jsonb_typeof(v_raw -> 'cards') is distinct from 'array' then
        raise exception 'Invalid vocabulary record.' using errcode = '22023';
      end if;
      for v_item in select value from jsonb_array_elements(v_raw -> 'cards') loop
        if jsonb_typeof(v_item) is distinct from 'object' or jsonb_typeof(v_item -> 'id') is distinct from 'string'
           or jsonb_typeof(v_item -> 'word') is distinct from 'string' or length(btrim(v_item ->> 'word')) = 0
           or jsonb_typeof(v_item -> 'meaning') is distinct from 'string' or length(btrim(v_item ->> 'meaning')) = 0
           or exists (select 1 from unnest(array['pos','dialect','context','source','audio']) as field(name)
             where v_item ? field.name and jsonb_typeof(v_item -> field.name) is distinct from 'string')
           or (v_item ? 'lastReviewedAt' and v_item -> 'lastReviewedAt' <> 'null'::jsonb
             and (jsonb_typeof(v_item -> 'lastReviewedAt') is distinct from 'number'
               or (v_item ->> 'lastReviewedAt')::numeric < 0))
           or exists (select 1 from unnest(array['createdAt','dueAt','intervalDays','reviews','lapses','streak']) as field(name)
             where jsonb_typeof(v_item -> field.name) is distinct from 'number'
                or (v_item ->> field.name)::numeric < 0) then
          raise exception 'Invalid vocabulary card.' using errcode = '22023';
        end if;
      end loop;
      if exists (select 1 from jsonb_array_elements(v_raw -> 'cards') as card(value)
        group by card.value ->> 'id' having count(*) > 1) then
        raise exception 'Duplicate vocabulary card ID.' using errcode = '22023';
      end if;
    else
      if jsonb_typeof(v_raw) is distinct from 'array'
         or exists (select 1 from jsonb_array_elements(v_raw) as step(value) where jsonb_typeof(step.value) is distinct from 'string') then
        raise exception 'Invalid lesson progress record.' using errcode = '22023';
      end if;
    end if;
  end loop;

  select snapshot.revision, snapshot.records, snapshot.updated_at
    into v_revision, v_records, v_updated_at
    from public.progress_sync_snapshots as snapshot
    where snapshot.user_id = v_user_id
    for update;

  if not found then
    if p_expected_revision <> 0 then
      return query select 0::bigint, '{}'::jsonb, null::timestamptz, true;
      return;
    end if;
    begin
      insert into public.progress_sync_snapshots (user_id, revision, records, updated_at)
        values (v_user_id, 1, p_records, clock_timestamp())
        returning progress_sync_snapshots.revision, progress_sync_snapshots.records,
                  progress_sync_snapshots.updated_at
          into v_revision, v_records, v_updated_at;
    exception when unique_violation then
      select snapshot.revision, snapshot.records, snapshot.updated_at
        into v_revision, v_records, v_updated_at
        from public.progress_sync_snapshots as snapshot
        where snapshot.user_id = v_user_id;
      return query select v_revision, v_records, v_updated_at, true;
      return;
    end;
    return query select v_revision, v_records, v_updated_at, false;
    return;
  end if;

  if v_revision <> p_expected_revision then
    return query select v_revision, v_records, v_updated_at, true;
    return;
  end if;

  if v_revision >= 9007199254740991 then
    raise exception 'Progress revision limit reached.' using errcode = '22003';
  end if;

  update public.progress_sync_snapshots as snapshot
    set revision = snapshot.revision + 1,
        records = p_records,
        updated_at = clock_timestamp()
    where snapshot.user_id = v_user_id
    returning snapshot.revision, snapshot.records, snapshot.updated_at
      into v_revision, v_records, v_updated_at;

  return query select v_revision, v_records, v_updated_at, false;
end;
$$;

revoke all on function public.save_progress_snapshot(bigint, jsonb) from public, anon;
grant execute on function public.save_progress_snapshot(bigint, jsonb) to authenticated;
