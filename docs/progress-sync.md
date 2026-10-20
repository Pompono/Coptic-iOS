# Cloud progress sync (Phase 2B)

## Enable the cloud endpoint

Apply `supabase/migrations/20261019000000_progress_sync.sql` to the configured Supabase project before shipping a build with Cloud Progress. The client uses the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; no service-role or other secret key belongs in the app. This repository cannot verify whether the migration has been applied to the live project.

The migration creates one versioned snapshot per authenticated Supabase user. Row-level security allows reads only when `auth.uid()` matches the row owner. The write RPC derives the user ID from the verified session, uses a compare-and-swap revision, and rejects stale writes instead of replacing newer data. It accepts JSON objects up to 20 MiB. Deleting the account removes its snapshot through the foreign-key cascade.

## Consent and behavior

Cloud sync is off by default and requires a signed-in account. The user enables it in Settings → Cloud Progress. A first upload or download is shown for review. Download uses the existing validated, journaled local replacement and writes an independent **pre-sync recovery copy**, leaving the Phase 1 restore recovery copy untouched. Export it from Settings → Progress & Backup → Recovery copy. Turning sync off stops future network sync but leaves the account copy in place.

The snapshot contains the same allowlisted progress records as Progress & Backup: lesson completions and failed steps, XP/streaks, practice history, vocabulary and review schedules, and the saved reader passage or draft. It excludes auth tokens, preferences, search history and unrelated local storage. The records are validated before upload and again before installation from the cloud.

Learning remains local and usable offline. An app-level lifecycle coordinator attempts sync after progress changes, when the network returns, when the app becomes visible/focused, and when a native iOS app returns to the foreground. Work is debounced and single-flight; lifecycle work, Sync now, and explicit conflict choices share a device-wide lock. The background coordinator only reconciles changes against an established per-user base; first sync and unsafe conflicts remain explicit choices in Settings. It checks the active Supabase user and local opt-in before committing a baseline or changing local records. Failed requests leave local progress untouched and can be retried with Sync now.

## Reconciliation and conflicts

Each device keeps a local base snapshot and its cloud revision. A local-only change is uploaded only if the cloud still matches that base. A cloud-only change is installed only if a fresh cloud read still matches and the device still matches the base immediately before the synchronous transaction. The baseline advances only after the transaction commits. A local deletion or reduction of existing learning progress is never auto-uploaded. A compare-and-swap race is retried once against the latest confirmed snapshot; subsequent races stop for review. An account switch on the same device requires an explicit choice in Settings before further background sync.

Identical local/cloud snapshots adopt the confirmed cloud revision without another write. When both sides changed, the app attempts a conservative merge against the latest cloud revision and rechecks local progress before committing. It unions contiguous curriculum completions, known completed steps, unique vocabulary cards and independent practiced-item records. XP is the maximum recorded total, never a sum. Any mismatch in streak/date history, a shared vocabulary card's review history, a shared practiced item's counters/schedule, or saved reading content remains a manual conflict. The conflict review compares pathway advancement, completed lesson/step counts, and XP; cancelling leaves both copies untouched. A successful write uses the existing revision compare-and-swap and the existing transactional local recovery copy.

The database stores the latest snapshot, not an operation log or learning-event history. Therefore, simultaneous attempts on the same vocabulary card or practiced item cannot be counted or scheduled exactly; those records are preserved as a conflict rather than guessed. Taking the maximum XP can undercount independent XP gains, but avoids inventing XP or adding duplicated totals. A user who explicitly chooses one copy during an unresolved conflict replaces the other copy; the UI states this before confirmation. Use Progress & Backup exports as an additional portable archive.

## Device acceptance checks

- Sign in on a device with local progress and enable sync. Confirm no upload occurs until the upload choice is confirmed.
- Sign in on a clean second device. Confirm the cloud copy is offered and is installed only after confirmation; verify the prior device copy is available in Recovery copy.
- With sync enabled on both devices, make progress on one device and then open/focus the other. Confirm the cloud-only change is received.
- Make separate changes on both devices before either syncs. Confirm stale writes are rejected and a conflict choice appears; cancel and verify both local copies remain.
- Choose each conflict resolution path with disposable accounts and verify the warning, revision, and recovery behavior.
- Test airplane mode while learning and after reconnect. Failed requests must not reset or block local learning.
- Verify one signed-in user cannot read another user's snapshot, and an anonymous client cannot read or write rows.
- Confirm the live project migration is applied and its RLS/function grants match the migration before release.

## Database preflight and verification

The migration adds only `public.progress_sync_snapshots` and `public.save_progress_snapshot(bigint, jsonb)`. It adds a per-user revision constraint, enables row-level security, grants authenticated users read access only through the own-user policy, revokes direct writes and anonymous access, and defines an authenticated compare-and-swap write function with a fixed empty search path. It does not alter existing learning tables. The function rejects unsupported keys and malformed or oversized serialized progress records.

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

Run authenticated-user isolation checks against a disposable local Supabase database, never production:

```sh
psql "$LOCAL_SUPABASE_DB_URL" -v user_a="$EXISTING_AUTH_USER_A_UUID" -v user_b="$EXISTING_AUTH_USER_B_UUID" -f supabase/tests/progress_sync_authorization.sql
```

The SQL test wraps writes in a transaction and rolls them back. It verifies that two authenticated users cannot read each other's row and anonymous table/RPC access is denied. It needs two existing auth users in the local test instance.

## Rollback

Turn off Cloud Sync in the app or disable the release flag/build first. To stop writes while retaining user snapshots, revoke authenticated RPC execution and keep the table and rows in place:

```sql
revoke execute on function public.save_progress_snapshot(bigint, jsonb) from authenticated;
```

Do not drop the table or cascade-delete rows as a routine rollback. If the RPC is restored, reapply the matching migration after reviewing the schema and grants. Keep device-local progress and both recovery files; use normal Progress & Backup export before any separately approved data-retention cleanup.
