# Coptic iOS

A Capacitor iPhone/iPad port of [Pompono/Coptic](https://github.com/Pompono/Coptic).
The original repository remains independent. This repository retains its source history.

Lessons, pronunciation audio, fonts, dictionary data, and the interface are bundled
inside the app. Progress and preferences remain in the app's local WebView storage.
Translation requires internet access to the separate Python-backed server in `backend/`.
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

## Translation server

The default app build has no translation server configured. It explains this when
a translation is requested; learning and dictionary features remain available.
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
checking bundled pages, lesson rendering, dictionary data, and audio.

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

The web export, Capacitor sync, backend build, and mobile browser smoke checks were
validated in Linux. Xcode compilation, iPhone keyboard/audio behaviour, interruption
and resume behaviour, signing, and live model translations still need validation
on a Mac/iPhone and a provisioned translation server.
