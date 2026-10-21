# Phase 2C navigation architecture (before implementation)

Base: main, `2338a0ba40a782456ccb125cb463fe6789b51d88` (PR #12).

The existing AppLink and Settings buttons call App Router push/back/replace.
NavigationScrollReset owns a small history hint and document scroll reset.
There is no Settings layout. The root layout owns authentication, automatic
sync, native experience, viewport safe areas, and the fixed bottom dock.
WKWebView supplies document momentum and vertical bounce; only lesson exercise
routes lock its scroll view. These responsibilities must remain unchanged.

## Decision

Add one persistent `app/settings/layout.tsx` host. Extract the Settings root
content from its route entry and give Subpage an explicit section prop. Route
entries remain statically exported public URLs; the layout owns their actual
React surfaces. Never retain App Router `children` as old-page snapshots: those
children contain live router contexts and are not independent old pages.

The host retains an explicit current page and, only while transitioning, one
other page. React keys identify each real surface. At rest there is exactly one
mounted page. Non-active layers are inert and aria-hidden. Cancellation keeps
the current component (including form drafts); completion unmounts the outgoing
component. Application providers never enter this stack. No DOM cloning,
body append, global mutation observation, or duplicate application trees.

Keep App Router push/back/replace and public deep links. A scoped navigation
delegate captures scroll and direction before routing, rejects repeated taps
while pending, and waits for usePathname to confirm the route. Browser traversal
uses entry identities and indices, not a guess based on page depth. Refresh and
direct entries have a semantic parent but do not claim an unknown browser entry;
Back replaces the route in that case. Unmount unregisters the delegate.

Whole surfaces use transform-only Web Animations (300 ms). The incoming layer
is positioned relative to the host, with document-scroll compensation. The
host is opaque, horizontally clipped, and remains in normal document flow.
There is no new vertical scroller, fixed page overlay, or body scroll lock.
Animation completion/cancellation owns cleanup; resize, background, navigation
interruption and unmount cancel animations deterministically. Reduced Motion,
missing animation/inert support, a session kill switch, or animation failure
select direct unanimated routing.

Use a host-scoped touch recognizer, plus mouse pointer tracking for desktop
testing. A one-finger start in the left 24 CSS pixels becomes navigation only
after a rightward horizontal threshold; vertical/ambiguous gestures stay native.
Inputs, selection, sliders and marked horizontal scrollers are excluded. Only
accepted horizontal moves prevent default. The same two real layers follow
finger progress; release completes or cancels. History is touched once on
commit and never on cancel. A direct submenu has its semantic parent available.

UIKit edge-pan bridging was considered. A custom bridge adds gesture arbitration
with WKWebView and lifecycle messaging; WKWebView's built-in history gestures
do not expose the React surface progress/cancellation contract. Prefer the web
implementation pending physical iPhone acceptance; do not enable a competing
native recognizer. Safari's system edge gesture may take precedence outside the
Capacitor app and must safely cancel the web gesture.

References: [Next layouts](https://nextjs.org/docs/app/getting-started/layouts-and-pages),
[Next navigation](https://nextjs.org/docs/app/getting-started/linking-and-navigating),
[WKWebView gestures](https://developer.apple.com/documentation/webkit/wkwebview/allowsbackforwardnavigationgestures).

## Stages and validation

A: explicit host, direct routing, rendered browser checks before animation.
B: button/history push/pop and lifecycle interruption checks before gestures.
C: finger tracking, cancel/commit, scroll, forms, tab switching, frame capture.
Run full Node, TypeScript, lint, export, mobile/auth/progress regression suites
and Capacitor sync. macOS CI supplies simulator startup and unsigned device IPA.
Browser automation and simulator startup do not verify physical iPhone motion.
