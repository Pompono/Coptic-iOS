import Capacitor
import UIKit
import Darwin

class AppViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(AppIconPlugin())
        // Keep normal content scrolling, but never rubber-band past its bounds.
        webView?.scrollView.bounces = false
        webView?.scrollView.alwaysBounceVertical = false
        webView?.scrollView.alwaysBounceHorizontal = false
        #if DEBUG
        print("COPTIC_SCROLL_BOUNDS_READY")
        fflush(stdout)
        #endif
    }
}


@objc(AppIconPlugin)
public class AppIconPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppIconPlugin"
    public let jsName = "AppIcon"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setTheme", returnType: CAPPluginReturnPromise)
    ]

    @objc public func setTheme(_ call: CAPPluginCall) {
        guard let theme = call.getString("theme"), theme == "light" || theme == "dark" else {
            call.reject("Expected light or dark theme")
            return
        }
        DispatchQueue.main.async {
            let app = UIApplication.shared
            guard app.supportsAlternateIcons else {
                call.reject("This device does not support alternate app icons")
                return
            }
            let name: String? = theme == "dark" ? "CopticDark" : nil
            // Avoid repeated icon changes (and iOS notices) when opening settings or resuming.
            if app.alternateIconName == name {
                call.resolve()
                return
            }
            app.setAlternateIconName(name) { error in
                if let error = error {
                    call.reject("Could not update app icon", nil, error)
                } else {
                    call.resolve()
                }
            }
        }
    }
}
