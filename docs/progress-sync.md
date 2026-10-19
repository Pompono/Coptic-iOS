# Cloud progress sync (Phase 2B)

## Enable the cloud endpoint

Apply `supabase/migrations/20261019000000_progress_sync.sql` to the configured Supabase project before shipping a build with Cloud Progress. The client uses the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; no service-role or other secret key belongs in the app. This repository cannot verify whether the migration has been applied to the live project.

The migration creates one versioned snapshot per authenticated Supabase user. Row-level security allows reads only when `auth.uid()` matches the row owner. The write RPC derives the user ID from the verified session, uses a compare-and-swap revision, and rejects stale writes instead of replacing newer data. It accepts JSON objects up to 20 MiB. Deleting the account removes its snapshot through the foreign-key cascade.

## Consent and behavior

Cloud sync is off by default and requires a signed-in account. The user enables it in Settings → Cloud Progress. The first upload or download is shown for review; downloading uses the existing validated, journaled local replacement and retains a local recovery copy. Turning sync off stops future network sync but leaves the account copy in place.

The snapshot contains the same allowlisted progress records as Progress & Backup: lesson completions and failed steps, XP/streaks, practice history, vocabulary and review schedules, and the saved reader passage or draft. It excludes auth tokens, preferences, search history and unrelated local storage. The records are validated before upload and again before installation from the cloud.

Learning remains local and usable offline. When opted in, the app attempts sync after progress changes, when it returns online, on focus, and at sign-in. Failed requests leave local progress untouched and can be retried with Sync now.

## Reconciliation and conflicts

Each device keeps a local base snapshot and its cloud revision. A local-only change is uploaded only if the cloud still matches that base. A cloud-only change is installed only if the device still matches the base. If both copies changed, or there is no base to compare, automatic writes stop and the user chooses whether to keep this device or use the cloud copy. A compare-and-swap race is handled the same way. The selected cloud download first creates the existing local recovery copy.

The database stores the latest snapshot, not an operation log or multi-device merge. Choosing one side during a conflict intentionally replaces the other side; the UI states this before the user confirms. Use Progress & Backup exports as an additional portable archive. Simultaneous changes are not merged field-by-field because XP, streaks, practice counters and spaced-review schedules do not have safe generic merge semantics.

## Device acceptance checks

- Sign in on a device with local progress and enable sync. Confirm no upload occurs until the upload choice is confirmed.
- Sign in on a clean second device. Confirm the cloud copy is offered and is installed only after confirmation; verify the prior device copy is available in Recovery copy.
- With sync enabled on both devices, make progress on one device and then open/focus the other. Confirm the cloud-only change is received.
- Make separate changes on both devices before either syncs. Confirm stale writes are rejected and a conflict choice appears; cancel and verify both local copies remain.
- Choose each conflict resolution path with disposable accounts and verify the warning, revision, and recovery behavior.
- Test airplane mode while learning and after reconnect. Failed requests must not reset or block local learning.
- Verify one signed-in user cannot read another user's snapshot, and an anonymous client cannot read or write rows.
- Confirm the live project migration is applied and its RLS/function grants match the migration before release.
