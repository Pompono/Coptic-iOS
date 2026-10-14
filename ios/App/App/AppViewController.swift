import AVFoundation
import Capacitor
import UIKit
import Darwin

class AppViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(AppIconPlugin())
        bridge?.registerPluginInstance(LessonAudioPlugin())
        // Keep normal content scrolling, but never rubber-band past its bounds.
        webView?.scrollView.bounces = false
        webView?.scrollView.alwaysBounceVertical = false
        webView?.scrollView.alwaysBounceHorizontal = false
        #if DEBUG
        if let audioURL = Bundle.main.resourceURL?.appendingPathComponent("public/audio/learn/shared/a.wav") {
            do {
                let recording = try AVAudioPlayer(contentsOf: audioURL)
                if recording.prepareToPlay() && recording.duration > 0 {
                    print("COPTIC_NATIVE_AUDIO_DECODE_READY")
                }
            } catch { print("COPTIC_NATIVE_AUDIO_DECODE_ERROR: \(error.localizedDescription)") }
        }
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


@objc(LessonAudioPlugin)
public class LessonAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LessonAudioPlugin"
    public let jsName = "LessonAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "activate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "preload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]
    private var players: [String: AVAudioPlayer] = [:]

    private func activateSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try session.setActive(true)
    }

    private func recording(_ call: CAPPluginCall) throws -> AVAudioPlayer {
        guard let path = call.getString("path"), path.hasPrefix("/audio/"),
              let root = Bundle.main.resourceURL?.appendingPathComponent("public") else {
            throw NSError(domain: "CopticAudio", code: 1, userInfo: [NSLocalizedDescriptionKey: "Expected a bundled audio path"])
        }
        let url = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard url.path.hasPrefix(root.path + "/audio/"), FileManager.default.fileExists(atPath: url.path) else {
            throw NSError(domain: "CopticAudio", code: 2, userInfo: [NSLocalizedDescriptionKey: "Recording missing: " + path])
        }
        if let cached = players[path] { return cached }
        let player = try AVAudioPlayer(contentsOf: url)
        player.volume = 1
        guard player.prepareToPlay() else {
            throw NSError(domain: "CopticAudio", code: 3, userInfo: [NSLocalizedDescriptionKey: "Could not prepare recording: " + path])
        }
        players[path] = player
        return player
    }

    @objc public func activate(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do { try self.activateSession(); call.resolve() }
            catch { call.reject("Could not activate recording audio", nil, error) }
        }
    }

    @objc public func preload(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do { let player = try self.recording(call); call.resolve(["duration": player.duration]) }
            catch { call.reject("Could not load recording: " + (call.getString("path") ?? ""), nil, error) }
        }
    }

    @objc public func play(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                try self.activateSession()
                let player = try self.recording(call)
                player.currentTime = 0
                guard player.play() else {
                    call.reject("Could not start recording: " + (call.getString("path") ?? ""))
                    return
                }
                call.resolve(["duration": player.duration])
            } catch { call.reject("Could not play recording: " + (call.getString("path") ?? ""), nil, error) }
        }
    }

    @objc public func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            for player in self.players.values { player.stop(); player.currentTime = 0 }
            call.resolve()
        }
    }
}
