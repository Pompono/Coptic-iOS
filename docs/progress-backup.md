# Local learning progress and backups

## Storage audit

All learning records use WebView/browser `localStorage`. No learning records were found in Capacitor Preferences, IndexedDB, server storage, or cookies. Existing key names and JSON shapes are retained. No migration, Unicode normalization, lesson content, XP calculation, streak calculation, or review algorithm is changed.

| Key | Writer / reader | Shape and purpose |
| --- | --- | --- |
| `coptic-progress` | `lib/progress.ts` | `{xp, streak, lastCompletedDate: string|null, completedLessons: string[]}`. Legacy XP/streak helper currently has no production callers; preserved for existing users. |
| `coptic-unit-progress:<unitId>` | `app/learn/progress.ts`; home, learning hub and unit screens | Array of completed step IDs. Unknown/legacy unit and step IDs are retained. |
| `coptic-unit-failed-steps:<unitId>` | `app/learn/progress.ts`; lesson clients and unit screen | Array of failed step IDs. Empty arrays are valid; no longer need removal for empty state. |
| `coptic-learning:v1` | `lib/learning/progress.mjs`; LearningSession and UnitMastery | `{version:1, skills:{[learningId]: skill}}`. Skills retain word, meaning, unitId/unitIds, audio, pos, explanation, accepted, attempts, correct, lapses, dueAt, lastSeen, successfulDays, lastSuccessfulDay, needsPractice. This is quiz performance and mastery, separate from saved vocabulary. |
| `coptic-vocabulary:v1` | `lib/vocabulary/store.ts` / `schedule.mjs`; SaveWord, vocabulary review and LearningSession | `{version:1,cards:[...]}`. Cards retain id, word, meaning, pos, dialect, context, source, audio, createdAt, dueAt, intervalDays, reviews, lapses, streak, lastReviewedAt. There is one saved collection. |
| `coptic-reader:v1` | Reader and home | `{version:1,passageId,draft}`. Last chosen bundled passage or saved custom text, maximum 6,000 UTF-16 code units. No per-word reading position is persisted. |

In-progress lesson phase, exercise position, typed answers and current-session attempts are React memory only. They are not recoverable across app restarts and are not added by this phase.

Excluded storage: `coptic-dictionary-search` in sessionStorage (search state), `coptic-dictionary-preferences`, `coptic-dictionary-recent` (search history), font/theme/language and keyboard preferences/prompts. Bundled dictionary/model/audio files and service worker caches are content, not learning records. No whole-storage export is performed.

## Risks and protections

Previously, unit readers converted invalid JSON, wrong shapes and mixed arrays to an empty list, enabling the next write to erase the original. XP parsing had no shape validation, writes could accept invalid data, vocabulary writes did not check the previous record, reader writes could overwrite unsupported data, and the developer reset removed multiple keys without recovery. Storage access errors were inconsistently handled.

`lib/progressStorage.ts` now provides the provider-independent boundary:

- `validateRecord` validates each allowlisted existing format. Existing learning/vocabulary parsers remain the schema foundation; optional legacy fields can remain absent. Future/unknown versions and malformed records block updates; unknown course IDs are preserved.
- `readRecord` returns null only for a missing key and throws for unreadable records. Unit presentation readers return null for unreadable records and report the error to the app-wide notice. Screens may omit unavailable steps but explicitly warn that progress could not be loaded; mutation functions always use strict reads and cannot build on that presentation fallback.
- `writeRecord` validates both the new value and the current stored value. Exceptions propagate to callers and publish an app-wide storage warning. Existing lesson calculations are unchanged.
- `makeBackup`, `parseBackup`, `backupSummary`, `restoreBackup` separate serialization, validation and restore from learning updates. Backup format is `{format:"coptic-progress-backup",version:1,exportedAt,records:{[key]:rawJSON}}`. Keeping raw strings preserves combining marks, schedules, unknown compatible fields and formatting exactly. Backups are not encrypted; users choose where to keep their saved passage and vocabulary context.

## Restore and recovery

Selecting a JSON file (maximum 20 MB) validates every record and the backup version before showing the date, XP, streak, lesson/step counts, vocabulary, practice item and passage counts. Cancel does not mutate storage. Explicit confirmation replaces the allowlisted records, including deleting existing learning records absent from the backup; no merge occurs. Unrelated storage is untouched.

Before any replacement, `coptic-progress-recovery:v1` receives and verifies the entire original allowlisted snapshot, including malformed raw records, and `coptic-progress-transaction:v1` receives and verifies a rollback journal. Writes/removals are verified. Any failure rolls back; if rollback is blocked, the journal survives. All normal learning reads/writes attempt rollback first and remain blocked until it succeeds. Startup also attempts recovery. This protects against partial writes and interruption before the commit marker (journal removal). If there is insufficient quota to save recovery/journal, restore aborts before touching learning records. The developer reset uses the same transaction, keeps vocabulary/reader, and refuses damaged progress.

Settings offers export of the raw recovery file and an explicitly confirmed recovery action. Raw recovery files have a separate format because they can contain damaged records and must not be imported as validated normal backups. The recovery action can restore those original bytes; normal validation then blocks damaged records again. Keep the recovery export before another restore/reset, which replaces the single retained snapshot. Successful import emits learning/vocabulary change events and offers Reload app to reinitialize all screens.

LocalStorage operations are synchronous and per-key atomic, but this is a journaled recoverable transaction, not an ACID database. Avoid simultaneous learning/restoration in multiple browser tabs. A future multi-device system needs explicit conflict policy and a transactional database boundary; this phase adds no networking, account, auth or provider configuration.

## iOS integration and verification

Export uses Capacitor Filesystem (UTF-8 JSON in app Cache) and Share to present the native share sheet, including Save to Files. No broad Documents/file-sharing permission is needed. Cache is temporary: users must actually save/share the backup outside the app; closing/cancelling the sheet is not reported as a successful external save. Cache files remain available to share recipients until the OS purges them. Browser export uses a JSON Blob download. Import uses WKWebView's native HTML file picker and File.text().

`npx cap sync ios` registers Filesystem and Share in the SPM package. `App/PrivacyInfo.xcprivacy` is included in Xcode Resources with file-timestamp reason C617.1 as required by Filesystem. Run `npm run ios:sync` after dependencies/build changes on a Mac. No new service, external upload, authentication or app name/website material is introduced.

Physical iPhone checklist (not performed in this Linux workspace): compile/archive with Xcode; confirm share-sheet Save to Files, cancellation, filenames and Unicode; pick the JSON from On My iPhone/iCloud Drive; confirm/cancel restore; relaunch offline and verify completion, XP/streaks, vocabulary due dates/mastery and saved passage; test limited device storage and app interruption; verify recovery and app background/foreground behavior. Also check iPad share-sheet anchoring if supported. Simulator/WebKit checks complement but do not replace device verification.

Automated verification: `npm test` covers legacy loading, corrupted/unsupported data, unavailable storage, empty backups, exact Unicode/schedule round trips, explicit confirmation/cancellation, failed restore, partial writes/removals and restart recovery, plus existing learning behavior. `npm run test:backup` runs the mobile-sized production UI flow, and `npm run test:mobile` exercises the existing app flows. TypeScript, ESLint and the production build are required checks.

## Next phase

Add optional Apple, Google and email/password authentication behind a provider-neutral account interface. Reuse the validated record/backup boundary, then define schema evolution, stable record identity, revision/timestamp semantics, conflict handling, offline queueing and explicit consent for the initial local/account reconciliation. Choose hosted or self-hosted infrastructure later. Keep local learning usable without an account.

## Verification results for this change

- `npm test`: passed, all 20 test files (including the new backup tests).
- `node --test --test-isolation=none tests/progressBackup.test.mjs`: all 14 focused cases passed.
- `npm run typecheck`: passed; the final production build also ran TypeScript successfully.
- `npx eslint .`: zero errors, nine existing warnings. The final preference/storage fixes and backup browser script also passed targeted ESLint.
- `NEXT_TELEMETRY_DISABLED=1 npm run build`: passed (1,284 static pages).
- `npm run test:backup`: passed on the final build in Chromium at 390×844, including complete storage denial without a Settings crash.
- `npm run test:mobile`: passed the existing Chromium suite, including lesson completion/persistence, mastery, vocabulary reviews, reading, layouts, audio, OCR and blocked external-network checks. Its Settings dock check now scrolls to Developer controls before asserting clearance because Settings gained a section. The final follow-up only adds the denied-language-preference fallback and uses the older-iOS-compatible property-existence check; focused storage/UI tests passed again afterward.
- `npx cap sync ios`: passed with all four native plugins registered; privacy plist parsed and Xcode resource references checked. Xcode, simulator compilation and physical iPhone testing were unavailable.

Environment note: the existing ONNX install script attempted a GPU binary download that failed. Dependency installation completed with `--ignore-scripts`; the production web build and browser suites passed. No dependency install scripts or existing model configuration were changed.
