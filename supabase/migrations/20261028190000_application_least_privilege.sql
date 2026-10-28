-- Separate forward hardening; compatible with or without account-deletion PR #15.
-- No data, RLS policies, existing functions, managed schemas or service grants change.
-- One statement: unsafe inheritance/ownership or remaining effective privileges
-- abort every existing-table revoke atomically. Do not repair roles implicitly.
do $hardening$
declare t text; r text; c text; permission text; relation_id oid;
begin
  foreach r in array array['anon','authenticated'] loop
    if not exists(select 1 from pg_roles where rolname=r)
      or exists(select 1 from pg_roles where rolname=r and
        (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolreplication))
      or exists(select 1 from pg_auth_members m join pg_roles member on member.oid=m.member
        where member.rolname=r) then
      raise exception 'Client role % has missing/unsafe attributes or inherited/SET ROLE membership; audit before hardening',r;
    end if;
  end loop;
  foreach t in array array['courses','lessons','questions','reviews','streaks','user_progress','xp_events'] loop
    relation_id := to_regclass(format('public.%I',t));
    if relation_id is null then continue; end if;
    if not exists(select 1 from pg_class where oid=relation_id and relkind='r'
      and relrowsecurity and relowner='postgres'::regrole) then
      raise exception 'Unexpected owner/type/RLS on public.%',t;
    end if;
    -- Preserve existing DML until older clients/website/external writers are audited.
    execute format('revoke truncate, references, trigger on table public.%I from public, anon, authenticated',t);
    -- Table revokes do not remove independently granted column privileges.
    for c in select attname from pg_attribute where attrelid=relation_id and attnum>0 and not attisdropped loop
      execute format('revoke references (%I) on table public.%I from public, anon, authenticated',c,t);
    end loop;
    foreach r in array array['anon','authenticated'] loop
      foreach permission in array array['TRUNCATE','REFERENCES','TRIGGER'] loop
        if has_table_privilege(r,relation_id,permission) then raise exception 'Remaining effective % on % for %',permission,t,r; end if;
        if permission='REFERENCES' and has_any_column_privilege(r,relation_id,permission) then
          raise exception 'Remaining column % on % for %',permission,t,r;
        end if;
      end loop;
    end loop;
  end loop;
end $hardening$;
