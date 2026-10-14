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
        if ProcessInfo.processInfo.environment["COPTIC_NATIVE_AUDIO_SMOKE"] == "1" {
            verifyAudioBridge()
        }
        print("COPTIC_SCROLL_BOUNDS_READY")
        fflush(stdout)
        #endif
    }
    #if DEBUG
    private func verifyAudioBridge(attempt: Int = 0) {
        guard attempt < 150 else {
            print("COPTIC_NATIVE_AUDIO_BRIDGE_ERROR: timeout")
            fflush(stdout)
            return
        }
        let script = """
        (() => {
          const cap = window.Capacitor;
          if (!cap || typeof cap.nativePromise !== 'function') return { status: 'waiting' };
          if (!window.__copticAudioSmoke) {
            window.__copticAudioSmoke = { status: 'running' };
            (async () => {
              try {
                await cap.nativePromise('LessonAudio', 'activate', {});
                for (const name of ['a.wav', 'correct-answer.wav', 'incorrect-answer.wav']) {
                  const path = '/audio/learn/shared/' + name;
                  await cap.nativePromise('LessonAudio', 'preload', { path });
                  const result = await cap.nativePromise('LessonAudio', 'play', { path });
                  if (!(result.duration > 0)) throw new Error('Invalid recording duration: ' + name);
                  await cap.nativePromise('LessonAudio', 'stop', {});
                }
                window.__copticAudioSmoke = { status: 'passed' };
              } catch (error) { window.__copticAudioSmoke = { status: 'failed', message: error.message }; }
            })();
          }
          return window.__copticAudioSmoke;
        })()
        """
        webView?.evaluateJavaScript(script) { result, error in
            if let state = result as? [String: Any], let status = state["status"] as? String {
                if status == "passed" {
                    print("COPTIC_NATIVE_AUDIO_BRIDGE_READY")
                    fflush(stdout)
                    return
                }
                if status == "failed" {
                    print("COPTIC_NATIVE_AUDIO_BRIDGE_ERROR: \(state["message"] ?? "unknown")")
                    fflush(stdout)
                    return
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                self.verifyAudioBridge(attempt: attempt + 1)
            }
        }
    }
    #endif

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
        // iPhone bundle paths can use /var while standardized paths use /private/var.
        // Compare canonical paths on both sides, including symlinks.
        let canonicalRoot = root.standardizedFileURL.resolvingSymlinksInPath()
        let url = canonicalRoot.appendingPathComponent(String(path.dropFirst())).standardizedFileURL.resolvingSymlinksInPath()
        guard url.path.hasPrefix(canonicalRoot.path + "/audio/") else {
            throw NSError(domain: "CopticAudio", code: 4, userInfo: [NSLocalizedDescriptionKey: "Recording path is outside bundled audio"])
        }
        guard FileManager.default.fileExists(atPath: url.path) else {
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

    private func rejectAudio(_ call: CAPPluginCall, stage: String, error: Error) {
        let detail = error as NSError
        let name = (call.getString("path") ?? "audio session") as NSString
        call.reject("\(name.lastPathComponent): \(stage) failed — \(detail.localizedDescription) [\(detail.domain) \(detail.code)]", "AUDIO_" + stage.uppercased(), error)
    }

    @objc public func activate(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do { try self.activateSession(); call.resolve() }
            catch { self.rejectAudio(call, stage: "activation", error: error) }
        }
    }

    @objc public func preload(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do { let player = try self.recording(call); call.resolve(["duration": player.duration]) }
            catch { self.rejectAudio(call, stage: "loading", error: error) }
        }
    }

    @objc public func play(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            var stage = "activation"
            do {
                try self.activateSession()
                stage = "loading"
                let player = try self.recording(call)
                stage = "playback"
                player.currentTime = 0
                guard player.play() else {
                    call.reject("Could not start recording: " + (call.getString("path") ?? ""))
                    return
                }
                call.resolve(["duration": player.duration])
            } catch { self.rejectAudio(call, stage: stage, error: error) }
        }
    }

    @objc public func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            for player in self.players.values { player.stop(); player.currentTime = 0 }
            call.resolve()
        }
    }
}
