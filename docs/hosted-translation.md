# Hosted Translator migration

## Architecture and behavior

The Translator screen's **Experimental AI · online** method now always sends text
to the existing website proxy. Coptic → English uses
`https://coptlingo.com/api/translate`; English → Coptic uses
`https://coptlingo.com/api/translate/en-coptic`. Both forward text, dialect, and
the confidence option. AI never loads the local model or substitutes a published
match. Changing methods clears the old result so its provenance is unambiguous.

**Published text match** calls `localTranslation/referenceClient.ts` directly.
The bundled Bohairic corpus works offline without the AI weights. Unmatched or
Sahidic input produces an explicit explanation; it does not request AI. The AI
limit is 1,200 Unicode code points, checked in the screen and shared request layer.
Published lookup is not capped by that server limit.

The former local-inference paths were `translationService.ts` →
`localTranslation/client.ts` → `worker.ts`, and the scanner's direct calls to that
same client. `decode.mjs`, beam search, preprocessing, segmentation, model
weights, and `public/local-runtime` support the worker. The Translator/service
no longer import that client. The scanner still does, so those assets and
dependencies are retained. OCR uses a separate Tesseract worker and its own
`public/ocr` assets; image processing and source/mark review are local.

No new models, backend, AWS service, or private key are needed. No frontend env
override is used: the request layer selects only the two public website paths.
The legacy `backend/` is not used or changed. There are no AWS deployment changes.

## Native HTTP, privacy, and reliability

Direct `CapacitorHttp.post` uses the existing Capacitor 7 native plugin. Enabling
the optional global fetch/XHR patch is unnecessary. Source inspection confirms
iOS uses URLSession, supports JSON requests and redirect rejection, and selects
`connectTimeout` over `readTimeout` for its URLRequest timeout. Both are set to
30 seconds to allow the website proxy's 25-second deadline. An independent
30-second JS deadline also bounds waiting. HTTPS is enforced and redirects are
disabled. No app authentication headers or private API credentials are sent.

There are no automatic retries. Offline, timeout, malformed response, service
failure, and HTTP 429 errors have clear messages without raw backend diagnostics.
Cancellation aborts browser fetch and ignores late results after navigation or
input/method changes. Capacitor 7 has no request-cancellation API: its underlying
native task can continue after the caller cancels; a pending guard prevents
starting another native translation until that task settles. Server inference
may still complete. Bridge logging is disabled because Capacitor otherwise logs
plugin results, which can include translated text. Application code does not log
submitted text or responses.

Both public endpoints returned HTTP 200 for one small request each during this
investigation, including `Origin: capacitor://localhost`, with translations,
confidence, Bohairic dialect, and `RateLimit-Limit: 30`. No private key was used.
Responses had no `Access-Control-Allow-Origin`. This is suitable for the native
bridge, which is outside browser CORS; a cross-origin browser preview cannot
currently call it directly. Browser tests mock AI responses. The website's rate
limits/protections are unchanged; shared Wi-Fi/NAT clients may share a limit.
Production latency, availability, and device networking still need monitoring.

## Scanner: preserved now, separate implementation plan

The scanner's existing promise that photographs and recognised text stay on-device
remains true. Its OCR, photo import, rotation/cropping, contrast changes, source
correction, mark review, editing, translation overlays, cancellation, and offline
translation behavior are unchanged. No photographs or OCR text are uploaded.
Its translation controls still require the offline-model build, as before.

Migrating it safely requires a separate change:

1. Keep Tesseract OCR and all photo manipulation local. Introduce an explicit
   online AI choice with a disclosure **before submission** that only corrected
   recognised text is transmitted over HTTPS. Never auto-send during OCR or
   upload photos. Separate local published matching from AI without fallback.
2. Preserve region IDs/coordinates, overlay rendering, dialect, provenance, and
   edited text. Associate each result with the submitted revision and ignore late
   results after editing, changing methods, clearing the photo, or stopping.
   Completed blocks must survive partial failures and cancellation.
3. Validate every submitted block after all correction paths. Recognition caps
   results at 24 regions and usually groups up to four lines/600 UTF-16 units,
   but an individual long line can exceed that grouping target. Source-review
   acceptance can also bypass the editor's `maxLength`. Reject over-1,200-code-
   point blocks with instructions to edit/split; never silently truncate them.
4. Send one block at a time. A 24-block page nearly consumes the proxy's
   30-per-minute IP budget; another page, Translator request, or shared NAT client
   can exceed it. Pace starts (at least ~2.1 seconds apart), pause on 429 using
   `Retry-After`, expose progress/stop/resume, and avoid automatic replay/retry
   bursts. Do not combine blocks into a request exceeding the text limit.
5. Test online/offline switching, 429/timeout mid-page, long corrected blocks,
   stale responses, no photo network payloads, and overlay alignment with real
   OCR on iPhone. Preserve existing local scanner support until this is accepted.
6. Only then remove the scanner's inference imports and runtime/model packaging
   from standard builds. Retain exporter/evaluation scripts or explicitly move
   them to a documented legacy/development workflow. Update the offline-IPA
   workflow and verifier rather than deleting assets they still require.

## Packaging and checks

The normal clean checkout already has no generated 145 MB model weights. The
explicit `offline-ipa.yml` workflow generates/downloads them and its verifier
requires their hashes. The prebuild still copies the ONNX runtime (about 32 MiB
in this checkout); retaining it preserves scanner support when optional weights
are installed. No model/runtime, exporter, evaluation tool, or offline-IPA
workflow is removed. Dictionary, lessons, audio, and published corpus remain.

Tests cover both native/browser transports in both directions, limits, offline
errors, cancellation, timeout recovery, native in-flight guarding, malformed
responses, HTTP errors, and no retries. Mobile smoke tests use the real published
corpus offline and mock AI calls, independent of whether weights are installed;
the scanner's existing optional-model tests remain. CI now explicitly runs
TypeScript and ESLint in addition to its existing tests/export/simulator build.

The Linux cloud workspace cannot run Xcode or create/inspect an actual device IPA.
An IPA size comparison with/without weights is therefore unavailable; no claim
is made about a compressed IPA size reduction. Native device runtime behavior
must be checked on macOS/iPhone. No IPA workflow is dispatched or published by
this task. Validation in this workspace: all 74 unit tests passed; TypeScript and the
production export passed; ESLint reported no errors and nine existing warnings.
The targeted Chromium Translator smoke passed. All 14,240 exported files passed
the private-configuration/key-marker scan. Capacitor iOS sync passed and copied
`loggingBehavior: none`. No optional local model weights were present, so actual
scanner AI inference was not executed here. Full mobile smoke and CI status are
recorded in the pull request.
