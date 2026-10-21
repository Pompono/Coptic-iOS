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

Validated JSON backup serialization and parsing remain internal to cloud transfer, conflict handling, and recovery. Routine manual import and export controls are hidden from Settings. The Progress page offers a recovery action only when an automatic recovery copy exists; that action uses the existing validated transactional restore path.

Before any replacement, `coptic-progress-recovery:v1` receives and verifies the entire original allowlisted snapshot, including malformed raw records, and `coptic-progress-transaction:v1` receives and verifies a rollback journal. Writes/removals are verified. Any failure rolls back; if rollback is blocked, the journal survives. All normal learning reads/writes attempt rollback first and remain blocked until it succeeds. Startup also attempts recovery. New journals carry a snapshot checksum and a 30-second owner lease: a second window cannot mistake an active restore for a crash. After interruption, wait 30 seconds and reload; legacy journals without lease metadata recover immediately. Every transaction mutation rechecks its journal marker. Ordinary writes reject values changed since their last read, and the import confirmation rejects current progress changed since its preview. This protects against partial writes and interruption before the commit marker (journal removal). If there is insufficient quota to save recovery/journal, restore aborts before touching learning records. The developer reset uses the same transaction, keeps vocabulary/reader, and refuses damaged progress.

The Progress page exposes recovery only when a retained copy exists. If a journal is malformed, unsupported, or fails its snapshot checksum, normal reads/writes preserve it and stop. Confirmed recovery first saves and verifies the damaged journal under `coptic-progress-damaged-journal:v1`, then uses the intact recovery copy. If quarantine cannot be saved, no original data is touched. Raw recovery files have a separate format because they can contain damaged records and are not accepted as normal backups. Cloud downloads preserve the prior device snapshot in `coptic-progress-cloud-recovery:v1`; the Progress page can restore it if needed. These recovery actions continue through the same journal, rollback, and validation protections.

LocalStorage operations are synchronous and per-key atomic, but this is a journaled recoverable transaction, not an ACID database. Avoid simultaneous learning/restoration in multiple browser tabs. This local backup layer does not change its storage format or transaction behavior. Cross-device synchronization is documented separately in `progress-sync.md`.

## iOS integration and verification

The native Filesystem and Share integration remains available to internal backup and recovery code. Cloud replacement uses validated snapshots, revision checks, and the transactional recovery copy before any local install. Routine manual file import/export is no longer part of Settings.

`npx cap sync ios` registers Filesystem and Share in the SPM package. `App/PrivacyInfo.xcprivacy` is included in Xcode Resources with file-timestamp reason C617.1 as required by Filesystem. Run `npm run ios:sync` after dependencies/build changes on a Mac. The local backup and recovery feature remains available offline and independent of account sync.

Physical iPhone checklist (not performed in this Linux workspace): compile/archive with Xcode; confirm share-sheet Save to Files, cancellation, filenames and Unicode; pick the JSON from On My iPhone/iCloud Drive; confirm/cancel restore; relaunch offline and verify completion, XP/streaks, vocabulary due dates/mastery and saved passage; test limited device storage and app interruption; verify recovery and app background/foreground behavior. Also check iPad share-sheet anchoring if supported. Simulator/WebKit checks complement but do not replace device verification.

Automated verification: `npm test` covers legacy loading, corrupted/unsupported data, unavailable storage, empty backups, exact Unicode/schedule round trips, explicit confirmation/cancellation, failed restore, partial writes/removals and restart recovery, plus existing learning behavior. `npm run test:backup` runs the mobile-sized production UI flow, and `npm run test:mobile` exercises the existing app flows. TypeScript, ESLint and the production build are required checks.

## Emergency recovery

Open Settings → Progress. If a cloud restore or earlier progress transaction created a recovery copy, the matching recovery action appears there and requires confirmation before replacing current progress. Cloud conflicts stay on the Progress page with both copies available for review. Guest learning remains local and does not require registration. The validated backup parser, transactional restore, rollback journal, cloud recovery copy, and tests remain intact behind the removed manual file controls.

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


## Final hardening review

The follow-up review adds live-journal isolation and accidental-corruption detection, stale-write/confirmation rejection, explicit damaged-journal recovery, current-progress summaries, strict UTF-8 file validation, automatic UI reload, native cancellation handling and bounded temporary-export retention. No learning storage format, XP/streak calculation, curriculum or branding changes.

CI now runs typecheck, ESLint and backup UI tests alongside the existing checks. The macOS job verifies the **built** app's privacy manifest, Filesystem/Share registration and unchanged iOS 14 deployment target. Its Debug-only simulator fixture exercises real Capacitor file export and Share Sheet presentation/cancellation, inspects exported JSON and combining marks, and programmatically feeds files through the actual import UI (preview, cancellation, unsupported version, confirmation and reload persistence). The fixture is copied only in CI into a disposable Debug simulator app; no release code executes it. This does **not** automate the native Files/iCloud document-provider selection or a successful external Save to Files.

Residual limits: localStorage offers no cross-process compare-and-swap. The journal lease/ownership checks and stale-value guards reject observed concurrent operations, but multiple simultaneously writing browser windows are not an ACID transaction system. Use one window for restoration. A suspended transaction cannot resume after another context has replaced its journal marker. OS deletion/eviction/uninstall and unavailable storage cannot be overcome by an in-app recovery copy; keep an external backup. Journal checksums detect accidental corruption, not malicious edits. Legacy unchecksummed journals remain supported. If both the journal and retained recovery copy are damaged, automatic repair cannot reconstruct lost bytes; preserve/export evidence rather than reset anything. Native cleanup is best effort; successful temporary files are pruned only when another export occurs or the OS evicts Cache.

### Physical iPhone acceptance checklist

Install the build over the previous app without uninstalling it. Confirm existing lesson, vocabulary, practice, reader, XP, and streak data remains available. Guest learning must work offline without registration. After signing in, verify safe synchronization against an account with an existing cloud snapshot and against a fresh account. A fresh device with no local progress should restore a validated cloud snapshot after saving a recovery copy. A device with different nonempty local progress must show both copies and wait for an explicit choice. Sign out and switch accounts; verify no account's cloud snapshot is installed into another account's local state. Enable Airplane Mode during learning, then reconnect and confirm pending progress syncs. Trigger a concurrent edit on a second device and confirm the revision conflict is reviewed rather than overwritten. Test the Recovery actions on Progress and verify cancel leaves progress unchanged. Check the Settings routes, safe-area padding, Dynamic Type, VoiceOver labels, and that the five-tab navigation remains selected on every Settings submenu. Never uninstall or clear app data during recovery validation.
