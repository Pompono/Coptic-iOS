# Coptic iOS

A Capacitor iPhone/iPad port of [Pompono/Coptic](https://github.com/Pompono/Coptic).
The original repository remains independent. This repository retains its source history.

Lessons, pronunciation audio, fonts, dictionary data, and the interface are bundled
inside the app. Progress and preferences remain in the app's local WebView storage.
The offline translation build runs Coptic → English on the device. English → Coptic
still uses the separate Python-backed server in `backend/`. Standard builds without
the model files use that server for both directions.
No hosted website is required to open the app or use its learning content.

## Reading, vocabulary, and grammar

**Home → Read Coptic** opens a reader with introductory Bohairic practice phrases
and a field for your own passage. Opening a custom passage saves it locally so you
can return after reviewing words. Tap words for dictionary meanings, lemmas, listed
forms, grammatical labels, and sources. Bound-form notation and optional matches
without combining marks are handled explicitly; the photographed/pasted spelling
is not silently rewritten. Supported Bohairic article + noun patterns are offered
as possibilities when a dictionary noun supports the analysis. Other unmatched
words are reported as unsupported rather than guessed.

Grammar notes explain articles, dictionary forms, noun phrases, and why a tense
marker needs context. They cite the bundled dictionary and distinguish editorial
explanations from dictionary evidence. This is not a full morphology/sentence parser
or an etymological root analyser. Starter content is labelled as app-composed
practice phrases, not historical quotations. Existing recordings are offered only
when available for the exact selected word/phrase; no pronunciation is synthesized.

Save a dictionary sense from the reader or a dictionary entry, then open
**Vocabulary & review** from Home or Learn. Recall cards offer Again/Hard/Good/Easy
ratings; a meaning quiz is available when at least two different saved meanings
exist. Missed quiz answers become Again reviews when you save the result.
Again returns in 10 minutes; initial Good in one day and Easy in four days. Repeated
successes increase intervals. Due words with more recorded lapses are prioritised.
Saving the same sense again preserves its schedule and does not create a duplicate.
Different dictionary meanings can be saved separately.

Vocabulary uses a separate versioned local store and does not overwrite lesson
progress. Words, context, and review history remain on the device; no account or
server is required. This initial version has no cloud sync or vocabulary backup.
Malformed/unsupported stored decks are reported and left untouched. Unit tests
cover lookup and scheduling, and browser tests exercise saving, reload persistence,
quiz failures, and recall with external requests blocked.

## Experimental photo scanner

Open **Translator → Scan a Coptic photo**. Take a photo or choose one, rotate or
crop it if needed, then press **Read Coptic**. Tap a numbered block to check and
correct the recognised text. **Translate block** displays English over its original
position; **Translate remaining blocks** processes the remaining regions in order.
Tap a bubble to read the full translation below the image. **Show original** reveals
the photographed text again. The offline-model IPA is required for translation.

Recognition and translation run locally. Photos are not uploaded, saved to the
photo library, or persisted by the scanner. Recognition scales photos to a maximum
3072-pixel edge and uses a separate worker, released before translation. Cropping,
rotation, edits, and dialect changes invalidate affected results. OCR is limited to
the first 24 text regions; crop a smaller part of dense pages. There is no live
camera recognition yet.

**Inspect marks in the photo** magnifies each OCR-marked word from the original
image and gives an experimental shape hint. It uses adaptive ink thresholding and
connected components to compare a mark's length and slope with the letter bodies
and OCR baseline. Long flat spanning bars and short slanted marks get different
hints; short horizontal/connected/blurred marks remain uncertain. A small set of
common sacred-name abbreviation patterns is also kept uncertain. This is geometry
and context assistance, not a trained mark classifier or an accuracy guarantee.
Nothing is rewritten automatically. Word-specific correction preserves other words;
edits that invalidate OCR text positions disable these correction actions.

Page height now accounts for the safe areas and dock instead of adding those on
top of a full-screen minimum. Short pages have no artificial blank scrolling range;
long pages keep their normal scrolling. The native bridge disables rubber-band
scrolling beyond content bounds, and a backdrop protects the status-bar area.
Normal forward links/tab changes reset the destination to the top after the new
page commits; browser Back retains the framework's history restoration behavior.
Browser tests check short-page geometry, while the Mac workflow launches an iPhone
simulator to check the native scroll controller initializes successfully.

OCR preserves its original text for each block. **Change overlines to jinkem** is
an explicit correction for misread macron/overline marks; it is never applied
automatically because genuine abbreviation bars must remain distinguishable.
**Insert Ⲭ/ⲭ** replaces selected text or inserts at the cursor for omitted chi.
**Insert jinkem** allows a single mark correction without changing a whole block.
A synthetic Avva Shenouda-font probe reproduced uppercase Ⲭ being read as Ϫ in
a repeated-letter sequence. This is a known model confusion, not a safe automatic
replacement rule. Real photo examples are needed to evaluate font-specific errors.
**Restore recognised text** undoes all edits in the selected block. The larger
photo limit retains more detail for small marks; accuracy on real camera images
still needs evaluation. Word and image taps select content without automatic page
jumps; dedicated buttons open details/editors. Mobile inputs avoid focus zoom,
native page zoom is disabled, safe-area padding is handled once, and the dock hides
when the software keyboard takes up the viewport. Browser pinch zoom remains available.

The pinned experimental model is
[Shreeshrii/tessdata_coptic](https://github.com/Shreeshrii/tessdata_coptic), listed in
Tesseract's contributed-language documentation. It adds about 8 MB plus its runtime.
The upstream repository does not specify a model licence: clarify redistribution
rights before public distribution. The bundled model source notice does not infer
a licence; Tesseract.js and its core include their own licence files.

Initial evaluation recognised a scanned printed page and a synthetic two-phrase
fixture in the app's existing Coptic font. The synthetic fixture had one substitution
in 15 characters (initial iota recognised as a bracket on Chromium and uppercase
iota on WebKit). This is a small development
check, not a real-photo accuracy benchmark. Recognition errors, unfamiliar fonts,
handwriting, camera glare, and manuscript pages need further evaluation. Automated
tests also check corrected offline translations, overlay positions, and crop/rotate
behavior. Camera permissions and performance still require testing on an iPhone.

`npm run build` copies the OCR worker/runtime from installed packages and fetches
the pinned model on the build machine if absent, checking its SHA-256. The installed
app needs no model download. Generated assets stay out of Git.

## Build and open on a Mac

Requirements: Node.js 22, Xcode 16 or newer with its command-line tools installed.
The checked-in native project uses Swift Package Manager; CocoaPods is unnecessary.

```sh
npm ci
npm run ios:sync
npm run ios:open
```

In Xcode, select the **App** target, then **Signing & Capabilities**. Choose your Apple
team and change `com.pompono.coptic` if you need a different bundle identifier. Select
an iPhone simulator or connected iPhone and press Run.

After changes to the interface, content, or environment variables, rerun
`npm run ios:sync` before rebuilding in Xcode. `out/` and the copied native web assets
are generated and intentionally excluded from Git.

## Export an IPA

1. Open the project using `npm run ios:open`.
2. Set the signing team, bundle identifier, version, and build number in Xcode.
3. Select a generic iOS device destination and choose **Product → Archive**.
4. In Organizer, select **Distribute App**. Choose the distribution method your
   provisioning profile supports, then export the IPA or upload to App Store Connect.

A signed IPA requires your Apple signing identity/provisioning profile. TestFlight
and App Store distribution require an Apple Developer membership. This repository
contains the native project, not a signed IPA. Replace the generated placeholder
app icon and launch artwork before distributing a release.

## Offline Coptic → English and a Sideloadly IPA

In GitHub, open **Actions → Build offline translation IPA → Run workflow**.
The workflow exports and quantizes the pinned upstream model, checks tokenizer
parity, tests actual offline translations, and builds an unsigned **device** IPA
on a hosted Mac. Download the `Coptic-offline-unsigned-IPA` artifact from the
completed run, extract `Coptic-offline-unsigned.ipa`, and use Sideloadly to sign and
install it with your Apple ID. No Mac of your own is needed. Artifacts expire after
seven days; rerun the workflow to rebuild them.

The model adds about 145 MB of weights plus the bundled WebAssembly runtime. It
requires a browser/WebView with WebAssembly SIMD support (use iOS 16.4 or newer).
It runs in a worker using one CPU thread, with no remote requests or model download
after installation. Leaving the translator releases its worker and model memory.
The interface indicates when on-device translation is available. A local inference
failure is shown to the user; it does not silently send the input to a server.

This initial version uses greedy decoding and 8-bit quantization, so output can
differ from the original server's beam-search translations. It accepts short
passages (up to 1,200 characters and 512 model tokens) and generates up to 64 tokens.
It does not present an uncalibrated confidence score. English → Coptic remains a
server feature. iPhone speed, memory limits, and translation quality beyond the
test examples still require device validation.

Model files are generated, not committed to Git. To export them yourself on a
machine with Python 3.12, run from the repository root:

```sh
python3 -m venv .venv-local-model
# Activate the venv using your platform's command, then:
pip install torch==2.6.0 --index-url https://download.pytorch.org/whl/cpu
pip install -r scripts/local-translation/requirements.txt
python scripts/local-translation/export.py
# On Linux set ONNXRUNTIME_NODE_INSTALL_CUDA=skip for npm ci.
npm ci
node scripts/local-translation/check-tokenizer.mjs
npm run ios:sync
```

The exporter pins model revision `c5ccdb3aabb93c9962a0ae6d7305abfe8895d91d`, preserves
source-only SentencePiece scores, quantizes the merged decoder subgraphs, and writes
a manifest with file sizes and SHA-256 hashes. Converted model weights retain the
upstream **AGPL-3.0** license; its notice, license text, and source links are bundled.
The original model is at [megalaa/coptic-english-translator](https://huggingface.co/megalaa/coptic-english-translator).

## Translation server

A standard build without generated model files has no translation service
configured by default. The offline workflow bundles Coptic → English; use a server
for English → Coptic or for builds without the local model.
To enable translation, host `backend/` on a service that can run both Node.js and
Python with enough memory for the Hugging Face models:

```sh
cd backend
npm ci
python3 -m pip install -r translator/requirements.txt
cp .env.example .env.local
npm run build
npm start
```

The service listens on port 3001. Put it behind an HTTPS endpoint. Model weights are
downloaded on first use, so the server needs Hugging Face access and persistent model
cache storage. This preserves the upstream subprocess-based translator; model loading
can be slow. Test actual translations after provisioning the server.

At the repository root, copy `.env.example` to `.env.local` and set:

```dotenv
NEXT_PUBLIC_TRANSLATION_API_URL=https://your-translation-server.example
```

Then rerun `npm run ios:sync`. The URL is public build configuration, not a secret.
The app uses Capacitor's native HTTP client on iOS, so native translation requests do
not require browser CORS. For a browser preview, set the backend's
`COPTIC_ALLOWED_ORIGINS` to the exact preview origin, for example
`http://localhost:3000`. HTTPS remains required for the API URL.

Endpoints are `POST /api/translate` and `POST /api/translate/en-coptic`, accepting
`text`, `dialect` (`bohairic` or `sahidic`), and `includeConfidence`.

The backend is not bundled into the iPhone app. Host it separately; configure access
controls and request limits appropriate to the audience before exposing it publicly.

## Browser preview and checks

```sh
npm run build
npm test
npm start
```

`npm start` serves the exported app on port 3000. `npm run dev` is available for
interface development. Both production and development builds use the configured
remote translation server.

For the mobile browser smoke check, run `npx playwright install chromium` once,
then `npm run test:mobile` after building. It blocks external networking while
checking bundled pages, full lesson completion, saved progress/settings, dictionary data, and audio decoding.

GitHub Actions validates the web export and backend build, and compiles the iOS
project for a simulator on macOS without signing secrets. A simulator compile is
not a signed device build. The workflow does not publish or distribute the app.

## Port details and remaining device checks

- Next.js exports all course units and lesson steps as static pages.
- Dictionary details use `/dictionary/entry/?lemma=...` so they do not need a server
  or thousands of extra dictionary page exports.
- Image optimization is disabled for the bundled app; images are served locally.
- Python translation routes and wrappers have moved to the independent `backend/`.
- Existing lesson content and later placeholder units are inherited from upstream.
- Local progress is device-specific and does not sync between the website and app.
- Pronunciation playback and speech prompts stop when the app becomes hidden; the next playback resumes the audio context.

The web export, Capacitor sync, backend build, and mobile browser smoke checks were
validated in Linux. Xcode compilation, iPhone keyboard/audio behaviour, interruption
and resume behaviour, signing, and live model translations still need validation
on a Mac/iPhone and a provisioned translation server.

### Translation quality findings

A user-supplied Bohairic hymn photo exposed both missing OCR characters and
incorrect fluent English. A manually transcribed stanza still produced incorrect
English, so recognition is not the only cause. The bundled model is not a reliable
liturgical translator. Existing short-phrase smoke checks establish execution,
not general translation accuracy.

Numbers, brackets, missing-character boxes and repeated five-word output loops
now cause an explicit error instead of an accepted English result. These checks
cannot detect all semantic hallucinations. They do not infer missing Coptic
letters or substitute a memorized translation for the user's passage.

The offline worker now uses a separate four-hypothesis beam-search decoder,
with source encoding reuse and a decoder cache per hypothesis. It improves the
short daughter/Son regression and refuses unfinished generations, but longer
hymns still contain semantic errors. See [engine comparison](docs/translation-engine.md)
for inputs, outputs, limitations, and the reproducible comparison command.
