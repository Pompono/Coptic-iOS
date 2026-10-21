# iOS navigation and scrolling behavior

Settings route changes animate a snapshot of the outgoing Settings page and the incoming page with Web Animations. Route updates happen immediately; the animation never holds the router callback open. The tab dock and app shell stay fixed. Users who enable Reduce Motion navigate without animation.

An interactive edge-swipe pop is not enabled. The Capacitor app uses Next.js client routing inside a single WKWebView, not a `UINavigationController` stack with a system-owned interactive pop gesture. Implementing this would require a custom native edge recognizer bridged to JavaScript so it can track and cancel against WKWebView's vertical pan, interactive controls, route history, and page snapshots. The current app has no such gesture bridge, so a finger-tracking swipe cannot be guaranteed to cancel or commit without conflicting with scrolling. The back row remains available and receives the reverse page transition.

Normal pages scroll the WKWebView document. Both the HTML root and body paint the resolved app canvas color. On iOS, the theme preference also updates the WKWebView and its backing UIScrollView background from the resolved CSS body color, so native rubber-band motion reveals the same canvas in light and dark themes. The native scroll view allows vertical bounce and the document no longer suppresses overscroll. Lesson exercises retain their deliberate inner-pane scrolling and temporarily pin the outer native scroll view. Nested CSS scroll panes continue to use WebKit's native touch scrolling. Chromium and Android use their browser/platform defaults; rubber-band motion is primarily an iOS behavior.

## Physical iPhone acceptance checklist

Test on a physical iPhone with the app installed from a development or CI build:

- Open Settings → Preferences, Progress, and Account. Confirm a short push animation, a stable bottom dock, aligned titles, and clear separation above the first card.
- Use each Settings back row and confirm a matching pop animation. Repeat taps quickly and check that the route settles without a blank frame or duplicated page.
- Scroll Home, Learn, Settings, Dictionary, and Translator with a fast flick. Confirm that motion coasts and decelerates naturally.
- Pull beyond the top and bottom of each normal page. Confirm resisted rubber-band motion and spring-back with no blank or unstyled area showing.
- Confirm the dock stays stationary during scroll and boundary bounce.
- Open a lesson exercise and verify its controls, inner scrolling, keyboard, and outer page lock still behave as before.
- Open a text field, display the keyboard, and confirm the field remains visible and the page can still be navigated.
- Enable Reduce Motion in iOS Accessibility settings and confirm route changes no longer animate.

Automated desktop browser tests can verify route behavior and CSS configuration but cannot certify WKWebView momentum or rubber-band physics. Those require the physical-device checks above.
