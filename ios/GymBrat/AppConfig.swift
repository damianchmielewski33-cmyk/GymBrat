import Foundation

enum AppConfig {
    static var apiBaseURL: URL {
        let raw = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String
        let trimmed = (raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if let url = URL(string: trimmed), url.scheme != nil {
            return url
        }
        return URL(string: "https://gym-brat.vercel.app/")!
    }

    static var versionName: String {
        (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "0.0.0"
    }

    static var versionCode: Int {
        let raw = Bundle.main.infoDictionary?["CFBundleVersion"] as? String
        return Int(raw ?? "") ?? 0
    }

    static var userAgentSuffix: String {
        "GymBratIosApp/\(versionName) GymBratIosBuild/\(versionCode)"
    }
}
