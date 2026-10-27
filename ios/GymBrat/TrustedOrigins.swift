import Foundation

/// Zaufane hosty WebView / deep linków (parzystość z Android `TrustedOrigins`).
enum TrustedOrigins {
    static func isAppOrigin(_ url: URL?) -> Bool {
        guard let url, let scheme = url.scheme?.lowercased(), let host = url.host?.lowercased() else {
            return false
        }
        guard scheme == "https" || scheme == "http" else { return false }

        let siteHost = AppConfig.apiBaseURL.host?.lowercased()
        if let siteHost, host == siteHost {
            return true
        }
        if host == "gym-brat.vercel.app" || host == "gymbrat.onrender.com" {
            return true
        }
        if host.hasSuffix(".vercel.app"), host.contains("gym-brat") {
            return true
        }
        if host.hasSuffix(".onrender.com"), host.contains("gymbrat") {
            return true
        }
        return false
    }

    static func isOAuthHost(_ url: URL?) -> Bool {
        guard let url, let scheme = url.scheme?.lowercased(), let host = url.host?.lowercased() else {
            return false
        }
        guard scheme == "https" || scheme == "http" else { return false }

        let google: Set<String> = [
            "accounts.google.com",
            "accounts.youtube.com",
            "oauthaccountmanager.googleapis.com",
            "www.googleapis.com",
            "apis.google.com",
            "ssl.gstatic.com",
            "www.gstatic.com",
            "fonts.gstatic.com",
        ]
        if google.contains(host) || host.hasSuffix(".googleusercontent.com") {
            return true
        }

        let facebook: Set<String> = [
            "facebook.com",
            "www.facebook.com",
            "m.facebook.com",
            "mbasic.facebook.com",
            "staticxx.facebook.com",
            "fb.com",
            "www.fb.com",
        ]
        if facebook.contains(host) || host.hasSuffix(".facebook.com") || host.hasSuffix(".fbcdn.net") {
            return true
        }
        return false
    }

    static func shouldKeepInWebView(_ url: URL?) -> Bool {
        isAppOrigin(url) || isOAuthHost(url)
    }

    static func isSafeExternalBrowserURL(_ url: URL?) -> Bool {
        guard let scheme = url?.scheme?.lowercased() else { return false }
        return scheme == "https" || scheme == "http"
    }
}
