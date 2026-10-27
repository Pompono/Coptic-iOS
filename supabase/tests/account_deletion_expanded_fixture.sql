-- SYNTHETIC disposable fixture, NOT a production schema dump or migration.
-- CI installs this before the forward migration to model existing tables.
create table public.courses(id bigint primary key);
create table public.lessons(id bigint primary key, course_id bigint references public.courses);
create table public.questions(id bigint primary key, lesson_id bigint references public.lessons);
insert into public.courses values (1);
insert into public.lessons values (1, 1);
insert into public.questions values (1, 1);
do $$ declare t text; begin
  foreach t in array array['reviews', 'streaks', 'user_progress', 'xp_events'] loop
    execute format('create table public.%I (user_id uuid not null references auth.users(id) on delete cascade,
      lesson_id bigint references public.lessons, payload text, primary key (user_id))', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy fixture_owner on public.%I for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant select on public.courses, public.lessons, public.questions to service_role;
-- Models an owner-privileged legacy RPC: RLS bypass must not bypass the guard.
create function public.fixture_write_review(p_user_id uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.reviews(user_id, lesson_id, payload) values(p_user_id, 1, 'rpc')
  on conflict(user_id) do update set payload = excluded.payload;
$$;
revoke all on function public.fixture_write_review(uuid) from public;
grant execute on function public.fixture_write_review(uuid) to service_role;
