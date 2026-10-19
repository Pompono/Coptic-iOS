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

Before any replacement, `coptic-progress-recovery:v1` receives and verifies the entire original allowlisted snapshot, including malformed raw records, and `coptic-progress-transaction:v1` receives and verifies a rollback journal. Writes/removals are verified. Any failure rolls back; if rollback is blocked, the journal survives. All normal learning reads/writes attempt rollback first and remain blocked until it succeeds. Startup also attempts recovery. New journals carry a snapshot checksum and a 30-second owner lease: a second window cannot mistake an active restore for a crash. After interruption, wait 30 seconds and reload; legacy journals without lease metadata recover immediately. Every transaction mutation rechecks its journal marker. Ordinary writes reject values changed since their last read, and the import confirmation rejects current progress changed since its preview. This protects against partial writes and interruption before the commit marker (journal removal). If there is insufficient quota to save recovery/journal, restore aborts before touching learning records. The developer reset uses the same transaction, keeps vocabulary/reader, and refuses damaged progress.

Settings offers export of the raw recovery file and an explicitly confirmed recovery action. If a journal is malformed, unsupported, or fails its snapshot checksum, normal reads/writes preserve it and stop. Confirmed recovery first saves and verifies the damaged journal under `coptic-progress-damaged-journal:v1`, then uses the intact recovery copy. If quarantine cannot be saved, no original data is touched. Raw recovery files have a separate format because they can contain damaged records and must not be imported as validated normal backups. The recovery action can restore those original bytes; normal validation then blocks damaged records again. Keep the recovery export before another restore/reset, which replaces the single retained snapshot. Successful import emits learning/vocabulary change events and automatically reloads the app to reinitialize all screens. A session-only success notice survives that reload where sessionStorage is available. Both the incoming backup and the current device progress are summarized; changed current data requires a fresh preview. UTF-8 decoding is strict (a UTF-8 BOM is supported), so invalid byte sequences cannot silently become replacement characters.

LocalStorage operations are synchronous and per-key atomic, but this is a journaled recoverable transaction, not an ACID database. Avoid simultaneous learning/restoration in multiple browser tabs. This local backup layer does not change its storage format or transaction behavior. Cross-device synchronization is documented separately in `progress-sync.md`.

## iOS integration and verification

Export uses Capacitor Filesystem (UTF-8 JSON in app Cache) and Share to present the native share sheet, including Save to Files. No broad Documents/file-sharing permission is needed. Cache is temporary: users must actually save/share the backup outside the app; closing/cancelling the sheet is not reported as a successful external save. Successful export files remain available to asynchronous recipients. On the next export, owned files older than 24 hours are pruned from the dedicated `progress-backups` Cache folder; cancellation/errors delete the current temporary file where possible. Cleanup errors never affect learning records. Native Share cancellation is a normal cancelled outcome, not a successful external save or a restore failure. Browser export uses a JSON Blob download. Import uses WKWebView's native HTML file picker and File.arrayBuffer() and strict UTF-8 decoding.

`npx cap sync ios` registers Filesystem and Share in the SPM package. `App/PrivacyInfo.xcprivacy` is included in Xcode Resources with file-timestamp reason C617.1 as required by Filesystem. Run `npm run ios:sync` after dependencies/build changes on a Mac. The local backup and recovery feature remains available offline and independent of account sync.

Physical iPhone checklist (not performed in this Linux workspace): compile/archive with Xcode; confirm share-sheet Save to Files, cancellation, filenames and Unicode; pick the JSON from On My iPhone/iCloud Drive; confirm/cancel restore; relaunch offline and verify completion, XP/streaks, vocabulary due dates/mastery and saved passage; test limited device storage and app interruption; verify recovery and app background/foreground behavior. Also check iPad share-sheet anchoring if supported. Simulator/WebKit checks complement but do not replace device verification.

Automated verification: `npm test` covers legacy loading, corrupted/unsupported data, unavailable storage, empty backups, exact Unicode/schedule round trips, explicit confirmation/cancellation, failed restore, partial writes/removals and restart recovery, plus existing learning behavior. `npm run test:backup` runs the mobile-sized production UI flow, and `npm run test:mobile` exercises the existing app flows. TypeScript, ESLint and the production build are required checks.

## Next phase

Add optional Apple and Google authentication behind the provider-neutral account interface. Cloud progress sync now uses the validated record boundary, explicit consent, optimistic revisions and conflict review. Keep local learning usable without an account.

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

Use a disposable test profile or keep an external backup before testing replacement. Install this build **over** the previous app without uninstalling; existing completion, vocabulary and reader state should still be present. Record screenshots/counts and a baseline exported JSON so schedules and XP/streak values can be compared exactly, even if they are not currently shown in the app UI.

1. Complete a lesson, deliberately miss a step, save two vocabulary words (including Coptic combining marks), review a word, and save a custom reader passage. Relaunch: all persisted records should remain. Current lesson position is intentionally memory-only.
2. Open Settings → Progress & Backup → Export Progress. Expect the native Share Sheet and a dated `.json` file. Choose **Save to Files** → **On My iPhone**, then verify a nonempty JSON file exists and opens. Do not infer a save just from closing the sheet.
3. Export another copy to iCloud Drive if available. Expect the file to finish uploading and remain selectable. Use the On My iPhone copy for offline testing.
4. Change progress: complete another step, save another word and review an existing word. Export a second JSON for comparison. The state should differ from the first backup.
5. Import the original JSON using the actual Files picker (also try the iCloud copy while online). Expect the original backup summary **and current-device summary**, plus an explicit replacement warning. Nothing should change yet.
6. Tap **Cancel**. Relaunch and export again: XP, streak, completion, failed steps, vocabulary/history/schedules and reader records should still match the changed state from step 4. The picker’s Cancel button should also leave everything unchanged.
7. Select the original file again and tap **Replace progress and restore**. Expect success and an automatic reload. The restored JSON `records` should exactly equal the original backup’s `records`; only the outer export timestamp changes. Check XP/streak fields, completed lesson/step IDs, failed steps, vocabulary `dueAt`/interval/reviews/lapses/streak/lastReviewedAt, learning mastery/due data, and exact Coptic combining marks. The extra word/step from step 4 should be absent because this is replacement.
8. Fully close and reopen the app. Expect restored progress and passage to persist. Export immediately again and compare the records with the original file. Visit Home, Learn, the unit map, Vocabulary and Reader; none should show the later state.
9. In Recovery copy, export the raw recovery file and confirm it contains the changed state from step 4. If testing recovery itself, explicitly confirm **Recover previous progress**; expect that state to return after reload. Raw recovery exports are intentionally not accepted as ordinary imports.
10. Export and tap Cancel/close on the Share Sheet. Expect **Export cancelled**, no claim of an external save, and unchanged progress. Try an invalid JSON or unsupported-version backup: expect a clear error and unchanged existing records. If any restore fails, stop and retain the original backup/recovery file; never reset/reinstall to troubleshoot.
11. Enable Airplane Mode. Open lessons, vocabulary review and the reader, export through Save to Files, import the local On My iPhone copy and relaunch. Expect local learning and backup/restore to work without an account or network. iCloud-only files may require downloading before going offline.

Treat a crash, frozen Share Sheet/picker, missing file, false success after cancellation, changed raw records before confirmation, mismatched restored records, stale UI after reload, or lost state after relaunch as a failure. Record the build/OS version, last action, error text/screenshots and original/after JSON files; do not delete the app or progress. On iPad, also check that the Share Sheet popover is correctly anchored.
