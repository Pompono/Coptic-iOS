# iOS navigation and scrolling behavior

Settings route changes use the browser View Transitions API on the Settings page element. The tab dock and app shell are outside the named transition, so they stay fixed. Supported browsers animate the current page over the previous page with a short horizontal push or pop. Browsers without View Transitions, and users who enable Reduce Motion, navigate immediately without a substitute animation.

An interactive edge-swipe pop is not enabled. The Capacitor app uses Next.js client routing inside a WKWebView, not a `UINavigationController` stack, and a custom edge gesture would compete with system gestures and controls. The back row remains available and receives the reverse page transition.

Normal pages scroll the WKWebView document. The native scroll view now allows vertical bounce and the document no longer suppresses overscroll. Lesson exercises retain their deliberate inner-pane scrolling and temporarily pin the outer native scroll view. Nested CSS scroll panes continue to use WebKit's native touch scrolling. Chromium and Android use their browser/platform defaults; rubber-band motion is primarily an iOS behavior.

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
