import AVFoundation
import Capacitor
import UIKit
import Darwin

class AppViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(AppIconPlugin())
        bridge?.registerPluginInstance(AppExperiencePlugin())
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
                const keyboard = await cap.nativePromise('Keyboard', 'getResizeMode', {});
                if (keyboard.mode !== 'none') throw new Error('Keyboard must use the app viewport layout');
                await cap.nativePromise('Keyboard', 'setAccessoryBarVisible', { isVisible: false });
                const lockedViewport = await cap.nativePromise('AppExperience', 'exerciseMode', { active: true });
                if (!lockedViewport.pinned || Math.abs(lockedViewport.offsetY) > 1) throw new Error('Lesson viewport moved');
                const restoredViewport = await cap.nativePromise('AppExperience', 'exerciseMode', { active: false });
                if (restoredViewport.pinned) throw new Error('Page scrolling was not restored');
                await cap.nativePromise('AppExperience', 'copy', { text: 'Coptic clipboard check' });
                const preferences = await cap.nativePromise('AppExperience', 'preferences', {});
                if (!(preferences.textScale > 0)) throw new Error('Invalid preferred text scale');
                await cap.nativePromise('AppExperience', 'feedback', { correct: true });
                await cap.nativePromise('AppExperience', 'feedback', { correct: false });
                await cap.nativePromise('LessonAudio', 'activate', {});
                for (const name of ['a.wav', 'correct-answer.wav', 'incorrect-answer.wav']) {
                  const path = '/audio/learn/shared/' + name;
                  await cap.nativePromise('LessonAudio', 'preload', { path });
                  const result = await cap.nativePromise('LessonAudio', 'play', { path });
                  if (!(result.duration > 0)) throw new Error('Invalid recording duration: ' + name);
                  await cap.nativePromise('LessonAudio', 'stop', {});
                }
                const slow = await cap.nativePromise('LessonAudio', 'play', { path: '/audio/learn/shared/a.wav', rate: .5 });
                if (Math.abs(slow.rate - .5) > .01) throw new Error('Slow replay rate was not applied');
                await cap.nativePromise('LessonAudio', 'stop', {});
                const normal = await cap.nativePromise('LessonAudio', 'play', { path: '/audio/learn/shared/a.wav', rate: 1 });
                if (Math.abs(normal.rate - 1) > .01) throw new Error('Normal replay rate was not restored');
                await cap.nativePromise('LessonAudio', 'stop', {});
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
                    if ProcessInfo.processInfo.environment["COPTIC_NATIVE_BACKUP_SMOKE"] == "1" {
                        self.verifyBackupBridge()
                    }
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
    // Only enabled in a disposable CI Debug simulator, never normal app startup.
    private var backupShareObserved = false
    private func verifyBackupBridge(attempt: Int = 0) {
        guard attempt < 450,
              let url = Bundle.main.url(forResource: "native-backup-smoke", withExtension: "js", subdirectory: "public"),
              let script = try? String(contentsOf: url, encoding: .utf8) else {
            print("COPTIC_NATIVE_BACKUP_ERROR: missing CI fixture or timeout")
            fflush(stdout)
            return
        }
        if !backupShareObserved, let sheet = presentedViewController as? UIActivityViewController, !sheet.isBeingPresented {
            backupShareObserved = true
            do {
                let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("progress-backups")
                let files = try FileManager.default.contentsOfDirectory(at: cache, includingPropertiesForKeys: nil).filter { $0.pathExtension == "json" }
                guard let file = files.first,
                      let backup = try JSONSerialization.jsonObject(with: Data(contentsOf: file)) as? [String: Any],
                      backup["format"] as? String == "coptic-progress-backup",
                      let records = backup["records"] as? [String: String], records.count == 6,
                      let reader = records["coptic-reader:v1"],
                      reader.unicodeScalars.contains(where: { $0.value == 0x0305 }),
                      reader.unicodeScalars.contains(where: { $0.value == 0x0301 }) else {
                    throw NSError(domain: "BackupSmoke", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid exported native JSON or Unicode"])
                }
                print("COPTIC_NATIVE_BACKUP_FILE_READY")
                print("COPTIC_NATIVE_SHARE_SHEET_READY")
            } catch {
                print("COPTIC_NATIVE_BACKUP_ERROR: \(error.localizedDescription)")
                fflush(stdout)
                return
            }
            // Exercise the plugin's real cancellation callback without a save.
            let completion = sheet.completionWithItemsHandler
            sheet.completionWithItemsHandler = nil
            sheet.dismiss(animated: false) { completion?(nil, false, nil, nil) }
        }
        webView?.evaluateJavaScript(script) { result, error in
            if let error = error {
                // A document reload can interrupt an evaluation; the next poll
                // re-enters the fixture using its session-only phase marker.
                if attempt > 440 { print("COPTIC_NATIVE_BACKUP_ERROR: \(error.localizedDescription)") }
            }
            if let state = result as? [String: Any], let status = state["status"] as? String {
                if status == "passed" && self.backupShareObserved {
                    print("COPTIC_NATIVE_BACKUP_READY")
                    fflush(stdout)
                    return
                }
                if status == "failed" {
                    print("COPTIC_NATIVE_BACKUP_ERROR: \(state["message"] ?? "unknown")")
                    fflush(stdout)
                    return
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { self.verifyBackupBridge(attempt: attempt + 1) }
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
            // Keep native pickers, the system keyboard and status-bar contrast
            // aligned with the app's explicit appearance preference.
            for scene in app.connectedScenes.compactMap({ $0 as? UIWindowScene }) {
                for window in scene.windows {
                    window.overrideUserInterfaceStyle = theme == "dark" ? .dark : .light
                }
            }
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
        player.enableRate = true
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
                player.enableRate = true
                player.rate = min(1.5, max(0.5, Float(call.getDouble("rate") ?? 1.0)))
                guard player.play() else {
                    call.reject("Could not start recording: " + (call.getString("path") ?? ""))
                    return
                }
                call.resolve(["duration": player.duration, "rate": player.rate])
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


/// Native accessibility preferences and restrained lesson-result feedback.
@objc(AppExperiencePlugin)
public class AppExperiencePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppExperiencePlugin"
    public let jsName = "AppExperience"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "preferences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "copy", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "feedback", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exerciseMode", returnType: CAPPluginReturnPromise)
    ]
    private var textObserver: NSObjectProtocol?
    private var exerciseActive = false
    private var scrollObservation: NSKeyValueObservation?
    public override func load() {
        // WKWebView can pan its UIScrollView to a focused input even when the
        // HTML document is fixed. Lesson panes own scrolling; keep this parent still.
        scrollObservation = bridge?.webView?.scrollView.observe(\.contentOffset, options: [.new]) { [weak self] scroll, _ in
            guard self?.exerciseActive == true, scroll.contentOffset != .zero else { return }
            scroll.setContentOffset(.zero, animated: false)
        }
        textObserver = NotificationCenter.default.addObserver(forName: UIContentSizeCategory.didChangeNotification, object: nil, queue: .main) { [weak self] _ in
            self?.notifyListeners("textScaleChanged", data: ["scale": UIFont.preferredFont(forTextStyle: .body).pointSize / 17.0])
        }
    }
    deinit { if let observer = textObserver { NotificationCenter.default.removeObserver(observer) } }
    @objc func exerciseMode(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.exerciseActive = call.getBool("active") ?? false
            guard let scroll = self.bridge?.webView?.scrollView else {
                call.reject("Web view is unavailable")
                return
            }
            if self.exerciseActive {
                scroll.setContentOffset(.zero, animated: false)
                #if DEBUG
                if ProcessInfo.processInfo.environment["COPTIC_NATIVE_AUDIO_SMOKE"] == "1" {
                    scroll.setContentOffset(CGPoint(x: 0, y: 80), animated: false)
                }
                #endif
            }
            call.resolve(["pinned": self.exerciseActive, "offsetY": Double(scroll.contentOffset.y)])
        }
    }
    @objc func preferences(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(["textScale": UIFont.preferredFont(forTextStyle: .body).pointSize / 17.0])
        }
    }
    @objc func copy(_ call: CAPPluginCall) {
        guard let text = call.getString("text") else {
            call.reject("Expected text to copy")
            return
        }
        DispatchQueue.main.async {
            UIPasteboard.general.string = text
            call.resolve()
        }
    }
    @objc func feedback(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(call.getBool("correct") == true ? .success : .error)
            call.resolve()
        }
    }
}
