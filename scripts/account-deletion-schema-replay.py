"""Replay a supplied schema-only export in disposable, network-isolated PostgreSQL.

No database URL, Supabase link, host port, credential, or host mount is accepted.
Schema-specific seed/assertion SQL must be supplied separately; this runner never
invents production definitions. SQL and diagnostics remain private/local.
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
MIGRATIONS = [
    "20261019000000_progress_sync.sql",
    "20261020000000_progress_sync_rpc_compat.sql",
    "20261026000000_account_deletion.sql",
    "20261027000000_account_deletion_production_schema.sql",
    "20261027120000_account_deletion_required_ownership.sql",
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--schema", type=Path, required=True, help="Private schema-only application DDL export")
    parser.add_argument("--test", type=Path, action="append", required=True,
                        help="Reviewed disposable seed/assertion SQL; repeat to run multiple files")
    parser.add_argument("--synthetic", action="store_true", help="Label a harness self-test; never production evidence")
    parser.add_argument("--production-checks", action="store_true",
                        help="Exercise ownership rollback and concurrent writes using audited production columns")
    args = parser.parse_args()
    sources = [ROOT / "supabase/tests/schema_replay_platform.sql", args.schema,
               *[ROOT / "supabase/migrations" / name for name in MIGRATIONS], *args.test]
    # Fail before starting any infrastructure if evidence/test inputs are missing.
    contents = [path.read_bytes() for path in sources]
    report_dir = ROOT / ".private-schema-audit" / uuid.uuid4().hex
    report_dir.mkdir(parents=True)
    manifest = {"synthetic": args.synthetic, "network": "none", "managed_platform": "minimal PostgreSQL fixture",
                "inputs": [{"name": path.name, "sha256": hashlib.sha256(data).hexdigest()}
                           for path, data in zip(sources, contents)], "status": "incomplete"}
    container = None
    stage = "container startup"
    original_constraints = None

    def command(arguments, data=None, timeout=120, check=True):
        result = subprocess.run(arguments, input=data, capture_output=True, timeout=timeout)
        if result.returncode and check:
            (report_dir / "failure.log").write_bytes(result.stdout + result.stderr)
            raise RuntimeError(f"{stage} failed; private diagnostics: {report_dir / 'failure.log'}")
        return result

    try:
        # No host binds/volumes, ports or Docker socket. Untrusted dump functions
        # and psql meta-commands cannot contact either live Supabase project.
        result = command(["docker", "run", "--detach", "--network", "none", "--cap-drop", "ALL",
                          "--cap-add", "CHOWN", "--cap-add", "DAC_OVERRIDE", "--cap-add", "FOWNER",
                          "--cap-add", "SETGID", "--cap-add", "SETUID", "--security-opt", "no-new-privileges",
                          "--tmpfs", "/var/lib/postgresql/data", "--env", "POSTGRES_HOST_AUTH_METHOD=trust",
                          "postgres:16"], timeout=300)
        container = result.stdout.decode().strip()
        if not re.fullmatch(r"[0-9a-f]{64}", container):
            container = None
            raise RuntimeError("Docker returned an invalid container identifier")
        manifest["image_id"] = command(["docker", "inspect", "--format", "{{.Image}}", container]).stdout.decode().strip()
        deadline = time.monotonic() + 90
        # The image's initdb server accepts Unix sockets before initialization
        # finishes. Only the final server listens on container-local TCP.
        while command(["docker", "exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], check=False).returncode:
            if time.monotonic() >= deadline:
                raise RuntimeError("Disposable PostgreSQL did not become ready")
            time.sleep(0.5)
        for index, (path, data) in enumerate(zip(sources, contents)):
            stage = f"SQL input {index + 1}: {path.name}"
            if args.production_checks and path.name == MIGRATIONS[-1]:
                # The second table fails after the first ALTER has run. Catching
                # the exception must roll back BOTH changes, without repairing data.
                probe = """begin;
alter table public.xp_events disable trigger account_deletion_application_guard;
insert into public.xp_events(amount,reason) values (1,'isolated rollback probe');
do $probe$ begin
  begin
    execute $migration$%s$migration$;
    raise exception 'Expected ownership migration rejection';
  exception when not_null_violation then null; end;
  if exists(select 1 from pg_attribute where attrelid in
    ('public.reviews'::regclass,'public.xp_events'::regclass)
    and attname='user_id' and attnotnull) then raise exception 'Partial ownership migration'; end if;
  if not exists(select 1 from public.xp_events where user_id is null) then
    raise exception 'Unowned data changed'; end if;
end $probe$; rollback;""" % data.decode()
                command(["docker", "exec", "-i", container, "psql", "-X", "-U", "postgres",
                         "--set", "ON_ERROR_STOP=1"], data=probe.encode())
            command(["docker", "exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres",
                     "--set", "ON_ERROR_STOP=1"], data=data)
            if index == 1:
                original_constraints = command(["docker", "exec", container, "psql", "-XqAt", "-U", "postgres",
                    "-c", "select coalesce(json_agg(x),'[]') from (select conrelid::regclass::text as relation, "
                    "conname, pg_get_constraintdef(oid) as definition from pg_constraint "
                    "where connamespace='public'::regnamespace order by conrelid::regclass::text,conname) x"]).stdout
        if args.production_checks:
            stage = "original production constraint preservation"
            constraints = command(["docker", "exec", container, "psql", "-XqAt", "-U", "postgres",
                "-c", "select coalesce(json_agg(x),'[]') from (select conrelid::regclass::text as relation, "
                "conname, pg_get_constraintdef(oid) as definition from pg_constraint "
                "where connamespace='public'::regnamespace order by conrelid::regclass::text,conname) x"]).stdout
            original = json.loads(original_constraints)
            current = json.loads(constraints)
            if not all(item in current for item in original):
                raise RuntimeError("An original production constraint was changed or removed")
            manifest["original_constraints_preserved"] = len(original)
            stage = "production-column concurrent writes"
            from account_deletion_replay_races import run
            run(container)
            manifest["ownership_rollback_and_concurrency"] = "passed"
        manifest["status"] = "passed"
        print(json.dumps({"status": "passed", "synthetic": args.synthetic, "report": str(report_dir / 'report.json')}))
    finally:
        (report_dir / "report.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        if container:
            subprocess.run(["docker", "rm", "--force", container], capture_output=True, timeout=60, check=True)


if __name__ == "__main__":
    main()
