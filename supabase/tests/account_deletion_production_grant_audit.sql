-- Diagnostic reproduction of unsafe grants in the 2026-10-28 private export.
-- Passing this probe means the vulnerability EXISTS, not that deployment is safe.
-- Disposable database only; every destructive probe is rolled back.
begin;
insert into public.courses(slug,title) values ('truncate-audit','Disposable audit');
set local role anon;
truncate public.courses cascade;
reset role;
do $$ begin
  if exists(select 1 from public.courses where slug='truncate-audit') then
    raise exception 'TRUNCATE finding no longer reproduces; update audit'; end if;
end $$;
rollback;
begin;
-- Production default function privileges are inherited by newly created RPCs.
create function public.deletion_audit_default_grant() returns boolean language sql as 'select true';
do $$ begin
  if not has_function_privilege('anon','public.deletion_audit_default_grant()','EXECUTE') then
    raise exception 'Default function grant finding no longer reproduces'; end if;
end $$;
rollback;
