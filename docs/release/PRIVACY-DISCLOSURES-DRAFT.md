# Privacy disclosures — draft, not a published privacy policy

Status: **internal review only**. Do not publish or use for App Store privacy answers until the backend, deployment, analytics, logging, and third-party SDK behavior have been audited. Project name and domain intentionally omitted from this draft.

## Current app behavior established from repository

- Learning progress (lesson completion, XP, streaks), vocabulary/review state, reader data and preferences are stored in browser/WebView local storage. There is presently **no account-based sync or automatic cloud backup**.
- Uninstalling the app or clearing local app data may permanently delete locally stored progress. Do not promise recovery.
- The photo scanner uses Tesseract.js to recognize selected images locally; the README states images are not uploaded or persisted by the scanner. Check all translation fallback paths before describing *all* scanner use as exclusively offline.
- A bundled Coptic-to-English model can translate locally when its runtime assets are present and functioning.
- English-to-Coptic uses a remote translation backend. Coptic-to-English can also use a server path when the local model is absent or when another method is selected. **Text submitted for online translation is transmitted to a server.** Confirm endpoint architecture and providers, retention, access logs, and error reporting before stating how that text is handled.
- No user accounts or intentional cloud progress storage are implemented in the reviewed client. Dependency presence (e.g. @supabase/supabase-js) does not establish account functionality.

## User-facing disclosure copy — provisional

**Learning progress.** Lessons, scores, streaks, vocabulary reviews, and preferences currently stay on this device. There is no account or automatic backup. Deleting the app or clearing its data may remove this progress.

**Translation.** Some translations run on the device; other translations require an internet connection and send the text you submit to our translation service for processing. Do not submit sensitive or confidential text through online translation.

**Photo scanning.** Selected photos are processed on the device for text recognition. If you request translation of recognized text through an online translation method, that recognized text may be sent to the translation service. The scanner does not intentionally upload the original photograph.

**Accuracy.** OCR and machine translation are experimental and may make mistakes. Review recognized text and translations before relying on them.

## Before publishing a policy / entering App Store privacy details

- Determine actual production service operator, hosting region, subprocessors, API request logs, IP address collection, security/retention/deletion policies, crash analytics and diagnostic reporting.
- Confirm all app/network paths, redirects, fallback behaviors, and remote text payloads on iPhone.
- Inventory Capacitor camera/photo permissions, and ensure permission descriptions accurately describe behavior.
- Establish support/contact and effective date; avoid disclosing unreleased name/domain before authorization.
- If adding accounts: revise this policy before rollout to explain email/provider identifiers, cloud progress data, retention, export/deletion, user rights and account deletion process.
- Validate disclosures against Apple's current App Privacy questionnaire and account-deletion requirements.
