# Hosted translation architecture

Phase 1 is PR #3 (Translator screen). Phase 2 is the stacked scanner migration;
its base is PR #3's `feat/hosted-ios-translation` branch. Do not merge phase 2
before its dependency or duplicate phase 1 into another main-based PR.

All app AI translation uses `translationService.ts` and `hostedTranslation.mjs`:
- `POST https://coptlingo.com/api/translate` for Coptic → English.
- `POST https://coptlingo.com/api/translate/en-coptic` for English → Coptic.

Direct Capacitor native HTTP bypasses browser CORS without patching global fetch.
No backend key is required in the client: the website authenticates to FastAPI.
HTTPS and endpoint allowlisting are enforced; redirects are disabled. Text,
dialect and confidence options are preserved. Requests have a 30-second deadline
and no automatic retries. Safe errors cover offline, timeout, 429 and upstream
failure. Retry-After is preserved for scanner cooldowns. Bridge logging is off.
Capacitor iOS 7 uses connectTimeout ahead of readTimeout for the URLRequest; both
are 30 seconds, accommodating the proxy's 25-second budget.

Cancellation aborts browser fetch and ignores stale results. Capacitor 7 does not
expose cancellation of an underlying native request; it may finish on the server
after Stop/navigation. The native in-flight guard blocks new native translations
until it settles. Stop prevents subsequent scanner requests and preserves already
accepted chunks; no already-transmitted text can be recalled.

Published matching calls `localTranslation/referenceClient.ts` directly. It works
offline using the bundled supported Bohairic corpus, independent of model weights,
without the AI limit and without an AI fallback. Unsupported/unmatched input is
explained. Both published lookup and scanner source suggestions now use an
AbortController/timer loader, fixing PR #3's older-iOS AbortSignal.timeout issue
without modifying PR #3 or raising the deployment target.

The scanner's former direct local-inference path is replaced by a reviewed,
immutable text-only plan and a paced queue. OCR, images, corrections and overlays
remain local. [Phase 2 details](scanner-hosted-migration.md) document approval,
splitting, partial results, cooldowns, privacy and release validation.

The local model client/worker, decoder, exporters and evaluation scripts remain
for development, but no app import/worker can reach them. A graph regression test
checks this. Normal prebuild no longer copies ONNX runtime. Postbuild strips old
translation weights/runtime from release output, and asset/IPA gates reject them
while checking required OCR and offline content. Tesseract is not removed.

The public proxy returned successful translations without a private key during
phase 1 checks, but does not emit browser CORS headers. Cross-origin browser
preview AI remains unsupported and is mocked in smoke tests. Native URLSession
has no browser CORS restriction. Existing server protections and rate limits are
unchanged; a shared NAT may still receive 429. There is no new backend or AWS
service, and the legacy backend directory is not deployed by these changes.

Physical iPhone networking, memory, camera/photo permissions and OCR quality still
need validation; simulator compile/startup does not replace device testing.
