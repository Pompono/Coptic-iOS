# Local navigation readiness

## Scope and audit

Based on main `8d12fd9` (merged PR #13). The Settings host, navigation state machine, history helpers, gestures, CSS, focus behavior, auth provider, progress storage and sync services are unchanged.

| Surface | Cause before this change | Treatment |
| --- | --- | --- |
| Home | Exported useful content; local progress restored in an effect | Retained; no user data is prefetched |
| Learn, Dictionary, Translator, Account, Read, Vocabulary | Six `loading.tsx` files used `RouteLoading`: whole-page Opening text and a pale card while route assets resolved | Removed boundaries; App Router transitions retain the previous screen while preparing the destination |
| Settings root and Account/Preferences/Progress/Recovery submenus | Persistent navigation host imports real surfaces; account/session and sync checks are localized | Unchanged; preparing the Settings root also prepares its imported submenu code without mounting it |
| Learn unit map | Redundant `ssr:false` dynamic import displayed Loading your progress | Uses the same directly imported component as `/learn`; existing layout effect restores device progress before client paint |
| Lesson entry | Client-only dynamic import prevents randomized exercise answers from disagreeing with exported HTML | Retained client-only initialization; useful Practice heading and path back link replace bare Loading lesson text, with a delayed small status |
| Dictionary browse | Local worker loads/indexes bundled dictionaries; three large skeleton cards shown before results | Controls remain usable; skeletons replaced with a status only after 400 ms; existing error/retry and pagination retained |
| Dictionary detail | Search params require Suspense for static export; then bundled JSON fetch/normalization | Suspense has a Dictionary header; local lookup has delayed status; file failure and retry retained |
| Reader | Bundled dictionary preparation alongside passage UI | Delayed localized status; existing error handling retained |
| Vocabulary | Effect restores saved cards and current time | Delayed localized status; never treats uninitialized cards as an empty collection |
| Translator | Input renders immediately; published lookup/online request runs on submit | Translation progress, disabled submit and error states unchanged |
| Scanner | Photo decoding, OCR, model/worker initialization and suggestions | Genuine operation statuses unchanged; no scanner/model warmup |
| Auth callback/recovery, account forms | Session verification, sign-in, password recovery, submission | Truthful localized checking/waiting states unchanged |
| Cloud progress and recovery | Network operations, journal reads, explicit restore/backup actions | Status, errors and retry unchanged; preparation never mounts these effects |

## Preparation policy

The original `c655d44` change disabled per-link speculation because WebKit can abort speculative fetches during document navigation. It also avoids speculative work across hundreds of lesson links. `AppLink` still has `prefetch={false}`.

One root client effect now prepares the JavaScript modules for Settings, Learn, Dictionary, Translator and Home using ordinary dynamic imports. After two animation frames and a 750 ms delay, it schedules one module per idle opportunity, waiting for completion before spacing the next by at least 750 ms. The current route is skipped; attempts are deduplicated for the lifetime of the JS document. Hidden documents pause scheduling; resuming continues the remaining budget. Imports do not mount pages or run their React effects. No invalidation loop, persistent cache, service worker, document fetch, custom RSC parser or mounted hidden pages is introduced.

Webpack owns the code-module cache; Next continues to own navigation and route payloads, which are fetched on demand. Cache expiry/eviction is allowed; normal navigation can fetch again. The fixed budget does not promise instantaneous cold taps. A failed import is caught and does not prevent navigation or trigger repeated background retries. Exported local assets remain available in Capacitor airplane mode; online services remain online-only.

We tested the [Next.js manual prefetching API](https://nextjs.org/docs/app/guides/prefetching) on installed Next 16.1.6. It prepared the correct static segment payloads and passed ordinary tab tests, but the full WebKit Settings suite reproduced uncaught access-control errors on speculative Translator/Home fetches interrupted by document navigation. The final implementation deliberately uses caught module imports instead. The regression test asserts no speculative RSC requests and verifies completion marks for the bounded code preparations. Settings gesture tests retain their strict no-runtime-error assertion.

## Reliability and tradeoffs

- Up to four extra main-screen code preparations on a normal Home launch (five from a secondary deep link). Download/parse and in-memory module costs move some first-tap work into idle time; this is not a claim of zero memory or CPU cost. Route payloads still load on demand.
- No dictionary index, OCR model, translation model, lesson catalogue, auth response, token or user progress is warmed or persisted. Main route preparation must not start a dictionary worker or cloud write.
- Fast local work has no transient status; work exceeding 400 ms is announced in its relevant region. Real page headings and controls remain present.
- A route error boundary offers retry and a full-document Home recovery for a failed client resource. It cannot repair a corrupted native installation or browser bootstrap script that never executes.
- Removing route loading boundaries lets React preserve the current coherent page during a suspended transition. It does not make slow assets finish faster.

## Validation

`npm run test:routes` serves the production export and opens a fresh mobile browser context for each first tab entry. It records video, cold screenshots and click-to-heading timings, then tests repeat navigation, a bounded warmup, delayed route responses and failed dictionary assets with retry. External requests are blocked throughout, modeling a native package with no internet (not an offline HTTP server). Light/dark and Reduced Motion contexts are included. These timings include Playwright click scheduling and are not physical-device latency measurements.

The existing mobile suite, Settings navigation suite (push/pop, interactive swipe completion/cancellation, rapid actions, history, focus, Reduced Motion), backup regressions, auth/sync Node tests and disposable PostgreSQL tests remain in CI. Both Chromium and WebKit cold-route runs upload recordings. macOS builds, simulator startup, Capacitor sync and unsigned device IPA packaging use the existing validation workflow.

Before/after structural result: six generic route boundaries and three dictionary skeleton cards per initial search removed; unit-map dynamic placeholder eliminated. No baseline physical-iPhone timing or memory measurement is available from this Windows environment. Physical iPhone cold launch, airplane mode, background/resume and swipe feel must still be checked with the resulting IPA; desktop WebKit is not a physical WKWebView.
