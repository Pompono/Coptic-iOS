# Optional account backup and progress sync — technical proposal

Status: **design only; no sign-in, database, or network syncing implemented by this document**.

## Existing progress stores

- `lib/progress.ts`: `coptic-progress` (XP, streak, completion).
- `app/learn/progress.ts`: `coptic-unit-progress:<unitId>`, `coptic-unit-failed-steps:<unitId>`.
- `lib/learning/progress.mjs`: `coptic-learning:v1` and spaced-review state.
- Additional saved vocabulary, reader, preferences and other local stores must be inventoried before claiming complete backup.
- **Reliability issue:** `readCompletedSteps()` catches malformed JSON and returns `[]`; a subsequent completion can overwrite the corrupt original. Fix loss-prevention independently of sync.

## Recommendation

Keep the app usable anonymously and offline. Offer optional **Sign in with Apple** for iOS, with optional email/provider alternatives only after checking current Apple sign-in rules. Back progress up to a server tied to a verified authenticated account, not to a device identifier. Consider Supabase Auth + Postgres with Row Level Security, but do not assume an existing backend/database is configured merely because the SDK is a dependency.

### Proposed rollout stages

1. **Make local storage safe first:** validate all stores, distinguish missing from corrupt, preserve malformed original payloads, version schemas, add explicit export/import JSON with validation and backups, atomic writes and tests. Never reset progress to fix a sync error.
2. **Define stable user-owned backup schema:** schema_version, account_id, dataset snapshots or records, updated_at, device change IDs, app version; treat provider IDs/emails as private. Avoid uploading raw translated text, photos, or reader drafts unless users explicitly opt in to that scope.
3. **Implement authentication securely:** Sign in with Apple via approved iOS flow, secure session storage, server-side auth verification, verified ownership, rate limits, lifecycle/logout, refresh/token revocation, recovery and account deletion. Never ship privileged service-role keys to the client.
4. **Use least-privilege storage:** Row Level Security ownership predicates on all progress records, server-side validation, encryption in transit, backups, retention plan and audit of security rules. Test unauthenticated/other-user reads and writes.
5. **Migration / conflict handling:** on first sign-in present choices to keep local progress or restore cloud data; never silently overwrite. Prefer union for completed lesson IDs, but reconcile XP/streaks and spaced repetition using explicit rules to avoid double counting. Keep a recoverable snapshot before merge.
6. **Offline-first sync:** queue local changes and retry with idempotent mutation IDs; synchronize on app activation/connection. Show Last synced / Sync pending / Sync error indicators. Account failures must never block local lessons.
7. **User controls:** optional sync toggle, export progress, delete local data separately from delete cloud account; implement accessible in-app account deletion where required, and update the privacy policy and App Store disclosures.
8. **Release/testing:** parallel-device tests, fresh-device restore, offline edits/conflicts, expired auth, reinstall, migration from existing installs, malformed payload, server outages, account deletion and security review.

## Scope and decisions before implementation

- Decide whether release 1.0 needs accounts or whether export/import backup is sufficient initially. Export/import is lower risk and much faster.
- Confirm backend ownership, chosen identity provider, costs and hosting, desired categories of synced data, retention period and support contact.
- Do not enable silent account creation, add new collection of personal information, or modify user progress data until reviewed.
