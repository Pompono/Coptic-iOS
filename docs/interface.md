# Interface conventions

Keep the app’s warm beige / navy light palette, monochrome dark theme, Coptic font preference, and existing reading and learning workflows. Prefer small, incremental refinements over a redesign.

Use SVG icons or the existing SVG tab assets. Never use emoji for icons, including system symbols that can render as emoji on iOS. Decorative SVGs should be hidden from screen readers; their controls need a text label or accessible name.

Shared page spacing lives in `app/globals.css` (`app-page`, `app-page-header`). Keep full-screen lesson layouts separate. The outer translator main owns keyboard clearance; its inner page must not add a second viewport minimum height.

Aim for 44-pixel tap targets, visible keyboard focus, and an explicit selected state. Settings segmented buttons expose their state with `aria-pressed`. Preserve safe-area padding and the existing scroll-reset behavior.

Polish must preserve published-translation matching, experimental draft labels, scanner photo confirmation, original OCR restoration, and saved learning data. Visual changes do not establish improved translation accuracy.
