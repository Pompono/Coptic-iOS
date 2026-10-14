# Interface conventions

Keep the app’s warm beige / navy light palette, monochrome dark theme, Coptic font preference, and existing reading and learning workflows. Prefer small, incremental refinements over a redesign.

Use SVG icons or the existing SVG tab assets. Never use emoji for icons, including system symbols that can render as emoji on iOS. Decorative SVGs should be hidden from screen readers; their controls need a text label or accessible name.

Shared page spacing lives in `app/globals.css` (`app-page`, `app-page-header`). Keep full-screen lesson layouts separate. The outer translator main owns keyboard clearance; its inner page must not add a second viewport minimum height.

Aim for 44-pixel tap targets, visible keyboard focus, and an explicit selected state. Settings segmented buttons expose their state with `aria-pressed`. Preserve safe-area padding and the existing scroll-reset behavior.

Polish must preserve published-translation matching, experimental draft labels, scanner photo confirmation, original OCR restoration, and saved learning data. Visual changes do not establish improved translation accuracy.

The mobile dock order is Dictionary, Learn, Home, Translator, Settings. Keep Home in the center. The built-in Coptic keyboard defaults off on phone-sized layouts; saved explicit settings take precedence. On iOS, the keyboard install prompt appears on fresh launches until “Don’t show again” or “Already installed” is selected. Its close button only dismisses the current launch.

The learning pathway paints at the top, then scrolls quickly to an off-screen in-progress unit, keeping its full heading below the safe area. Skip that move when the heading is already visible and respect reduced motion and touch/wheel interruption.

On iOS, the launcher icon follows the in-app theme setting. Light uses the primary navy-and-beige AppIcon; dark uses the gold-on-black CopticDark alternate asset. The AppIcon Capacitor bridge changes it only when needed. Changes are serialized so rapid theme toggles finish at the latest selection, and startup/resume reconciles the saved theme. iOS may display its standard icon-change notice. Web browsers keep their configured website icon.

Lesson renderers share `lib/lessonTheme.ts`, whose CSS variables are defined for light and dark mode in globals.css. Use these tokens for new question types and answer states. Pathway unit colors have separate dark variants; keep their accents without bright page backgrounds. Completion screens and scanner result bubbles follow the same theme. The mobile smoke suite checks page continuity, all three lesson renderers, answer contrast, and full lesson completion in dark mode.

Bundled iOS lesson recordings use the LessonAudio Capacitor bridge and AVAudioPlayer directly, bypassing webview fetch/decode restrictions. Browser playback continues through Web Audio. Native playback returns clip duration for sentence scheduling and supports preload, stop, and background suspension. Lesson recording failures and missing clips show a visible error; do not silently substitute text-to-speech for custom recordings. “se Maria” currently has no bundled recording and needs an actual recording supplied before its listening prompt can work.

Native audio validates canonical bundle and recording paths on both sides of its containment check; device `/var` and `/private/var` aliases must not reject bundled files. Native errors include stage, localized reason, domain, and code instead of hiding the underlying error. Simulator CI exercises activation, preload, playback, and stop through the actual Capacitor bridge for pronunciation and both feedback sounds, in addition to direct decoding.
