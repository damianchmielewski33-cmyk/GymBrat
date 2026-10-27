import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    private weak var mainController: MainWebViewController?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        let root = MainWebViewController()
        mainController = root
        window.rootViewController = root
        window.overrideUserInterfaceStyle = .dark
        window.makeKeyAndVisible()
        self.window = window
        return true
    }

    /// Deep link `gymbrat://…` — otwiera ścieżkę na originie aplikacji.
    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        guard url.scheme?.lowercased() == "gymbrat" else { return false }
        var components = URLComponents(url: AppConfig.apiBaseURL, resolvingAgainstBaseURL: false)
        let path = url.host.map { "/" + $0 } ?? "/"
        let extra = url.path
        components?.path = (path + extra).replacingOccurrences(of: "//", with: "/")
        components?.query = url.query
        guard let target = components?.url, TrustedOrigins.isAppOrigin(target) else {
            return false
        }
        NotificationCenter.default.post(name: .gymBratOpenURL, object: target)
        return true
    }
}

extension Notification.Name {
    static let gymBratOpenURL = Notification.Name("pl.gymbrat.openURL")
}
