# Phase 2A: Optional email accounts

## Scope and architecture

- Email and password authentication uses `@supabase/supabase-js` with PKCE. No Next.js server route is required; the app works as a static export and in Capacitor.
- Native session data, including the PKCE verifier, is stored by the local `@coptic/secure-auth-storage` Capacitor plugin in the iOS Keychain. Items use `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, do not synchronize to iCloud Keychain, and are removed by Supabase on local sign-out. The web build uses browser local storage.
- Auth refresh runs while the native app is active and pauses in the background. Supabase handles token refresh and invalid refresh-token responses; the UI returns to guest/sign-in state when no usable session remains.
- Auth code only invokes Supabase Auth methods. It does not import, write, or read learning progress, restore journals, recovery data, backup files, vocabulary schedules, XP, or streaks. No anonymous Supabase user is created for guests.
- Optional display names use Supabase Auth user metadata; no public profile table is created. Email remains the login identifier.
- The app only receives the Supabase URL and publishable key. A publishable key is expected to be public in a client app. Never use a `service_role` or secret key in a frontend variable.

## Local and build configuration

Copy `.env.example` to `.env.local` and set:

```text
NEXT_PUBLIC_SUPABASE_URL=https://vprlahihwqtkmhgxytiy.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<project publishable key>
```

The app deliberately remains a guest app if the publishable key is missing. For GitHub Actions builds, add repository variable `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` under **Settings → Secrets and variables → Actions → Variables**. The workflow defaults the URL to the existing project and permits overriding it with `NEXT_PUBLIC_SUPABASE_URL`. The publishable key is embedded in the client bundle by design; do not put a privileged key there.

## Supabase dashboard steps

1. In **Authentication → Providers → Email**, keep email/password enabled, email confirmation enabled, and the minimum password length at 10.
2. In **Authentication → URL Configuration → Redirect URLs**, allow `com.pompono.coptic://auth/callback`.
3. If the static web build is hosted, also allow its exact origin with `/auth/callback/`. Set the Site URL to the current app hosting origin. Do not use a future/unreleased domain.
4. Keep confirmation and password recovery templates enabled. The client supplies the redirect through Supabase's `emailRedirectTo`/`redirectTo` options; retain the Supabase confirmation link in the templates.
5. Before public use, configure a production SMTP sender in **Project Settings → Authentication → SMTP Settings**. Verify the sender domain, SPF and DKIM records, DMARC policy, delivery, bounce handling, and Supabase email rate limits. Keep confirmation enabled while testing.

Do not change existing learning tables or RLS policies for this phase. This implementation does not query them.

## Native email callbacks

The iOS app registers `com.pompono.coptic` as a URL scheme. `AppDelegate` forwards URL opens to Capacitor; the auth provider listens for `appUrlOpen` and checks `getLaunchUrl()` for cold launches. It accepts only the exact native callback host/path, extracts a bounded PKCE `code`, and calls `exchangeCodeForSession(code)`. It does not navigate to a callback-supplied destination or log callback URLs, codes, or tokens. Password recovery switches to the new-password screen after Supabase emits `PASSWORD_RECOVERY`.

This uses a custom URL scheme, not Universal Links. A custom scheme can be claimed by another installed app, so PKCE and the Keychain-held verifier are required. No Apple Developer account or website association file is needed for this scheme. Supabase dashboard redirect allowlisting is required as above.

Automated callback parser tests, simulator build checks for the URL scheme, and a native Keychain bridge round-trip are included. A real email confirmation or recovery email has not been followed through on a physical iPhone; do that before public release.

## Security findings and limits

- No service-role key, secret key, password, token, or callback credential is logged or included as a hard-coded value.
- The custom Keychain plugin uses a dedicated service name, a Supabase-specific account prefix, device-only accessibility, and generic error text. It stores only Supabase's session values.
- Error UI avoids revealing whether a password-reset email belongs to an account. Registration duplicate-account messages are also generalized.
- No database tables, policies, or migrations were changed, and the client performs no database queries.
- The repository contains no migrations or RLS definitions for the listed existing tables. No project management/database credential was supplied, so the live Supabase schema and RLS policies could not be inspected read-only. Their current safety remains unverified; keep RLS enabled and review policies before any future data query or synchronization feature.
- Account deletion is intentionally not represented by a fake client button. It is a public-release blocker until a trusted backend/Edge Function can authenticate the user, delete the Auth identity using a server-only admin credential, and define cleanup/retention for associated data. Do not place an admin credential in this app.
- Keychain data can remain after app uninstall for the same bundle ID. This app does not migrate Keychain state to another device. Signing out removes the local Supabase session; deleting an account requires a future trusted deletion flow.

## Physical iPhone checklist

1. Install the unsigned IPA with Sideloadly and open Settings → Account. Verify the app still works as a guest.
2. Create an account with a password of at least 10 characters. Confirm the email arrives and opens this app; verify the screen shows a verified email.
3. Force-quit and reopen. Confirm the signed-in state is restored. Turn on Airplane Mode, reopen, then restore connectivity and confirm session recovery without losing guest progress.
4. Sign out and verify the account is signed out while lesson progress, XP, streaks, vocabulary due dates, and backup/recovery files remain unchanged. Sign in again.
5. Request a password reset. Open the email on the iPhone, set a new password, then sign in with it. Also test expired/reused links and offline errors.
6. Test display-name update and email change; confirm email change only completes after verification.
7. Export and import a progress backup before and after sign-in/sign-out. Confirm Coptic combining marks and all progress fields remain intact.

## Deferred roadmap

- Sign in with Apple and Google need provider setup, native system-browser flows, and provider-specific redirect testing. Neither provider is enabled here.
- Cloud progress sync needs a separate design for stable account identity, local/account reconciliation, revisions and conflict handling, offline queues, RLS policies, privacy/retention, and self-hosting compatibility. No progress uploads or downloads exist in this phase.
- Account deletion needs the trusted backend described above, plus an explicit policy for associated data and backups. It remains a release blocker until then.
