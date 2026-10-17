# Scanner hosted translation migration

## Dependency and implementation plan

This is a separate, stacked change on PR #3's hosted request layer. PR #3 is not
modified, duplicated, or merged. The implementation follows these stages:
1. Keep OCR, photograph import/editing, mark/source correction and coordinates local.
2. Require review of an immutable text snapshot and explicit approval before AI.
3. Split long blocks losslessly; process requests sequentially with conservative
   pacing, cancellation, cooldowns, and resumable successful chunks.
4. Verify that no app entry point needs local AI, then exclude its weights/runtime
   from final release artifacts while retaining offline content and OCR.
5. Test the actual UI, mocked native/browser transport, export, simulator/device
   archives and privacy/artifact gates without publishing or deploying anything.

## User approval and privacy

OCR, selecting AI, and editing never trigger a translation request. Translate block
or Translate remaining blocks opens a review panel showing the full text, dialect
selection retained from the scanner, block/part counts and HTTPS disclosure.
A fresh checkbox approval and Send approved text action are required every time,
including resume. Cancel returns to editing. Other mutation controls are disabled
while review is open and while a queue is running, protecting the reviewed snapshot.

The request body is constructed exclusively from text, dialect and confidence
option. No photo, crop, data URL, bounding box, OCR confidence or metadata is sent.
Only selected/remaining recognized regions enter the plan. Photos never leave the
device. AI text goes to coptlingo.com via the existing authenticated website proxy;
the backend key stays server-side. There are no client credentials or new services.
No sensitive text/response logging is added, and Capacitor bridge logging stays off.

Published lookup and source suggestions stay local, work offline without AI weights,
and never silently call AI. AI never substitutes a published match. Edited image state, drafts and resume caches are screen-local and reset when the
photo is cleared or the screen is left; nothing is added to progress/account
storage. Camera/photo-picker plugins may use OS-managed local temporary files;
clearing the screen does not promise secure deletion of OS caches.

The server necessarily receives approved text and connection metadata such as IP.
Server logging/retention policies are not established by this app change. Reconcile
the separate privacy-policy drafts and App Store disclosures before release; do
not claim that scanner AI stays offline or that server text is never retained.

## Splitting, queue and recovery

The split planner counts Unicode code points, preserving the exact trimmed source
when chunks are concatenated. Chunks are at most 1,200 points, break at whitespace
or sentence punctuation, and never begin with a detached combining mark or split a
surrogate pair. A single oversized unbroken word is refused before any transmission
with a request to correct a boundary. Nothing is silently truncated. Existing pure OCR-artifact and fragment/repetition
validation is retained without inference: damaged input is refused before review,
and unreliable output cannot enter overlays or the successful resume cache. The editor no
longer truncates pasted long blocks. Separately translated chunks can lose context;
this limitation is visible in the scanner.

Each request uses the shared native HTTP transport, HTTPS only, no redirects or
retries. Starts are at least 2.5 seconds apart (~24/minute), leaving some margin
under the proxy's 30/minute rate. This is not a guarantee for shared Wi-Fi/NAT or
multiple app screens. Native in-flight guarding also remains in force.

A 429 immediately stops the run without retrying. Retry-After seconds or HTTP dates
are honored with a conservative minimum 60-second cooldown. Later, user-approved
resume waits out that cooldown; photo clearing cannot reset it during the current
screen session. Backend rate limits still apply across screen/app restarts.

Successful chunks are cached by original text and dialect in memory. On each chunk,
the original region ID/coordinates and a clearly labeled partial draft are retained.
A later error/Stop keeps completed blocks and partial chunks; resumed runs send only
missing chunks. Changed text or dialect cannot reuse the wrong draft. No failed
request is automatically replayed. Published matching also keeps earlier completed
blocks if a later lookup has no match.

Stop cancels pacing and browser fetch, invalidates the operation ID, and rejects
late results before they enter the cache or overlays. Navigation/reset clears the
cache. A native request already sent may still finish; Capacitor 7 cannot physically
abort it. Its response is ignored and no next part is sent. The user is told that
already-transmitted text cannot be recalled.

## Packaging and build validation

All app imports/workers are traversed by a regression test: none reach the old AI
client/worker/decoder or Transformers/ONNX. Developer exporters, model notices,
evaluation scripts and legacy source remain; Transformers is a dev dependency.
Normal builds stop copying the ONNX runtime. The final export prunes only generated
`out/models/coptic-english` and `out/local-runtime`, even if developer source weights
exist. Source weights/tools are not deleted. Capacitor copies the pruned out/ tree.

Release gates inspect both out/ and copied native WebView assets: no ONNX files,
local translation runtime, private translation configuration/direct backend URL or
private-key markers; required OCR, corpus, dictionary and audio must remain. The
IPA verifier checks arm64, offline content and OCR checksum and rejects AI assets.
The validation workflow creates and verifies an unsigned device IPA temporarily
without uploading it. The historical offline-ipa.yml is now a manual hosted-IPA
builder without model generation/download; it is not dispatched by this task.

Before: 168,911,603 logical export bytes (14,240 files) at phase 1; after: 113,199,337
bytes (14,228 files) in the first phase 2 export. That is 55,712,266 bytes (~53.1 MiB)
less, including 32,860,106 runtime bytes and the now-unreachable inference bundles.
No model weights existed in either checkout export. Old weight-bearing IPAs also
lose approximately 145 MB of weights, but that is not a measured compressed-IPA
comparison. Actual unsigned IPA size/check results are recorded in the PR/CI logs.

Automated coverage includes splitting/boundaries/marks, immutable approval, strict
text-only payloads, pacing, 429 cooldown, late response rejection, partial recovery,
changed text/dialect, old-WebKit reference loading, import graph and artifact
pruning. Browser smoke uses actual local OCR and corrections plus intercepted AI
requests; no scanner test uploads photographs or calls production automatically.

Physical iPhone checks remain: camera/photo permissions, real scan quality, review
panel accessibility with VoiceOver/large text, slow or interrupted native HTTPS,
Stop/navigation/backgrounding behavior, and memory/latency on supported devices.
No production deployment, PR merge, signing or App Store publication is performed.
