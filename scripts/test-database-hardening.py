"""Private actual-schema replay in PostgreSQL 16 with Docker --network none.

No live URL, mounts, host ports or credentials. Optional --deletion-source points
to a LOCAL checkout of PR #15, never a deployed database. Export is not copied.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--schema', required=True, type=Path)
    parser.add_argument('--deletion-source', type=Path)
    parser.add_argument('--hardening-first', action='store_true', help='Apply optional PR #15 migrations after hardening')
    args = parser.parse_args()
    paths = [ROOT/'supabase/tests/hardening_platform.sql', args.schema]
    paths += sorted((ROOT/'supabase/migrations').glob('20261019*.sql'))
    paths += sorted((ROOT/'supabase/migrations').glob('20261020*.sql'))
    if args.deletion_source:
        paths += [args.deletion_source/'supabase/migrations'/name for name in [
            '20261026000000_account_deletion.sql', '20261027000000_account_deletion_production_schema.sql',
            '20261027120000_account_deletion_required_ownership.sql']]
    migration = ROOT/'supabase/migrations/20261028190000_application_least_privilege.sql'
    tests = [ROOT/'supabase/tests/application_least_privilege.sql']
    if args.deletion_source:
        tests += [args.deletion_source/'supabase/tests'/name for name in [
            'account_deletion_production_replay.sql', 'account_deletion_permissions.sql', 'account_deletion.sql']]
    data = {p: p.read_bytes() for p in paths + [migration] + tests}
    deferred = paths[-3:] if args.deletion_source and args.hardening_first else []
    if deferred: paths = paths[:-3]
    report_dir = ROOT/'.private-schema-audit'/uuid.uuid4().hex
    report_dir.mkdir(parents=True)
    report = {'status': 'incomplete', 'network': 'none', 'deletion_compatibility': bool(args.deletion_source),
              'hardening_first': bool(deferred),
              'inputs': [{'name': p.name, 'sha256': hashlib.sha256(b).hexdigest()} for p, b in data.items()]}
    container = None

    def command(cmd, source=None, check=True):
        result = subprocess.run(cmd, input=source, capture_output=True, timeout=300)
        if check and result.returncode:
            (report_dir/'failure.log').write_bytes(result.stdout + result.stderr)
            raise RuntimeError(f'Isolated SQL/command failed; private diagnostics: {report_dir}')
        return result

    def sql(source):
        return command(['docker', 'exec', '-i', container, 'psql', '-X', '-U', 'postgres',
                        '-v', 'ON_ERROR_STOP=1'], source)

    try:
        container = command(['docker', 'run', '-d', '--network', 'none', '--cap-drop', 'ALL',
            '--cap-add', 'CHOWN', '--cap-add', 'DAC_OVERRIDE', '--cap-add', 'FOWNER', '--cap-add', 'SETGID',
            '--cap-add', 'SETUID', '--security-opt', 'no-new-privileges', '--tmpfs', '/var/lib/postgresql/data',
            '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16']).stdout.decode().strip()
        if not re.fullmatch('[0-9a-f]{64}', container):
            container = None
            raise RuntimeError('Invalid container ID')
        report['image'] = command(['docker','inspect','--format','{{.Image}}',container]).stdout.decode().strip()
        deadline = time.monotonic()+90
        while command(['docker','exec',container,'pg_isready','-h','127.0.0.1','-U','postgres'],check=False).returncode:
            if time.monotonic()>deadline: raise RuntimeError('PostgreSQL startup timeout')
            time.sleep(.5)
        for path in paths: sql(data[path])
        invariant_query = """select json_build_object(
          'functions',(select json_agg(x order by oid) from (select oid,proacl,pg_get_functiondef(oid) as definition
            from pg_proc where pronamespace in ('public'::regnamespace,'auth'::regnamespace,'storage'::regnamespace)) x),
          'policies',(select json_agg(x order by oid) from pg_policy x),
          'constraints',(select json_agg(x order by oid) from pg_constraint x))"""
        def invariants():
            return command(['docker','exec',container,'psql','-XqAt','-U','postgres','-c',invariant_query]).stdout
        before = invariants()
        # Membership permits inheritance or SET ROLE. Fail without silently editing roles.
        sql(("begin; create role hardening_parent; grant hardening_parent to authenticated; "
             "do $probe$ begin begin execute $migration$" + data[migration].decode() +
             "$migration$; raise exception 'Expected unsafe membership rejection'; "
             "exception when raise_exception then if sqlerrm not like 'Client role %' then raise; end if; end; "
             "if not has_table_privilege('authenticated','public.reviews','TRUNCATE') then "
             "raise exception 'Failed migration changed privileges'; end if; end $probe$; rollback;").encode())
        # Fail on the last table, after earlier revokes, and prove statement atomicity.
        sql(("begin; create role hardening_wrong_owner; alter table public.xp_events owner to hardening_wrong_owner; "
             "do $probe$ begin begin execute $migration$" + data[migration].decode() +
             "$migration$; raise exception 'Expected incompatible owner rejection'; "
             "exception when raise_exception then if sqlerrm not like 'Unexpected owner/type/RLS%' then raise; end if; end; "
             "if not has_table_privilege('anon','public.courses','TRUNCATE') then "
             "raise exception 'Partial table revokes survived failure'; end if; end $probe$; rollback;").encode())
        # Column ACLs are independent from table ACLs: ensure they cannot survive.
        sql(b'grant select (title) on public.courses to authenticated; grant references (key) on public.reviews to authenticated;')
        sql(data[migration])
        sql(data[migration])  # idempotent, including default privilege changes
        if before != invariants(): raise RuntimeError('Existing function definitions/grants, policies or constraints changed')
        for path in deferred: sql(data[path])
        for path in tests: sql(data[path])
        report['status'] = 'passed'
        print(json.dumps({'status':'passed','report':str(report_dir/'report.json')}))
    finally:
        (report_dir/'report.json').write_text(json.dumps(report,indent=2))
        if container: command(['docker','rm','--force',container])


if __name__ == '__main__':
    main()
