package pl.gymbrat.app.security;

import android.net.Uri;

import androidx.annotation.Nullable;

import java.util.Locale;

import pl.gymbrat.app.update.AppUpdater;

/**
 * Zaufane hosty WebView / deep linków.
 * Most {@code GymBratAndroid} wolno wystawiać wyłącznie na {@link #isAppOrigin}.
 */
public final class TrustedOrigins {
    private TrustedOrigins() {}

    /** Kanoniczny host z {@code API_BASE_URL} (+ znane aliasy GymBrat). */
    public static boolean isAppOrigin(@Nullable Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme();
        if (scheme == null) return false;
        if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) {
            return false;
        }
        String host = uri.getHost();
        if (host == null || host.isEmpty()) return false;
        String h = host.toLowerCase(Locale.US);

        String siteHost = hostOf(AppUpdater.siteBase());
        if (siteHost != null && h.equals(siteHost)) {
            return true;
        }
        // Tylko dokładne, znane hosty produkcyjne — bez wzorców po subdomenach
        // (każdy może zarejestrować np. xxx-gym-brat.vercel.app).
        if (h.equals("gym-brat.vercel.app") || h.equals("gymbrat.onrender.com")) {
            return true;
        }
        return false;
    }

    /** OAuth Google / Facebook — w WebView, ale BEZ mostu JS. */
    public static boolean isOAuthHost(@Nullable Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme();
        if (scheme == null) return false;
        if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) {
            return false;
        }
        String host = uri.getHost();
        if (host == null || host.isEmpty()) return false;
        String h = host.toLowerCase(Locale.US);

        if (h.equals("accounts.google.com")
                || h.equals("accounts.youtube.com")
                || h.equals("oauthaccountmanager.googleapis.com")
                || h.equals("www.googleapis.com")
                || h.equals("apis.google.com")
                || h.equals("ssl.gstatic.com")
                || h.equals("www.gstatic.com")
                || h.equals("fonts.gstatic.com")
                || h.endsWith(".googleusercontent.com")) {
            return true;
        }

        if (h.equals("facebook.com")
                || h.equals("www.facebook.com")
                || h.equals("m.facebook.com")
                || h.equals("mbasic.facebook.com")
                || h.equals("staticxx.facebook.com")
                || h.equals("fb.com")
                || h.equals("www.fb.com")
                || h.endsWith(".facebook.com")
                || h.endsWith(".fbcdn.net")) {
            return true;
        }
        return false;
    }

    /** Nawigacja zostaje w WebView (app + OAuth). */
    public static boolean shouldKeepInWebView(@Nullable Uri uri) {
        return isAppOrigin(uri) || isOAuthHost(uri);
    }

    /** Deep link / App Link — wyłącznie origin aplikacji. */
    public static boolean isTrustedDeepLink(@Nullable Uri uri) {
        return isAppOrigin(uri);
    }

    /** Zewnętrzna przeglądarka — tylko http(s), bez intent:/file:/javascript:. */
    public static boolean isSafeExternalBrowserUrl(@Nullable Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme();
        if (scheme == null) return false;
        String s = scheme.toLowerCase(Locale.US);
        return "https".equals(s) || "http".equals(s);
    }

    @Nullable
    private static String hostOf(@Nullable String url) {
        if (url == null || url.isEmpty()) return null;
        try {
            String h = Uri.parse(url).getHost();
            return h == null ? null : h.toLowerCase(Locale.US);
        } catch (Exception e) {
            return null;
        }
    }
}
