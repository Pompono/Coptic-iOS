# Coptic iOS

A Capacitor iPhone/iPad port of [Pompono/Coptic](https://github.com/Pompono/Coptic).
The original repository remains independent. This repository retains its source history.

Lessons, pronunciation audio, fonts, dictionary data, and the interface are bundled
inside the app. Progress and preferences remain in the app's local WebView storage.
The offline translation build runs Coptic → English on the device. English → Coptic
still uses the separate Python-backed server in `backend/`. Standard builds without
the model files use that server for both directions.
No hosted website is required to open the app or use its learning content.

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
