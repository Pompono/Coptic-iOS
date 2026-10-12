import Capacitor
import UIKit

class AppViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        // Keep normal content scrolling, but never rubber-band past its bounds.
        webView?.scrollView.bounces = false
        webView?.scrollView.alwaysBounceVertical = false
        webView?.scrollView.alwaysBounceHorizontal = false
        #if DEBUG
        print("COPTIC_SCROLL_BOUNDS_READY")
        #endif
    }
}
