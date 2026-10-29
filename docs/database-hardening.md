# Proposed application database privilege hardening

Latest: [October 29 read-only staging findings and validation procedure](staging-hardening-validation.md).
Staging has **zero of the seven target tables**: applying this migration there
would not validate privilege reduction. No staging migration was applied.

Status: proposed, not deployed. Separate from account-deletion PR #15 because this
changes privileges on seven existing application tables only. It can be reviewed and
applied independently; no earlier migration is rewritten. No live Supabase project
was accessed. Source: owner's private 20,297-byte public-schema export, SHA-256
`e037c1e8d6dcd572d4c4b731f059dc7e49e0a317c9f6340732a0025c69ea02f2`.
The dump and local diagnostics are not committed.

## Exact proposed changes

Forward migration `20261028190000_application_least_privilege.sql` reduces grants:

| Object | anon / PUBLIC | authenticated | service_role / owner |
| --- | --- | --- | --- |
| courses, lessons, questions, reviews, streaks, user_progress, xp_events | Revoke TRUNCATE, REFERENCES, TRIGGER, MAINTAIN (PostgreSQL 17+) and column REFERENCES; preserve existing SELECT/INSERT/UPDATE/DELETE | Same: preserve all existing DML pending dependency inventory | Unchanged |
| progress_sync_snapshots | Unchanged | Existing SELECT plus snapshot RPC unchanged | Unchanged |
| Existing functions, deletion receipts, Auth/Storage objects | Unchanged | Unchanged | Unchanged |

No new grants or policies are added. No data, indexes, constraints, function bodies,
search paths or auth/session/progress application code changes. Foreign-key cascades
do not require end-user DELETE grants. Missing legacy application tables are skipped
for environments containing only snapshots. Existing tables must be ordinary,
postgres-owned and RLS-enabled; incompatible shapes abort the statement.

The current seven-table `ALL` grants include operations RLS cannot protect, notably
TRUNCATE. MAINTAIN additionally permits maintenance operations on PostgreSQL 17+. DELETE has no permissive policy on these seven tables in the supplied
export; xp_events also has no UPDATE policy. However, the owner explicitly confirmed
that older clients, the website, backend services and external integrations remain
unverified. **Existing SELECT/INSERT/UPDATE/DELETE table and column grants are
therefore preserved**, including grants not exercised by current repository code.
This is an initial hardening step, not a claim that all retained access is necessary.
After the dependency inventory, a separately reviewed change can remove unused DML
grants. REFERENCES/TRIGGER are schema-management privileges, not normal API data
operations; deployment still requires confirming no client-role DDL tooling needs them.

## Defaults and role inheritance

**No default privileges change in the deployable migration.** Existing and future
function EXECUTE permissions, table defaults and sequence defaults remain identical.
The broader SQL is retained only in `docs/proposals/postgres-default-privileges.sql`,
outside `supabase/migrations` and outside all replay execution paths. It is not part
of this rollout and needs a separate approval/migration after managed Auth, Storage,
extensions and future non-public function compatibility is verified.

That deferred proposal removes client/PUBLIC defaults globally and in public for
postgres-created objects. PostgreSQL global and schema-specific defaults are additive;
a schema-only revoke cannot cancel built-in global PUBLIC EXECUTE. This global effect
is precisely why the proposal is deferred. Current broad defaults therefore remain a
known risk for future objects; authors should review explicit grants in new migrations.

The export does not include role definitions/memberships. The migration refuses to
proceed if anon/authenticated are superusers, BYPASSRLS, CREATEROLE, CREATEDB,
REPLICATION, or members of any other role (including NOINHERIT memberships that may
permit SET ROLE). It does not revoke membership automatically. After reductions it
checks effective table and column privileges; an unexpected remaining privilege
aborts the entire statement. Membership of the gateway/authenticator **in** a client
role is distinct from the client role itself inheriting another role, and is not
removed. The read-only checks below distinguish these directions explicitly.

## Content access and function audit

Repository inspection found Supabase application data reads only in
`lib/progressSync.ts` against snapshots, with writes through
`save_progress_snapshot(bigint,jsonb)`. Lessons/exercises are bundled in repository
content; no courses/lessons/questions client query or personal-table writer was
found in app/lib/backend. The shared tables have RLS enabled and no policies in the
export, so their broad SELECT grants do not currently make rows visible to ordinary
clients. **No new SELECT policies are proposed.** Confirm older apps, external
dashboards and a future database-hosted content plan before deployment; adding a
public content policy would be a separate intentional disclosure decision.

The export's only public function is the postgres-owned SECURITY DEFINER snapshot
RPC, with an empty search path, auth.uid()-derived ownership, validated JSON and
snapshot-only writes. It is executable by authenticated/service_role, not anon or
PUBLIC. Its grants and definition remain identical. With PR #15 applied, existing
administrative functions remain client-inaccessible, the policy helper stays
available to authenticated, and service deletion keeps its existing privileges.
Existing unknown functions are not blanket-revoked; audit their effective privileges
and definitions if the deployed inventory differs.

## Isolated validation

From this checkout, Docker Desktop/Engine and Python 3 are required:

```sh
python scripts/test-database-hardening.py --schema /private/production-schema.sql
python scripts/test-database-hardening.py --schema /private/production-schema.sql \
  --deletion-source /local/checkout/of/PR-15
python scripts/test-database-hardening.py --schema /private/production-schema.sql \
  --deletion-source /local/checkout/of/PR-15 --hardening-first
```

The runner reads the private export unchanged, starts the selected PostgreSQL version (default 17.6) with
`--network none`, no published ports or host mounts, and removes the container.
Reports contain input hashes and image ID under ignored `.private-schema-audit/`;
SQL errors remain local. Docker may pull the image; the database cannot reach live
Supabase. Auth/Storage are labeled minimal fixtures, not deployed managed schemas.
No real users or production rows are imported. Tests are deliberately not fed a
reconstructed schema and the private dump is never uploaded to CI.

Tests cover exact table privilege matrices, separately granted column ACLs,
anonymous/authenticated TRUNCATE rejection, preserved DELETE grants and unchanged
RLS denial of row deletion, retained owner operations,
snapshot read/RPC, unchanged future table/sequence/function grants and service defaults,
membership rejection, rollback after a late-table incompatibility, idempotent reapplication, and unchanged
existing function definitions/grants, RLS policies, constraints and the full default-ACL catalog. The optional
PR #15 path also runs populated production-shaped cascades/shared-content checks,
stale-user/ownership/privileged-write fences and administrative permission tests.

Local actual-export runs passed standalone, after PR #15, and before PR #15. Both
migration orders preserve the deletion regression suite. These are local PostgreSQL
results, not production/staging deployment or managed Auth HTTP end-to-end evidence.
Use `supabase/tests/hardening_inventory.sql` for the owner's separate read-only
metadata review; it is not executed against a live project by these tests.

## Minimum read-only checks for the narrower migration

Run `supabase/tests/hardening_preflight.sql` through an owner-approved read-only
connection and retain the output privately. No production connection is made by this PR.

1. Record `version()` and `server_version_num`, then confirm all seven exact target names still resolve to ordinary postgres-owned,
   RLS-enabled tables. The migration permits absent tables for staging compatibility;
   production approval must explicitly confirm all seven are present.
2. Confirm anon/authenticated exist, have no superuser/BYPASSRLS/CREATEROLE/CREATEDB/
   REPLICATION flags and are not members of another role. Inspect inbound memberships
   too to identify who can assume these roles; those are not automatically rejected.
   The migration does not silently alter memberships or role attributes.
3. Capture raw table/column ACLs and effective privileges for anon/authenticated and
   service_role. Review PUBLIC grants: revoking PUBLIC schema privileges can also
   affect other roles relying on those grants. Confirm the intended revoked privilege
   sources are direct/PUBLIC and there are no inherited or column-level bypasses.
4. Capture baseline SELECT/INSERT/UPDATE/DELETE grants, owner RLS policies, snapshot
   RPC owner/search path/EXECUTE ACL and default ACLs for a before/after comparison.
   These are preservation checks, not a prerequisite to redesign defaults or managed
   functions. Other schemas' function bodies and managed extension compatibility do
   not block this table-only change merely because the deferred proposal needs them.
5. Identify any event triggers on DDL/grant/revoke operations and review their enabled
   definitions privately before approval; metadata changes could invoke deployed
   automation absent from the schema export. Check active locks/long transactions
   on target tables when selecting the execution window.

Metadata cannot prove that an external process never uses TRUNCATE or creates FKs/
triggers under a client role. Obtain the owner's confirmation that such schema/admin
operations are not required by client-role tooling. Older-client/website/backend
**DML** dependencies remain unverified but their permissions are preserved; completing
that broad inventory is required before any further DML reduction or shared-content
policy change, not before approving an unchanged DML grant set.

The deferred defaults proposal separately needs all creator-role default ACLs and
managed Auth/Storage/extension/future-function compatibility review. Account deletion
still has PR #15's independent deployment and acceptance gates. Approval of this
narrower migration does not approve that feature or the deferred proposal.

Owner approval and a separate deployment operation are required. Do not deploy,
merge or enable deletion on the strength of this proposal alone. If rollback is
needed, restore only specifically reviewed grants from a private pre-deployment ACL
snapshot; do not blindly restore the unsafe ALL grants/defaults.


## MAINTAIN follow-up — October 29

The owner's complete audit reports 21 explicit role/table grant combinations: all
seven tables grant all eight privileges, including MAINTAIN, to anon, authenticated
and service_role, with no PUBLIC grants. On PostgreSQL 17+, the same migration now
revokes MAINTAIN from the client roles (and defensively PUBLIC) and verifies effective
denial, while preserving service_role. It skips this nonexistent privilege on 16.
No DML, function permissions, policies, default ACLs or data change.

[PostgreSQL 17 privileges](https://www.postgresql.org/docs/17/ddl-priv.html) and
[release notes](https://www.postgresql.org/docs/17/release-17.html) document MAINTAIN
as maintenance authority introduced in 17. Client app queries do not need maintenance
operations such as REINDEX, VACUUM or ANALYZE. Tests check all 21 grant combinations,
client REINDEX denial and service_role REINDEX success (17+). pg_maintain or other
inherited/SET ROLE privileges remain blocked by the existing membership preflight.
Removing MAINTAIN does not remove lock abilities independently supplied by retained DML.

The owner confirmed production PostgreSQL **17.6** on October 29. Use
`--postgres-version 17.6` (the default) for matching upstream-version replay and
`--postgres-version 16` for backwards compatibility. Reports record image ID and
actual server version; the private export itself has no version header. Upstream
PostgreSQL with minimal Auth/Storage fixtures does not reproduce the Supabase-managed
build, extensions, role memberships or hooks. Those remain staging validation scope.


Validation of this revision passed against the unchanged private export in upstream
PostgreSQL **17.6** (`server_version_num=170006`), standalone and in both migration
orders with PR #15. PostgreSQL 16 replay also passed. Service MAINTAIN is retained;
both clients are denied MAINTAIN and REINDEX on 17.6. All DML/function/RLS/default-ACL
preservation assertions passed, as did the deletion compatibility suites. The initial
17-major-tag smoke test also passed on 17.11, but the three 17.6 runs are the matching
production-version evidence. No live projects were accessed.

**Ready for owner-controlled staging validation, not production deployment.** Before
staging execution, check staging's role/owner assumptions with the read-only preflight.
Before production approval, confirm no client maintenance tooling requires MAINTAIN,
inspect pg_maintain/other membership paths and event triggers, and retain the private
ACL baseline. Current broad default privileges still require separate future-object
review; this patch intentionally leaves them untouched. No production readiness or
managed-platform end-to-end claim follows from these PostgreSQL-only tests.
