import Foundation
import UIKit
import WebKit

/// Most JS ↔ iOS. Nazwa obiektu w WebView: `GymBratIos`.
/// Kontrakt z `lib/app-webview.ts` (część iOS) — parzystość z Androidem w zakresie MVP App Store.
final class GymBratIosBridge: NSObject, WKScriptMessageHandler {
    static let objectName = "GymBratIos"
    static let messageName = "gymbratIos"

    weak var webView: WKWebView?
    var onContentReady: (() -> Void)?

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == Self.messageName else { return }
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

        guard isCallFromAppOrigin() else { return }

        switch action {
        case "notifyContentReady":
            DispatchQueue.main.async { [weak self] in self?.onContentReady?() }
        case "vibrate":
            let pattern = (body["pattern"] as? String) ?? "20"
            DispatchQueue.main.async { HapticsHelper.vibrate(patternCsv: pattern) }
        case "openExternalUrl":
            guard let raw = body["url"] as? String, let url = URL(string: raw),
                  TrustedOrigins.isSafeExternalBrowserURL(url) else { return }
            DispatchQueue.main.async {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
        default:
            break
        }
    }

    private func isCallFromAppOrigin() -> Bool {
        guard let raw = webView?.url else { return false }
        return TrustedOrigins.isAppOrigin(raw)
    }

    /// Skrypt wstrzykujący `window.GymBratIos` (API synchroniczne + postMessage).
    static func makeBootstrapScript() -> WKUserScript {
        let name = AppConfig.versionName
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        let code = AppConfig.versionCode
        let handler = messageName
        let source = """
        (function() {
          if (window.GymBratIos && window.GymBratIos.__native) return;
          function post(action, extra) {
            try {
              var payload = Object.assign({ action: action }, extra || {});
              window.webkit.messageHandlers.\(handler).postMessage(payload);
            } catch (e) {}
          }
          window.GymBratIos = {
            __native: true,
            getVersionName: function() { return '\(name)'; },
            getVersionCode: function() { return \(code); },
            notifyContentReady: function() { post('notifyContentReady'); },
            vibrate: function(patternCsv) { post('vibrate', { pattern: String(patternCsv || '20') }); },
            openExternalUrl: function(url) { post('openExternalUrl', { url: String(url || '') }); }
          };
        })();
        """
        return WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    }
}
