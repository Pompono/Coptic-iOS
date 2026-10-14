# Coptic interface

The shipping iOS application is a Capacitor shell around a statically exported Next.js interface. The redesign stays in that architecture. UIKit supports native audio, app icons, text-size preferences and answer haptics; it does not replace the application with a SwiftUI prototype.

## Shared visual language

`app/design-system.css` owns the new palette, spacing, radius and control treatments. Warm off-white (`#F8F7F3`), midnight ink (`#24344A`), readable slate, muted teal and restrained gold replace the old parchment palette. Dark mode uses an ink background and gently contrasted surfaces. Gold is confined to small identity details. Shadows, ornamental gradients and large tab-selection bubbles are removed from the redesigned screens.

Typography uses the local system family for interface text and retains both selectable Coptic font families. Shared type sizes use rem units. `NativeExperience` reads the native preferred body text size and follows iOS text-size changes. Long content scrolls while the lesson guide and practice action remain visible. The original authored exercise layouts still retain some fixed sizes; very large accessibility settings need continued physical-device review.

`AppIcon` provides consistent monochrome SVGs. Tabs remain flush to the bottom safe area, with visible labels and aria-current selection. Reader and vocabulary views are associated with Home; scanning and translation details remain under Translator. The app's built-in Coptic keyboard remains retired. The optional iOS keyboard installation resource and dismissal behavior remain available.

## Screen structure

- Home resumes the next available lesson using stored completion and unlock dependencies. Review counts come from the existing vocabulary scheduler. Saved reading information comes from the reader's existing local record. No sample streaks or fabricated progress are introduced.
- The course timeline reuses existing group and unit unlock calculations. It exposes real completed, current and locked states, keeps completed-group review routes, and shows unavailable content honestly. Opening at the top and the brief optional scroll to an off-screen unit are preserved.
- Dictionary results use compact entries and separators. Coptic headwords, meanings, source references, dialect distinctions, forms, examples and search-ranking evidence remain intact. Advanced controls remain on their dedicated settings route.
- Translation separates input, action and result. The native-sized multiline input supports command/control-Enter; the explicit Translate button works on phones. Published matching and experimental AI remain separate options. Experimental results retain an uncertainty label. Copy failures are visible. Method and offline explanations are progressively disclosed.
- Preferences use grouped rows, native select controls and accessible switches rather than repeated segmented button groups. Developer tools keep all existing actions and reset confirmation.
- Reading, vocabulary review, scanner editing, dictionary details, lesson guides, practice and outcomes share the palette, control and typography rules.

## Preserved systems

Dictionary data, Coptic fonts, transcription and normalization, translation models and published references, OCR, learning sequences, question answers, audio files, progress keys, vocabulary scheduling and offline assets are unchanged. A small native experience bridge supplies system text scaling and first-answer haptics. Haptic failure never blocks answering or saving progress.

## Validation

The existing browser checks cover offline translation/OCR, dictionary search and source distinctions, audio failure/retry, learning completion, vocabulary persistence, dark-mode contrast and scroll bounds. `scripts/design-smoke.mjs` additionally checks real home continuation, locked and completed course routes, tab labels, Coptic reading text size, and 360px light/dark layouts at a larger text size. The native startup check invokes the preferred-text-size and haptic bridge before validating recordings. CI compiles the native app and runs Safari checks before producing the IPA.

Physical iPhone review remains necessary for VoiceOver navigation, the largest Dynamic Type categories, system keyboard interactions, and the feel of haptics. This design does not add course content or improve experimental translation accuracy.
