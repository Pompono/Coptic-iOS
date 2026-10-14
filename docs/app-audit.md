# App audit and dictionary search parity

Compared against Pompono/Bohairic-Dictionary's DictionaryService and Transliteration implementation on October 14, 2026. The Bohairic JSON is byte-for-byte identical in both repositories (8,134 source records). This update changes lookup, not the dictionary definitions or original Coptic text.

## Implemented search behavior

- Rank exact headwords, variants, prefixes and contained forms ahead of definition matches.
- Rank complete English meanings ahead of whole-word matches and incidental substrings. Normalize infinitive/part-of-speech prefixes, support unordered multiword queries, and lower cross-reference-only definitions.
- All fields, Coptic words, English meanings and Transliteration scopes.
- Desktop transliteration aliases, including agape/agapi/agapee; exact and prefix matches of headwords and variants, explicitly labeled approximate. Strong English meanings outrank transliteration in All fields.
- Optional mark-tolerant search; retain exact-mark spelling preference and original displayed text. Strict matches cannot stop inside a marked character.
- Conservative spelling suggestions including adjacent transpositions, applied only when tapped and respecting filters.
- Coptic alphabet ordering and initial-letter browsing, with existing dialect, part-of-speech and examples filters.
- Match explanations and variant/metadata evidence. Crum references, Greek origin, tags and etymology are searchable.
- Recent searches stored locally, search/filter restoration within the current session, and persistent mark/suggestion preferences. Ctrl/Cmd+F focuses search.
- Clickable entry headings and resolved cross-references, including variant targets; no invented links for missing targets.

## Corrected anomalies

- Reader lookup IDs collided in 178 groups of records with different meanings. Lookup IDs now include the full source record so valid senses are not discarded; saved vocabulary identity is unchanged.

- Dictionary search labeled all matched rows as “shown” while displaying only 80. It now counts visible rows.
- 1,917 Bohairic records use crum: source references. These are references, not browser links; the results now display Crum text.
- Entry pages ignored the global Bohairic-only preference and used pale dark-only badge colors in light mode. They now follow the preference and theme.
- Entry page query parameters were read only once. Reactive parameters now allow cross-references to change the displayed entry without a document reload.
- Dictionary fetches did not check HTTP status or offer recovery. Both dictionary pages check responses and expose a themed Retry control.

## Remaining work

- 45 of 47 course units remain placeholders. 28 regular lesson steps have exercise sets; this is not a complete course. Author and review content rather than presenting empty units as complete.
- The literal audio-reference audit found “se Maria” without a mapped recording. A real recording is needed; do not substitute synthetic speech.
- General translation is still experimental outside matched published sources. OCR can still confuse letters and marks. Search improvements do not establish better translation or OCR accuracy.
- The Windows app's separate favorites, per-entry personal notes, copy controls, adjustable reading sizes and draggable desktop divider are not ported by this search update. The iOS app already has Save word for review and its vocabulary review queue.
- The supplied Bohairic data has no populated example arrays; Has examples may legitimately return no results.

## Verification

The search tests cover the real source dataset plus controlled ranking fixtures, strict marks, transliteration, filters, suggestions and resolved cross-references. Browser checks exercise real mobile controls and navigation offline. Existing tests continue to cover lesson audio, dark mode, scrolling, keyboard preferences, reading/review, OCR and translation safeguards.
