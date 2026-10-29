# Staging-only validation plan — October 29, 2026

**No application of migrations is authorized by this document.** Read-only staging
inspection is complete; production was not accessed. No data, database grants,
migration ledger, function configuration or deletion enablement was changed.
The dashboard automatically retained a private SQL-editor audit snippet.

## Live staging findings

Project: `neqpcwxlayczgoqnpwyt` (CoptLingo Staging), verified in the dashboard URL
and project heading before executing catalog SELECTs inside `BEGIN READ ONLY`.
The dashboard branch label says main/PRODUCTION even for this staging project;
the **project reference**, not that generic branch label, establishes the target.

| Check | Observed result |
| --- | --- |
| PostgreSQL | 17.11, server_version_num 170011; production owner reports 17.6 |
| Migration ledger | 20261019000000 progress_sync; 20261020000000 progress_sync_rpc_compat; 20261026000000 account_deletion; 20261027000000 account_deletion_production_schema; 20261027120000 account_deletion_required_ownership |
| PR #16 ledger entry | Absent |
| Public tables | Only progress_sync_snapshots and account_deletion_requests; ordinary, postgres-owned, RLS enabled |
| Seven legacy tables | **All absent: 0/7 tables and 0/21 role/table combinations covered** |
| Client role attributes | anon/authenticated are INHERIT, not superuser/BYPASSRLS/CREATEROLE/CREATEDB/REPLICATION; no memberships of these roles in other roles |
| Inbound memberships | authenticator, postgres and supabase_realtime_admin can assume client roles; postgres has admin option. These are the reverse direction from clients inheriting privileges |
| Effective snapshot grants | authenticated SELECT only; anon none; service_role all eight privileges |
| Effective receipt grants | anon/authenticated none; service_role all eight privileges |
| Function ACLs | snapshot RPC and account_allows_storage allow authenticated/service_role; administrative functions exclude clients. Inspected functions have empty search paths |
| Defaults | Broad public defaults for postgres and supabase_admin remain; managed auth/storage/other defaults also exist. PR #16 does not alter any defaults |
| Extensions | plpgsql 1.0; pg_stat_statements 1.11; uuid-ossp 1.1; pgcrypto 1.3; supabase_vault 0.3.1 |

Six enabled platform event triggers were inspected, including their definitions:
`pgrst_ddl_watch`, `pgrst_drop_watch`, `issue_graphql_placeholder`,
`issue_pg_cron_access`, `issue_pg_net_access`, `issue_pg_graphql_access`.
The extension-access triggers are limited to CREATE EXTENSION; the placeholder
trigger to DROP EXTENSION. The PostgREST DDL watcher filters command tags and does
not list GRANT/REVOKE; the drop watcher handles dropped objects. No inspected
definition regrants the seven application-table privileges on REVOKE. This is
read-only inspection, not an executed managed-platform compatibility test.

Auth users.id was observed as non-null UUID. Storage objects metadata exists;
full managed schema/service-version parity, external workers, current locks at
deployment time, backup availability and Auth/Storage HTTP behavior remain to be
validated. Cached CLI metadata (not a live service-version check) reports Auth
v2.197.0, PostgREST v14.18, Storage v1.80.2 and PostgreSQL build 17.11.0.003.

**Do not apply PR #16 to existing staging merely to obtain a green migration.**
It would skip every target table. That would prove only absence-compatible/no-op
behavior. Creating the missing tables in the existing staging project is also a
separate schema deployment and is not proposed as an implicit prerequisite.

## Repeatable read-only capture

Run from the PR #16 checkout. Use PostgreSQL 17 client tools and an owner-configured
libpq service `coptlingo_staging_audit`. Its host/user must resolve exclusively to
the staging reference above, with TLS verification and credentials stored privately
(not command-line passwords or Git). Direct endpoint is
`db.neqpcwxlayczgoqnpwyt.supabase.co`; if using the pooler, independently verify its
project-qualified username. Do not use the repository's mutable link as targeting proof.

```powershell
$auditDir = 'C:\Users\Pompono\Documents\CoptLingo-Audit\staging-before'
New-Item -ItemType Directory -Force $auditDir | Out-Null
$env:PGOPTIONS = '-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=3000'
psql 'service=coptlingo_staging_audit' -X -v ON_ERROR_STOP=1 -f supabase/tests/staging_readonly_inventory.sql -o "$auditDir\inventory.txt"
if ($LASTEXITCODE) { throw 'Stop: staging inventory failed' }
psql 'service=coptlingo_staging_audit' -X -v ON_ERROR_STOP=1 -f supabase/tests/hardening_preflight.sql -o "$auditDir\preflight.txt"
if ($LASTEXITCODE) { throw 'Stop: staging preflight failed' }
```

Expected now: the five migration rows, seven `ABSENT: no hardening coverage`
rows, two public tables and no unexpected client membership. A missing/denied
catalog is UNKNOWN, not an empty inventory. These scripts do not call application
RPCs, inspect user records, repair migration history or perform write probes.

## Backups required before any separately approved hosted change

1. Save the above inventory plus raw ACLs, column ACLs, memberships, default ACLs,
   policies, function definitions/search paths, triggers and the migration ledger.
2. Take a private schema backup including ownership and grants (do not use no-acl):

```powershell
pg_dump 'service=coptlingo_staging_audit' --schema-only --file "$auditDir\schema-before.sql"
if ($LASTEXITCODE) { throw 'Stop: schema backup incomplete' }
pg_dumpall --database='service=coptlingo_staging_audit' --roles-only --no-role-passwords --file "$auditDir\roles-before.sql"
if ($LASTEXITCODE) { throw 'Stop: role backup incomplete or not permitted' }
Get-FileHash "$auditDir\schema-before.sql", "$auditDir\roles-before.sql"
```

Managed permissions may restrict a full role/schema dump: stop and arrange an
owner-supported export; do not call a partial file a complete backup. Confirm a
recent provider backup/PITR restore path and retention rather than assuming the
free-tier project has it. If unavailable, arrange an owner-approved logical data
backup, including Auth and receipt data, and validate restoration in isolation.
Schema backup alone cannot recover deletion of an Auth account. No backups or
exports of live user data were taken during this review. Encrypt and restrict
backup access; never attach dumps, credentials or user records to GitHub.

## Recommended representative environment (requires approval before starting)

Use a **new local Supabase stack**, not either hosted project. It must contain the
actual eight-table public export before PR #15 migrations and PR #16. No production
rows, users, secrets, Auth config, email delivery, remote hooks or jobs are copied.
This stack has real local Auth, PostgREST, Storage and Edge Runtime; it is distinct
from the already-passing network-disabled plain PostgreSQL replay.

Prerequisites: approved/pinned Supabase CLI version, Docker, Node, PostgreSQL 17
client tools, free local ports 54321/54322, dedicated private working directory.
Record the CLI version, image digests and actual server version. Supabase CLI's
Postgres major selection does not guarantee an exact 17.6 managed build. Retain
the existing plain-PostgreSQL 17.6 runs as exact upstream-version evidence and
record any managed-stack differences from staging 17.11. A disposable hosted
Supabase project is an alternative only after explicit creation/cost approval.

The following PowerShell commands are a **review plan, not executed this turn**:

```powershell
$pr15 = 'C:\Users\Pompono\Documents\ChatGPT\Coptic-iOS'
$pr16 = "$pr15\.codex-temp\database-hardening"
$lab = 'C:\Users\Pompono\Documents\CoptLingo-Audit\disposable-supabase-hardening'
if (Test-Path $lab) { throw 'Choose a new empty lab directory; do not reuse live-linked state' }
New-Item -ItemType Directory $lab | Out-Null
Set-Location $lab
# Local fixture setup must not inherit the hosted audit's read-only PGOPTIONS.
Remove-Item Env:PGOPTIONS -ErrorAction SilentlyContinue
supabase --version
supabase init
```

Review local `supabase/config.toml`: unique project_id, database major_version=17,
loopback-only exposed services, local mail sink, no external webhooks/SMTP. Copy
only these reviewed files; never copy `.temp`, remote credentials or link metadata:

```powershell
New-Item -ItemType Directory -Force supabase/migrations | Out-Null
Copy-Item 'C:\Users\Pompono\Documents\CoptLingo-Audit\production-schema.sql' supabase/migrations/20261018000000_private_schema.sql
$five = @('20261019000000_progress_sync.sql','20261020000000_progress_sync_rpc_compat.sql','20261026000000_account_deletion.sql','20261027000000_account_deletion_production_schema.sql','20261027120000_account_deletion_required_ownership.sql')
foreach ($name in $five) { Copy-Item "$pr15\supabase\migrations\$name" supabase/migrations/ }
Copy-Item "$pr15\supabase\functions" supabase/functions -Recurse
supabase start *> "$lab\private-start.log"
if ($LASTEXITCODE) { throw 'Stop and inspect the private startup log' }
$localDb = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
psql $localDb -X -v ON_ERROR_STOP=1 -f "$pr16\supabase\tests\hardening_preflight.sql" -o "$lab\before.txt"
```

Do not use the minimal `hardening_platform.sql` fixture in real Supabase: it would
conflict with managed roles/schemas. If startup fails on managed ownership or DDL,
stop and review; do not strip constraints/policies or change owners to force a pass.
Expected BEFORE: seven target tables, 21 role/table pairs, all eight privileges
for each role, five applied repository migrations plus the private schema baseline.
If the table count is not seven, **stop: no hardening effectiveness test is possible**.

Only after explicit approval of the lab and this migration:

```powershell
Copy-Item "$pr16\supabase\migrations\20261028190000_application_least_privilege.sql" supabase/migrations/
supabase migration up --local
if ($LASTEXITCODE) { throw 'Stop: migration failed; inspect transaction/ledger before retry' }
psql $localDb -X -v ON_ERROR_STOP=1 -f "$pr16\supabase\tests\hardening_preflight.sql" -o "$lab\after.txt"
psql $localDb -X -v ON_ERROR_STOP=1 -f "$pr16\supabase\tests\application_least_privilege.sql"
psql $localDb -X -v ON_ERROR_STOP=1 -f "$pr15\supabase\tests\account_deletion_production_replay.sql"
psql $localDb -X -v ON_ERROR_STOP=1 -f "$pr15\supabase\tests\account_deletion_permissions.sql"
```

Check each exit code; stop on the first error. These SQL tests insert disposable
fixtures inside rolled-back transactions and **must not be run on hosted staging**.
Expected AFTER: anon/authenticated lose four privileges on seven tables (56 effective
role/table/privilege reductions); service_role retains all eight; all existing DML,
column DML, policies, functions, defaults and data remain unchanged. Default ACLs can
still grant broad privileges to future objects: that separate proposal remains deferred.

For reverse-order managed validation, use a second fresh lab: private export plus
the first two snapshot migrations, then PR #16 via local migration up; add the three
PR #15 migrations afterwards. Use `supabase migration up --local --include-all`
only in that disposable lab to apply the deliberately older pending filenames;
never repair a hosted ledger to simulate order. Re-run the same assertions. The
plain PostgreSQL runner already verified both orders at 17.6 and is still available:

```powershell
python "$pr16\scripts\test-database-hardening.py" --schema 'C:\Users\Pompono\Documents\CoptLingo-Audit\production-schema.sql' --postgres-version 17.6 --deletion-source $pr15
python "$pr16\scripts\test-database-hardening.py" --schema 'C:\Users\Pompono\Documents\CoptLingo-Audit\production-schema.sql' --postgres-version 17.6 --deletion-source $pr15 --hardening-first
```

## Managed end-to-end acceptance gate

Before calling this complete, prepare/review a loopback-only API test using the
actual column definitions. **Do not run the existing `account-deletion-integration.mjs`
unchanged**: its `payload` fields, numeric lesson IDs and fixture RPC model the older
synthetic schema, not this export. That adapter remains required and unexecuted.

Use only locally generated keys, never staging/production keys. Configure the
copied local function's verify_jwt=false as in PR #15 (handler still verifies delete
authentication); serve it locally with a private env file containing
ACCOUNT_DELETION_ENABLED=true and ACCOUNT_DELETION_ALLOWED_ORIGINS=capacitor://localhost.
`supabase functions serve account-deletion --env-file <private-local-env-file>` is
local serving, not `functions deploy`. Redirect logs privately and never publish keys.

Acceptance sequence: create two disposable Auth users through local Auth API; sign
in with passwords; seed a shared UUID course/lesson/question and valid rows in each
personal table for both users; sync through the real snapshot RPC; verify cross-user
RLS; reject unauthenticated, wrong-password and supplied-target-ID deletion; delete
only user A through the local function; verify Auth absence, five-table cascade,
receipt recovery, user B/shared content preservation and stale-JWT write rejection.
Check client REINDEX denial and service REINDEX success through local SQL. Then use
an explicitly local-targeted app build for offline progress/recovery preservation,
restart, and new-account transfer-consent checks. No existing hosted deletion switch
is changed. Account-deletion success is not established by a readiness boolean.

## Rollback and stop conditions

- Failed migration: its single DO statement is atomic. Verify no partial ACL changes
  and migration ledger status; do not blindly retry or edit ledger entries.
- Post-commit issue: retain evidence and stop clients. On a disposable lab, rebuild
  from the private export rather than broadening permissions to make tests pass.
- Hosted rollback would require separate approval and a reviewed forward compensation
  restoring **only removed grants actually present in the before snapshot**, including
  grant option/grantor and column REFERENCES where applicable. Do not blanket GRANT
  ALL, change defaults, restore a whole schema over managed objects, or weaken RLS.
- An ACL rollback cannot recover a deleted Auth user or its cascade data; use the
  approved backup/restore plan if such data must be recovered. API deletion tests
  are restricted to the disposable environment for that reason.
- If existing staging later receives the seven tables, take a fresh inventory and
  seek explicit deployment approval. Today's no-op state is not transferable proof.

CLI semantics: [Supabase local workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
and [CLI reference](https://supabase.com/docs/reference/cli/supabase-migration-up).
No `db push`, `link`, `migration repair`, remote reset or hosted deployment command
was run during this inspection.
