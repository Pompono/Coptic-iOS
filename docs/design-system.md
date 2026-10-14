# Coptic interface

The shipping iOS application is a Capacitor shell around a statically exported Next.js interface. The redesign stays in that architecture. UIKit supports native audio, app icons, native control appearance, text-size preferences and answer haptics; it does not replace the application with a SwiftUI prototype.

## Shared visual language

`app/design-system.css` owns the new palette, spacing, radius and control treatments. Warm system-grouped white (`#F4F4F2`), midnight ink (`#24344A`), readable slate, muted teal and restrained gold replace the old parchment palette. Dark mode uses a near-black background (`#080C10`) and charcoal grouped surfaces. Gold is confined to the original Coptic identity artwork. A solid midnight learning feature, precise inset separators, and restrained surface shadows give the interface hierarchy and depth. Ornamental gradients and large tab-selection bubbles are absent.

Typography uses the local system family for interface text and retains both selectable Coptic font families. Shared type sizes use rem units. `NativeExperience` reads the native preferred body text size and follows iOS text-size changes. Long content scrolls while the lesson guide and practice action remain visible. The shared viewport follows the system keyboard, makes room by hiding tabs, and reserves the bottom safe area only once. The original authored exercise layouts still retain some fixed sizes; very large accessibility settings need continued physical-device review.

`PageHeader` provides the same large title followed by a supporting description on every main destination and reference-settings screen. There are no preceding eyebrow labels. `HeritageIcon` restores the original dictionary, learning, Coptic-letter translator, home, settings and Coptic cross artwork; `AppIcon` shares that artwork between navigation, headers and tool rows alongside quiet utility symbols. Tabs remain flush to the bottom safe area, with visible labels and aria-current selection. Reader and vocabulary views are associated with Home; scanning and translation details remain under Translator. The app's built-in Coptic keyboard remains retired. The optional iOS keyboard installation resource and dismissal behavior remain available.

## Screen structure

- Home resumes the next available lesson using stored completion and unlock dependencies. Review counts come from the existing vocabulary scheduler. Saved reading information comes from the reader's existing local record. No sample streaks or fabricated progress are introduced.
- The course timeline reuses existing group and unit unlock calculations. Displayed lesson totals count authored playable steps, not scaffolded future slots. It exposes real completed, current and locked states, keeps completed-group review routes, and shows unavailable content honestly. Opening at the top and the brief optional scroll to an off-screen unit are preserved.
- Dictionary results use compact entries and separators. Coptic headwords, meanings, source references, dialect distinctions, forms, examples and search-ranking evidence remain intact. Advanced controls remain on their dedicated settings route.
- Translation separates input, action and result. The native-sized multiline input supports command/control-Enter; the explicit Translate button works on phones. Published matching and experimental AI remain separate options. Experimental results retain an uncertainty label. Copy writes directly to the iOS pasteboard; browser copy failures are visible. Method and offline explanations are progressively disclosed.
- Preferences use grouped rows, native select controls and accessible switches rather than repeated segmented button groups. Developer tools keep all existing actions and reset confirmation.
- Reading and vocabulary use the same panel, segmented-selection, and button treatments. Scanning opens with a useful photo-import panel and progressively disclosed recognition guidance. Lesson guides group Coptic patterns and replay actions; practice exposes real exercise progress and keeps the primary action above the system keyboard. Dictionary details, scanner editing and outcomes share the same surface and control rules.

## Preserved systems

Dictionary data, Coptic fonts, transcription and normalization, translation models and published references, OCR, learning sequences, question answers, audio files, progress keys, vocabulary scheduling and offline assets are unchanged. A small native experience bridge supplies system text scaling and first-answer haptics. Haptic failure never blocks answering or saving progress.

## Validation

The existing browser checks cover offline translation/OCR, dictionary search and source distinctions, audio failure/retry, learning completion, vocabulary persistence, dark-mode contrast and scroll bounds. `scripts/design-smoke.mjs` additionally checks real home continuation, locked and completed course routes, tab labels, Coptic reading text size, consistent heading typography and title-before-subtitle placement, preservation of the Coptic-letter tab artwork, and 360px light/dark layouts at larger text sizes. The native startup check invokes the preferred-text-size and haptic bridge before validating recordings. CI compiles the native app and runs Safari checks before producing the IPA.

Physical iPhone review remains necessary for VoiceOver navigation, the largest Dynamic Type categories, system keyboard interactions, and the feel of haptics. This design does not add course content or improve experimental translation accuracy.

## Playback and viewport polish

`AudioReplay` supplies paired speaker and turtle-with-sound-wave controls throughout guides, exercises, reading and vocabulary. Both use the original recording at 1× and .5×, with accessible labels and no visible text captions. `RecordingCard` replaces the separate speaker renderers and removes duplicate speaker glyphs from listening questions. Authored exercises reserve less empty heading/footer space, giving three-choice questions room without clipped corners.

Exercise routes lock the outer document to the viewport; only the guide, question or practice pane scrolls. Keyboard resizing waits for the flex layout before moving the active answer into view inside its own pane. The regression check verifies the actual answer bounds and zero outer document scrolling, as well as the footer.

Dictionary preferences remove the permanent lock and transliteration paragraphs. `useSettingsLockNotice` shows a two-second shadowed notice when a locked control is activated, while preserving its value. Dictionary entry and translator dialect controls share the same behavior. General Settings still controls the global preference. Dictionary preferences put Done in the top navigation row rather than below the scrollable form.
