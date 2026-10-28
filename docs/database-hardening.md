# Proposed application database privilege hardening

Status: proposed, not deployed. Separate from account-deletion PR #15 because this
changes general client access and postgres default ACLs. It can be reviewed and
applied independently; no earlier migration is rewritten. No live Supabase project
was accessed. Source: owner's private 20,297-byte public-schema export, SHA-256
`e037c1e8d6dcd572d4c4b731f059dc7e49e0a317c9f6340732a0025c69ea02f2`.
The dump and local diagnostics are not committed.

## Exact proposed changes

Forward migration `20261028190000_application_least_privilege.sql` reduces grants:

| Object | anon / PUBLIC | authenticated | service_role / owner |
| --- | --- | --- | --- |
| courses, lessons, questions, reviews, streaks, user_progress, xp_events | Revoke TRUNCATE, REFERENCES, TRIGGER and column REFERENCES; preserve existing SELECT/INSERT/UPDATE/DELETE | Same: preserve all existing DML pending dependency inventory | Unchanged |
| progress_sync_snapshots | Unchanged | Existing SELECT plus snapshot RPC unchanged | Unchanged |
| Existing functions, deletion receipts, Auth/Storage objects | Unchanged | Unchanged | Unchanged |

No new grants or policies are added. No data, indexes, constraints, function bodies,
search paths or auth/session/progress application code changes. Foreign-key cascades
do not require end-user DELETE grants. Missing legacy application tables are skipped
for environments containing only snapshots. Existing tables must be ordinary,
postgres-owned and RLS-enabled; incompatible shapes abort the statement.

The current seven-table `ALL` grants include operations RLS cannot protect, notably
TRUNCATE. DELETE has no permissive policy on these seven tables in the supplied
export; xp_events also has no UPDATE policy. However, the owner explicitly confirmed
that older clients, the website, backend services and external integrations remain
unverified. **Existing SELECT/INSERT/UPDATE/DELETE table and column grants are
therefore preserved**, including grants not exercised by current repository code.
This is an initial hardening step, not a claim that all retained access is necessary.
After the dependency inventory, a separately reviewed change can remove unused DML
grants. REFERENCES/TRIGGER are schema-management privileges, not normal API data
operations; deployment still requires confirming no client-role DDL tooling needs them.

## Defaults and role inheritance

For **postgres-created future objects**, remove PUBLIC/anon/authenticated default
table and sequence privileges, and function EXECUTE, at global scope and in public.
Global and schema-specific defaults add together; revoking only public-schema defaults
does not cancel PostgreSQL's built-in global PUBLIC EXECUTE. Existing objects and
service_role defaults remain unchanged. New client-facing objects must explicitly
grant their intended access in their creating migration.

The global change also affects future postgres-created objects in other schemas.
This requires owner review of managed Supabase updates/extensions and any deployment
scripts depending on implicit grants. Do not replace it with a schema-only function
revoke and claim that future functions are private. Other creator roles and defaults
are outside this export and must be inventoried before deployment.

The export does not include role definitions/memberships. The migration refuses to
proceed if anon/authenticated are superusers, BYPASSRLS, CREATEROLE, CREATEDB,
REPLICATION, or members of any other role (including NOINHERIT memberships that may
permit SET ROLE). It does not revoke membership automatically. After reductions it
checks effective table and column privileges; an unexpected remaining privilege
aborts the entire statement. Membership of the gateway/authenticator **in** a client
role is distinct from the client role itself inheriting another role, and is not
removed. Role login attributes, schema CREATE permissions and other creator roles
still need the deployment owner's read-only review.

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

The runner reads the private export unchanged, starts PostgreSQL 16 with
`--network none`, no published ports or host mounts, and removes the container.
Reports contain input hashes and image ID under ignored `.private-schema-audit/`;
SQL errors remain local. Docker may pull the image; the database cannot reach live
Supabase. Auth/Storage are labeled minimal fixtures, not deployed managed schemas.
No real users or production rows are imported. Tests are deliberately not fed a
reconstructed schema and the private dump is never uploaded to CI.

Tests cover exact table privilege matrices, separately granted column ACLs,
anonymous/authenticated TRUNCATE rejection, preserved DELETE grants and unchanged
RLS denial of row deletion, retained owner operations,
snapshot read/RPC, future table/sequence/function grants, service defaults,
membership rejection, rollback after a late-table incompatibility, idempotent reapplication, and unchanged
existing function definitions/grants, RLS policies and constraints. The optional
PR #15 path also runs populated production-shaped cascades/shared-content checks,
stale-user/ownership/privileged-write fences and administrative permission tests.

Local actual-export runs passed standalone, after PR #15, and before PR #15. Both
migration orders preserve the deletion regression suite. These are local PostgreSQL
results, not production/staging deployment or managed Auth HTTP end-to-end evidence.
Use `supabase/tests/hardening_inventory.sql` for the owner's separate read-only
metadata review; it is not executed against a live project by these tests.

## Deployment gates and questions

1. Inventory older clients, website, dashboards, imports and external services.
   Existing DML is preserved until this is complete; do not further reduce it or
   add shared SELECT policies based on repository evidence alone. Verify that no
   client-role schema tooling depends on REFERENCES/TRIGGER. The owner has explicitly
   marked these dependencies unverified.
2. Review actual role attributes/memberships, schema CREATE rights, effective column
   grants and default ACLs for **every** creating role. The public dump cannot prove
   absence of inherited privileges. An unexpected role shape intentionally blocks
   this migration rather than guessing a safe repair.
3. Approve the global postgres default-function change after verifying managed
   updates and future non-public functions explicitly grant required execution.
4. Recheck drift since the export and test with matching isolated managed Auth,
   Storage and gateway versions. Database replay does not exercise Auth HTTP flows.
5. Account deletion still separately requires PR #15's non-public dependency,
   external worker/integration, retention and disposable-device acceptance gates.

Owner approval and a separate deployment operation are required. Do not deploy,
merge or enable deletion on the strength of this proposal alone. If rollback is
needed, restore only specifically reviewed grants from a private pre-deployment ACL
snapshot; do not blindly restore the unsafe ALL grants/defaults.
