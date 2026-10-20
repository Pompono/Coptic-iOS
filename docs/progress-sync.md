# Cloud progress sync (Phase 2B)

## Enable the cloud endpoint

Apply the migrations under `supabase/migrations/` in timestamp order to the configured Supabase project before shipping a build with Cloud Progress. The additive migration `20261020000000_progress_sync_rpc_compat.sql` is required for deployments that already applied `20261019000000_progress_sync.sql`; it replaces only the existing RPC body and does not delete or rewrite stored snapshots. The client uses the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; no service-role or other secret key belongs in the app.

The migration creates one versioned snapshot per authenticated Supabase user. Row-level security allows reads only when `auth.uid()` matches the row owner. The write RPC derives the user ID from the verified session, uses a compare-and-swap revision, and rejects stale writes instead of replacing newer data. It accepts JSON objects up to 20 MiB. Deleting the account removes its snapshot through the foreign-key cascade.

## Automatic behavior

Cloud sync starts automatically for a valid signed-in account; guest learning remains local and registration is optional. Existing per-user revision baselines are read as-is and never reset during upgrade. Accounts that previously disabled sync retain that choice: if either copy changed since the saved baseline, background reconciliation pauses and Settings asks the user to review both copies before resuming. After a baseline is explicitly reviewed or a new account starts syncing, the legacy per-user marker records the active sync choice. Without a baseline, matching local/cloud records establish one, an empty device restores a validated cloud snapshot after a fresh revision check and transactional recovery preparation, and local progress with an empty cloud uploads using revision zero. Different nonempty local and cloud copies remain on the Progress page for explicit review. Signing into another account never installs that account's snapshot over this device's progress without confirmation. Cloud restores keep an independent **pre-sync recovery copy** alongside the regular recovery snapshot.

The snapshot contains the same allowlisted progress records as Progress & Backup: lesson completions and failed steps, XP/streaks, practice history, vocabulary and review schedules, and the saved reader passage or draft. It excludes auth tokens, preferences, search history and unrelated local storage. The records are validated before upload and again before installation from the cloud. The database accepts up to 10,000 records and a 20 MiB serialized snapshot; individual records do not have a separate 1 MiB cap.

Learning remains local and usable offline. An app-level lifecycle coordinator attempts sync after progress changes, when the network returns, when the app becomes visible/focused, and when a native iOS app returns to the foreground. Work is debounced and single-flight. The background coordinator automatically performs only safe first-sync operations; ambiguous differences and conflicts remain explicit choices on the Progress page. It checks the active Supabase user before committing a baseline or changing local records. Failed requests leave local progress untouched and can be retried with Sync now.

## Reconciliation and conflicts

Each device keeps a local base snapshot and its cloud revision. A local-only change is uploaded only if the cloud still matches that base. A cloud-only change is installed only if a fresh cloud read still matches and the device still matches the base immediately before the synchronous transaction. The baseline advances only after the transaction commits. A local deletion or reduction of existing learning progress is never auto-uploaded. If both copies changed, or there is no base to compare, automatic writes stop and the user chooses whether to keep this device or use the cloud copy. A compare-and-swap race is handled the same way. An account switch on the same device requires an explicit choice in Settings before further background sync.

The database stores the latest snapshot, not an operation log or multi-device merge. Choosing one side during a conflict intentionally replaces the other side; the UI states this before the user confirms. Manual import/export controls are hidden from Settings; validated backup serialization and transactional recovery remain internal. Simultaneous changes are not merged field-by-field because XP, streaks, practice counters and spaced-review schedules do not have safe generic merge semantics.

## Device acceptance checks

- Sign in on a device with local progress and an empty cloud account. Confirm the validated local snapshot uploads at revision zero.
- Sign in on a clean second device. Confirm the validated cloud copy is restored after a recovery copy is saved.
- Sign in where both nonempty copies differ and no baseline exists. Confirm neither side changes until an explicit choice.
- With sync enabled on both devices, make progress on one device and then open/focus the other. Confirm the cloud-only change is received.
- Make separate changes on both devices before either syncs. Confirm stale writes are rejected and a conflict choice appears; cancel and verify both local copies remain.
- Choose each conflict resolution path with disposable accounts and verify the warning, revision, and recovery behavior.
- Test airplane mode while learning and after reconnect. Failed requests must not reset or block local learning.
- Verify one signed-in user cannot read another user's snapshot, and an anonymous client cannot read or write rows.
- Confirm the live project migration is applied and its RLS/function grants match the migration before release.

## Database preflight and verification

The initial migration adds only `public.progress_sync_snapshots` and `public.save_progress_snapshot(bigint, jsonb)`. It adds a per-user revision constraint, enables row-level security, grants authenticated users read access only through the own-user policy, revokes direct writes and anonymous access, and defines an authenticated compare-and-swap write function with a fixed empty search path. The compatibility migration replaces only the RPC body. Neither migration alters existing learning tables. The RPC rejects unsupported keys and malformed or oversized serialized progress snapshots.

Run the following read-only checks in the Supabase SQL editor before enabling the feature for users. A preflight showing no table/function is expected before migration. Apply the migration only after confirming the project URL is the intended project and a current database backup exists.

```sql
select current_database(), current_user;
select to_regclass('public.progress_sync_snapshots') as snapshot_table,
       to_regprocedure('public.save_progress_snapshot(bigint,jsonb)') as write_rpc;
select c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c where c.oid = to_regclass('public.progress_sync_snapshots');
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'progress_sync_snapshots'
order by grantee, privilege_type;
select p.proname, p.prosecdef as security_definer, p.proconfig,
       r.rolname as owner, p.proacl
from pg_proc p join pg_roles r on r.oid = p.proowner
where p.oid = to_regprocedure('public.save_progress_snapshot(bigint,jsonb)');
select policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' and tablename = 'progress_sync_snapshots';
```

Expected after migration: RLS is enabled; `anon` has no table privileges or RPC execution; `authenticated` has SELECT only plus RPC execution; the read policy is `auth.uid() = user_id`; the RPC is `SECURITY DEFINER` with an empty `search_path` and derives ownership only from `auth.uid()`. The function rejects unsupported keys, non-string/malformed records, too many records, and oversized snapshots. The client uses only the public publishable key.

Run the RPC integration test against a disposable PostgreSQL database with Supabase auth roles/schema, or a disposable local Supabase instance, never production. The test exercises realistic Coptic progress records, fractional totals, a large valid practice record, compare-and-swap success and stale conflicts, invalid-record rejection without changing the saved snapshot, and cross-account isolation. Its writes roll back:

```sh
psql "$LOCAL_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/progress_sync_rpc.sql
```

The same test runs in the `progress-sync-postgres` GitHub Actions job, which provisions a disposable PostgreSQL service, creates minimal Supabase `auth.uid()` fixtures, and applies migrations in timestamp order.

Run the additional authenticated-user isolation checks against a disposable local Supabase database, never production:

```sh
psql "$LOCAL_SUPABASE_DB_URL" -v user_a="$EXISTING_AUTH_USER_A_UUID" -v user_b="$EXISTING_AUTH_USER_B_UUID" -f supabase/tests/progress_sync_authorization.sql
```

The authorization SQL wraps writes in a transaction and rolls them back. It verifies that two authenticated users cannot read each other's row and anonymous table/RPC access is denied. It needs two existing auth users in the local test instance.

## Rollback

Disable the automatic sync lifecycle in a reviewed release build first. To stop writes while retaining user snapshots, revoke authenticated RPC execution and keep the table and rows in place:

```sql
revoke execute on function public.save_progress_snapshot(bigint, jsonb) from authenticated;
```

Do not drop the table or cascade-delete rows as a routine rollback. If the RPC is restored, reapply the matching migration after reviewing the schema and grants. Keep device-local progress and both recovery files; validated internal backup/restore support remains available for cloud conflict and failure recovery.

## RPC rejection diagnostics and follow-up deployment

The local progress validator accepts finite nonnegative numeric totals and progress records larger than 1 MiB, while the original Phase 2B RPC rejected fractional XP/streak values and any individual record over 1 MiB. Both can pass app backup validation and receive PostgreSQL `22023` / PostgREST HTTP 400. The additive compatibility migration removes those validation mismatches while retaining the 20 MiB whole-snapshot cap, record-count limit, record-shape validation, authenticated ownership, and revision compare-and-swap.

If an upload still fails after the compatibility migration, Settings reports only a safe SQLSTATE/PostgREST code and an allowlisted description. It never displays or logs raw server details, auth tokens, email addresses, verification/recovery codes, or saved passage contents. Share only the displayed code and description with support; do not send a progress snapshot for diagnosis.

After reviewing the complete additive SQL file and verifying the selected project in the Supabase SQL Editor, execute `20261020000000_progress_sync_rpc_compat.sql` as a new migration. It uses `CREATE OR REPLACE FUNCTION` with the existing signature and does not delete progress rows. Confirm the function still has `SECURITY DEFINER`, an empty `search_path`, and execute permission for `authenticated` only before updating the iPhone build.

## Physical iPhone retest

1. Install the new unsigned IPA over the existing test install and sign in. Verify a known upgrade account's existing baseline and progress remain intact.
2. On a clean device, sign in to an account with cloud progress. Confirm the validated snapshot is restored after a local recovery copy is prepared.
3. On a device with distinct nonempty local and cloud progress and no baseline, verify both copies remain unchanged until the user confirms a choice in Settings → Progress.
4. Sign in to an empty cloud account from a device with local progress. Confirm revision-zero upload succeeds automatically. Make another change and verify it syncs after reconnecting from offline mode.
5. Make one new practice change on each of two devices before either syncs. Confirm the stale revision is reported as a conflict and canceling leaves each local copy intact.
6. Sign out, switch accounts, and verify no cloud snapshot from the previous account is installed into the new account's local progress.
