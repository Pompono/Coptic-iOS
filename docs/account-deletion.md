# Phase 3A account deletion

## Pre-implementation audit (2026-10-26)

Base: `origin/main` at `156a98b`. Repository inspected independently; existing untracked recording documents are unrelated and preserved.

- `app/account/page.tsx` supports email/password registration, sign-in, email OTP verification and PKCE password recovery. No social identity provider or subscription integration is implemented.
- `lib/auth/client.ts` creates a persistent Supabase client with a publishable key. `storage.ts` uses the native SecureAuthStorage Keychain plugin on iOS, localStorage on web. Native foreground/background lifecycle manages refresh. AuthProvider restores via getSession, listens for auth events and completes callbacks. These asynchronous entry points currently have no deletion fence.
- The account UI's session is cached state, not sufficient server proof. The deletion backend must call Auth getUser with the bearer token and verify the current password against the server-derived email, comparing the returned UUID with the verified bearer identity.
- All tracked migrations and application/backend Supabase call sites were reviewed. The only application table is `public.progress_sync_snapshots`, whose primary key references `auth.users(id) ON DELETE CASCADE`. Reads are owner-only RLS; writes use the owner-derived `save_progress_snapshot` security-definer RPC. No profile table, Storage buckets, Storage API calls, uploaded avatars, billing records or external account resources are defined in this repository. Display name and email live in Supabase Auth metadata/user records.
- This is a repository audit, **not a live database inventory**. The deployed schema, Storage resources, external integrations and retention settings are unverified. Deployment must include a live inventory and must stop if unhandled account resources exist.
- The exported Next.js app has no trusted server runtime. `backend/` contains translation routes, no Supabase administrative deployment. Supabase Edge Functions fit the existing Auth/database boundary; no existing functions or deployment pipeline were found.
- Automatic sync and the Settings sync panel both perform asynchronous downloads/uploads. Abort alone does not retract a request already accepted by the server. The FK prevents snapshots from being recreated after Auth deletion; a server deletion-pending guard will additionally block writes while cleanup runs. Both client sync paths need cancellation plus durable blocking across restarts.
- Ordinary lesson records, XP/streaks, practice skills, vocabulary and reader data are local and account-independent. Progress transaction/recovery journals must remain intact. Cloud baselines and the last-user/opt-in markers contain account identity and should be removed after confirmed deletion. Clearing them without a separate consent barrier would otherwise auto-upload retained records to a later new account.
- Existing GitHub Actions runs Node/type/lint/build, PostgreSQL fixtures, browser tests, Capacitor sync, macOS simulator startup and unsigned arm64 IPA packaging. This Windows workspace cannot run Xcode; those checks must run in Actions. No production deletion or deployment is authorized.

## Design chosen before implementation

Use one `account-deletion` Edge Function. A destructive request requires a live verified bearer identity plus current password and an exact confirmation value. No target UUID is accepted. A random 256-bit receipt is saved in secure auth storage before sending; only its SHA-256 hash is stored server-side. Receipt-only status requests can report the outcome after credentials cease working, but cannot delete anything. A receipt row's nullable FK is atomically cleared by Auth hard deletion, providing durable evidence even when the response is lost. Pending requests pause sync; failed cleanup is retryable. Completed receipts retain only a random hash and timestamp, with a documented purge procedure.

The UI remains unavailable until a backend readiness probe succeeds. Production rollout remains blocked on live resource/retention review and disposable-account end-to-end verification.

## Endpoint, security and interruption recovery

`POST https://<project-ref>.supabase.co/functions/v1/account-deletion` accepts only `action`, `receipt`, `password`, and `confirmation`. `delete` requires a live bearer token validated with `auth.getUser(token)`, current password checked using a separate nonpersisting Auth client, matching identity, and `confirmation: "DELETE"`. The password never enters local storage, logs or a receipt. Temporary verification sessions are signed out. Password failures inherit Supabase Auth rate limits; monitor those limits during staging and configure project abuse protection as needed.

`ready` is a non-sensitive capability probe. `status` requires the unpredictable receipt capability (256 random bits); it returns only `not_started`, `processing`, `retry`, or `deleted`, never identity. It cannot invoke deletion. Gateway JWT checking is disabled **only for this function**, because status must work after the account/token is gone; the handler explicitly verifies every destructive request. Missing/forged/expired JWTs are rejected. Unknown fields, including every caller-supplied target ID, are rejected. Only configured origins receive CORS access. CORS is not an authentication mechanism. Requests without Origin still need the same authentication and verification.

Receipt hashes live in an RLS-protected table with no client grants. The service-only claim RPC serializes claims per user and grants a two-minute lease. A repeated tap cannot start another request on-device, and concurrent server requests share the lease. Fresh authentication permits a new receipt after a lost-device lease expires; all receipts for that account finalize when Auth deletes it. Status never retries a destructive operation automatically. A timeout keeps the receipt and sync fence; the user checks status and explicitly retries with their password if needed. There is no success message for sign-out alone or an unconfirmed outcome.

Storage objects are enumerated by `owner_id` and legacy `owner`, in batches, and removed using the Storage API, including nested paths. Metadata rows are never deleted directly. Auth is hard-deleted with `admin.deleteUser(id, false)` only after objects are gone; cloud snapshots cascade. Any failure preserves the pending receipt for retry. Unexpected public tables or user-owned buckets fail readiness rather than silently leaving data. Owned buckets are not created by this app; if found, the owner must extend the audited cleanup before enabling deletion. Non-public application tables, service-owned objects linked by path/metadata, hooks and external systems require the deployment inventory review below.

Database guards block snapshot writes while deletion is pending. Restrictive Storage policies block access for pending/deleted users without granting new privileges. Owned-object and owned-bucket writes take an Auth-row lock; an Auth deletion trigger refuses remaining owned objects/buckets. These guards close the already-in-flight Storage write window. The snapshot FK prevents late RPC writes from resurrecting deleted progress even while an old JWT remains cryptographically valid. No existing RLS policy is weakened.

## Local data and session lifecycle

The native receipt uses existing Keychain storage; browser previews use the existing browser auth-storage adapter. A durable non-identifying local marker fences sync before any deletion request is sent. Both sync paths receive cancellation; core snapshot installation/baseline functions also refuse work while fenced. AuthProvider filters late callback, restoration and refresh results. An auth-storage wrapper refuses deleted-account session persistence; a durable SHA-256 UUID fingerprint prevents stale credentials from reconnecting after restart. No raw UUID remains in this local revocation list.

After backend-confirmed deletion, revoke the identity locally, stop refresh, sign out locally, clear password-recovery authorization and account-specific sync baseline/last-user/opt-in identifiers. Cleanup errors leave the receipt available for another status/cleanup attempt. The receipt is removed only after cleanup completes. Ordinary progress and all progress recovery/transaction journals are preserved byte-for-byte. Cloud recovery copies remain available only through existing explicit recovery controls; deletion never automatically restores one. Theme, font, callback URLs and bundle identifier are unchanged.

A separate consent marker survives deletion and sign-in. Automatic synchronization stays off until the user chooses in Settings → Progress whether to upload retained device progress to the new account or use that account's cloud copy. This is not automatic account migration.

## Owner-approved deployment (not performed by Codex)

1. Review `supabase/tests/inventory.sql` against staging and the intended production project **read-only**. Inspect every schema/table, all FKs (including transitive dependencies), ownership/email/account columns without FKs, Storage buckets/objects and permissive policies, database triggers/hooks, Auth providers, external integrations and any service-owned uploads. Expected application tables before migration: only `progress_sync_snapshots`; expected app-created Storage resources: none. Resolve every discrepancy before proceeding. The runtime public-table check is a fail-safe, not a substitute for this review.
2. Confirm provider backup/log/audit retention and any legal holds. This feature removes live Auth/application data and owned Storage objects. It does **not** promise immediate erasure from infrastructure backups/logs or remote device caches. No application-specific legal retention requirement is defined in the repository. Document actual provider retention periods for the chosen plan in the privacy policy before release. Never log deletion request bodies or credentials in custom monitoring.
3. Use an isolated staging Supabase project first. Review and apply `20261026000000_account_deletion.sql` after the two existing migrations. It adds a private receipt table, service-only RPCs, restrictive policies and guards on managed Auth/Storage tables; verify compatibility and trigger permissions against the staging platform version before production.
4. Required server environment names: built-in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`; custom `ACCOUNT_DELETION_ENABLED` (default off), `ACCOUNT_DELETION_ALLOWED_ORIGINS` (default `capacitor://localhost`). Add exact trusted HTTPS preview origins only if used; for local development add `http://localhost:3000` or the exact development origin. Never use `*` or a `NEXT_PUBLIC_` name for a privileged key. The app needs only its existing public URL/publishable key.
5. Owner commands, substituting the explicitly approved **staging** reference first:

   ```sh
   supabase link --project-ref <approved-project-ref>
   supabase db push --dry-run
   supabase db push
   supabase secrets set ACCOUNT_DELETION_ALLOWED_ORIGINS=capacitor://localhost ACCOUNT_DELETION_ENABLED=false
   supabase functions deploy account-deletion
   # Only after inventory, deployment and disposable verification are approved:
   supabase secrets set ACCOUNT_DELETION_ENABLED=true
   ```

   Configuration intentionally makes the UI unavailable before enablement. Enabling on staging is required to test deletion; do not enable production until staging passes and the production inventory is reviewed. No automatic production deployment workflow is included. If disabling later, pending receipt status checks still work; destructive retries are paused.

   Automatic PR IPA builds use the repository's existing public Auth configuration. They will show deletion as unavailable until that project's backend is enabled. For physical testing **against staging**, use the workflow's optional public configuration inputs; this does not change repository variables or deploy anything:

   ```sh
   gh workflow run build.yml --ref codex/secure-account-deletion \
     -f test_supabase_url=https://<approved-staging-ref>.supabase.co \
     -f test_supabase_publishable_key=<staging-public-publishable-key>
   ```

   Download the resulting run's `CoptLingo-unsigned-iphone-ipa` artifact. Never put a service-role/secret key into these public build inputs. Keep the existing native callback URLs allowlisted in staging too.
6. Schedule a daily privileged maintenance query using the owner's approved scheduler:

   ```sql
   delete from public.account_deletion_requests
   where user_id is null and completed_at < now() - interval '30 days';
   ```

   Completed receipts retain only a capability hash and timestamps, with no user link; retain them for 30 days for interrupted-device recovery. Do not purge pending requests until resolved: they are the server sync fence. Monitor pending requests older than one day and investigate failures without recording credentials. The local revocation fingerprint stays on the device to reject stale credentials. An offline device with an unresolved receipt older than the server retention period needs owner-assisted outcome verification; it must not guess success or silently resume synchronization.

## Repeatable tests and release gates

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- `deno check --config supabase/functions/deno.json supabase/functions/account-deletion/index.ts` checks the deployable Deno entry point independently of the exported Next.js app and its Node dependency tree.
- Node tests exercise the actual request handler with fake backends, including normal user A attempting to delete B, receipt replay, lease duplicates, failed verification, missing/expired/forged auth, cleanup failures, and response loss after commit. Local state tests exercise preserved records/journals, durable revocation, restart and late credential writes.
- CI's `progress-sync-postgres` job creates disposable PostgreSQL roles/Auth/Storage fixtures, applies all migrations and runs `supabase/tests/account_deletion.sql`. Never run destructive fixture SQL in a deployed project.
- CI's `deletion-integration` starts an unlinked local Supabase Docker stack, serves the real Edge Function, and runs `scripts/account-deletion-integration.mjs`. The script refuses all URLs except loopback port 54321, creates disposable accounts and objects, and verifies actual hard deletion, object cleanup, snapshot cascade, stale JWT rejection and other-user isolation. It never reads production credentials.
- `node scripts/account-deletion-smoke.mjs`, with `DELETION_BROWSER=webkit` for WebKit, blocks all external requests and mocks Auth/Edge/REST. It exercises discoverability, cancel, final confirmation, duplicate taps, unavailable backend, lost response/restart, local retention and new-account consent.
- Existing mobile, Settings navigation, route-preparation and backup smoke tests remain in Actions. macOS Actions performs Capacitor sync, simulator build/startup and unsigned IPA packaging. No physical iPhone or production end-to-end verification is implied by CI success.

## Physical iPhone acceptance checklist (disposable account only)

- Install the new unsigned artifact using the owner's signing process. Check bundle ID `com.pompono.coptic`, normal sign-in, verification, password recovery and Settings swipe/back navigation.
- In the approved staging project, create a disposable account; complete lessons, accumulate XP, save vocabulary and reader progress, and sync. Record local values and recoverable backup availability.
- Find Delete Account near the bottom of Account. Verify copy, keyboard accessibility, large text, light/dark styles, Cancel and disabled final action until both fields are filled. Verify a wrong password fails without claiming deletion.
- Delete with correct password and confirmation. Verify the actual Auth user, snapshot and any test-owned Storage objects are absent, while a second disposable user's records remain. Verify sign-in with the deleted credentials fails.
- Check local progress, recovery copies, theme/font and offline learning. Force quit/restart and verify signed-out state and no sync requests for the deleted account.
- Interrupt connectivity during deletion. Confirm no premature success; reconnect, use Check deletion status, and confirm cleanup without another unintended deletion. Repeat with app termination during the request.
- Sign in to a new disposable account. Verify retained progress does not upload until the explicit Settings → Progress choice. Test the cloud-copy and device-copy choices separately.
- On a second device with an old session, verify late uploads fail and local progress stays available offline. Confirm no text claims remote local-data erasure.

## References

- [Apple: Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Supabase: Managing user data and deletion](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase: Storage ownership](https://supabase.com/docs/guides/storage/security/ownership)
- [Supabase: Securing Edge Functions](https://supabase.com/docs/guides/functions/auth)
