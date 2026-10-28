-- After an intentionally rejected migration, prove atomic rollback and no data
-- repair/deletion. Only this disposable fixture removes its own sentinel.
do $$ declare t text; begin
  foreach t in array array['reviews', 'xp_events'] loop
    if (select attnotnull from pg_attribute where attrelid = format('public.%I', t)::regclass
      and attname = 'user_id') then raise exception 'Failed migration left partial change: %', t; end if;
  end loop;
  if (select count(*) from public.xp_events where user_id is null and payload = 'preexisting-unowned') <> 1 then
    raise exception 'Migration changed the unowned sentinel';
  end if;
end $$;
delete from public.xp_events where user_id is null and payload = 'preexisting-unowned';
