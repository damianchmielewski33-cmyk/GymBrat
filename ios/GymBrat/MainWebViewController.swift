import UIKit
import WebKit

/// Pełnoekranowy WKWebView z natywnym splash, offline i mostem JS — baza pod App Store.
final class MainWebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private var webView: WKWebView!
    private let progressView = UIProgressView(progressViewStyle: .bar)
    private let splash = SplashView()
    private let offlineView = OfflineErrorView()
    private var progressObservation: NSKeyValueObservation?
    private let bridge = GymBratIosBridge()
    private let refreshControl = UIRefreshControl()
    private var didFinishInitialLoad = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Theme.background

        configureWebView()
        layoutChrome()
        wireBridgeAndNetwork()
        reloadHome()
    }

    deinit {
        progressObservation?.invalidate()
        NotificationCenter.default.removeObserver(self)
        webView?.configuration.userContentController.removeScriptMessageHandler(
            forName: GymBratIosBridge.messageName
        )
        NetworkMonitor.shared.onChange = nil
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    // MARK: - Setup

    private func configureWebView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.websiteDataStore = .default()

        if #available(iOS 15.0, *) {
            let prefs = WKWebpagePreferences()
            prefs.allowsContentJavaScript = true
            config.defaultWebpagePreferences = prefs
        }

        let ucc = config.userContentController
        ucc.addUserScript(GymBratIosBridge.makeBootstrapScript())
        ucc.add(bridge, name: GymBratIosBridge.messageName)

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = Theme.background
        webView.customUserAgent = Self.mergedUserAgent()
        bridge.webView = webView

        refreshControl.tintColor = Theme.gold
        refreshControl.addTarget(self, action: #selector(pulledToRefresh), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl
    }

    private func layoutChrome() {
        webView.translatesAutoresizingMaskIntoConstraints = false
        progressView.translatesAutoresizingMaskIntoConstraints = false
        splash.translatesAutoresizingMaskIntoConstraints = false
        offlineView.translatesAutoresizingMaskIntoConstraints = false

        progressView.progressTintColor = Theme.gold
        progressView.trackTintColor = UIColor.white.withAlphaComponent(0.12)

        view.addSubview(webView)
        view.addSubview(progressView)
        view.addSubview(offlineView)
        view.addSubview(splash)

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            progressView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            progressView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progressView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progressView.heightAnchor.constraint(equalToConstant: 2),

            offlineView.topAnchor.constraint(equalTo: view.topAnchor),
            offlineView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            offlineView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            offlineView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            splash.topAnchor.constraint(equalTo: view.topAnchor),
            splash.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            splash.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            splash.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        progressObservation = webView.observe(\.estimatedProgress, options: [.new]) { [weak self] wv, _ in
            guard let self else { return }
            let p = Float(wv.estimatedProgress)
            self.progressView.isHidden = p >= 1 || !self.offlineView.isHidden
            self.progressView.setProgress(p, animated: true)
            if p >= 0.95, !self.didFinishInitialLoad {
                self.hideSplashIfNeeded()
            }
        }
    }

    private func wireBridgeAndNetwork() {
        bridge.onContentReady = { [weak self] in
            self?.hideSplashIfNeeded()
        }
        offlineView.onRetry = { [weak self] in
            self?.reloadHome()
        }
        NetworkMonitor.shared.onChange = { [weak self] online in
            guard let self else { return }
            if online, !self.offlineView.isHidden {
                self.reloadHome()
            } else if !online, self.didFinishInitialLoad == false {
                self.showOffline()
            }
        }
        if !NetworkMonitor.shared.isOnline {
            showOffline()
        }

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleDeepLink(_:)),
            name: .gymBratOpenURL,
            object: nil
        )
    }

    @objc private func handleDeepLink(_ note: Notification) {
        guard let url = note.object as? URL, TrustedOrigins.isAppOrigin(url) else { return }
        offlineView.hide()
        webView.load(URLRequest(url: url))
    }

    // MARK: - Navigation helpers

    private func reloadHome() {
        offlineView.hide()
        webView.isHidden = false
        let request = URLRequest(
            url: AppConfig.apiBaseURL,
            cachePolicy: .reloadIgnoringLocalCacheData,
            timeoutInterval: 30
        )
        webView.load(request)
    }

    private func showOffline() {
        splash.dismiss(animated: false)
        offlineView.show(
            title: "Brak połączenia",
            message: "Sprawdź internet i spróbuj ponownie. GymBrat potrzebuje sieci, żeby wczytać dziennik treningowy."
        )
        progressView.isHidden = true
    }

    private func showLoadError() {
        splash.dismiss(animated: false)
        offlineView.show(
            title: "Nie udało się wczytać",
            message: "Serwer nie odpowiedział. Sprawdź sieć albo spróbuj za chwilę."
        )
        progressView.isHidden = true
    }

    private func hideSplashIfNeeded() {
        guard splash.superview != nil else { return }
        didFinishInitialLoad = true
        splash.dismiss(animated: true)
    }

    @objc private func pulledToRefresh() {
        webView.reload()
    }

    private static func mergedUserAgent() -> String {
        let probe = WKWebView(frame: .zero)
        let base = probe.value(forKey: "userAgent") as? String ?? "Mozilla/5.0"
        return "\(base) \(AppConfig.userAgentSuffix)"
    }

    // MARK: - WKNavigationDelegate

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        let scheme = url.scheme?.lowercased() ?? ""
        if scheme == "mailto" || scheme == "tel" || scheme == "sms" {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            decisionHandler(.cancel)
            return
        }
        if TrustedOrigins.shouldKeepInWebView(url) {
            decisionHandler(.allow)
            return
        }
        if TrustedOrigins.isSafeExternalBrowserURL(url) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        refreshControl.endRefreshing()
        offlineView.hide()
        hideSplashIfNeeded()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        refreshControl.endRefreshing()
        handleNavigationError(error)
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        refreshControl.endRefreshing()
        handleNavigationError(error)
    }

    private func handleNavigationError(_ error: Error) {
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain, ns.code == NSURLErrorCancelled {
            return
        }
        if !NetworkMonitor.shared.isOnline {
            showOffline()
        } else {
            showLoadError()
        }
    }

    // MARK: - WKUIDelegate

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            if TrustedOrigins.shouldKeepInWebView(url) {
                webView.load(navigationAction.request)
            } else if TrustedOrigins.isSafeExternalBrowserURL(url) {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
        }
        return nil
    }

    @available(iOS 15.0, *)
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        let hostURL = URL(string: "https://\(origin.host)")
        if TrustedOrigins.isAppOrigin(hostURL) {
            decisionHandler(.grant)
        } else {
            decisionHandler(.deny)
        }
    }

    @available(iOS 14.5, *)
    func webView(
        _ webView: WKWebView,
        requestDeviceOrientationAndMotionPermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        decisionHandler(.deny)
    }
}
