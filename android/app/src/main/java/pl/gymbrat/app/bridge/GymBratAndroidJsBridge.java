package pl.gymbrat.app.bridge;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.webkit.JavascriptInterface;

import androidx.annotation.Nullable;

import pl.gymbrat.app.BuildConfig;
import pl.gymbrat.app.MainActivity;
import pl.gymbrat.app.update.UpdateInstaller;

/**
 * Most JS ↔ Android. Nazwa obiektu w WebView: {@code GymBratAndroid}.
 * Kontrakt zgodny z {@code lib/app-webview.ts} w GymBrat.
 */
public final class GymBratAndroidJsBridge {
    private final Context appContext;
    private final Runnable onContentReady;
    private final UpdateInstaller updateInstaller;
    @Nullable
    private final MainActivity activity;

    public GymBratAndroidJsBridge(
            MainActivity activity,
            UpdateInstaller updateInstaller,
            Runnable onContentReady
    ) {
        this.activity = activity;
        this.appContext = activity.getApplicationContext();
        this.updateInstaller = updateInstaller;
        this.onContentReady = onContentReady;
    }

    @JavascriptInterface
    public String getVersionName() {
        return BuildConfig.VERSION_NAME;
    }

    @JavascriptInterface
    public int getVersionCode() {
        return BuildConfig.VERSION_CODE;
    }

    /** true = runtime CAMERA już przyznane (przed getUserMedia). */
    @JavascriptInterface
    public boolean hasCameraPermission() {
        MainActivity act = activity;
        if (act == null) return false;
        return act.hasCameraPermission();
    }

    /**
     * Pokazuje systemowy dialog CAMERA (jeśli potrzeba), potem woła
     * {@code window.__gymbratOnCameraPermission(true|false)} w WebView.
     * Bez tego Chromium często odrzuca getUserMedia z NotAllowedError
     * i w ogóle nie wywołuje WebChromeClient.onPermissionRequest.
     */
    @JavascriptInterface
    public void requestCameraPermission() {
        MainActivity act = activity;
        if (act == null) {
            notifyCameraPermissionResult(false);
            return;
        }
        act.requestCameraPermissionForWeb();
    }

    /** Otwiera ustawienia aplikacji (gdy użytkownik wcześniej trwale odmówił kamery). */
    @JavascriptInterface
    public void openAppSettings() {
        MainActivity act = activity;
        Handler main = new Handler(Looper.getMainLooper());
        main.post(() -> {
            Intent intent = new Intent(
                    android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS
            );
            intent.setData(Uri.parse("package:" + appContext.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (act != null) {
                act.startActivity(intent);
            } else {
                appContext.startActivity(intent);
            }
        });
    }

    public void notifyCameraPermissionResult(boolean granted) {
        MainActivity act = activity;
        if (act == null) return;
        String js = "window.__gymbratOnCameraPermission && window.__gymbratOnCameraPermission("
                + (granted ? "true" : "false") + ");";
        act.runOnUiThread(() -> {
            if (act.getWebView() != null) {
                act.getWebView().evaluateJavascript(js, null);
            }
        });
    }

    @JavascriptInterface
    public void checkUpdate() {
        updateInstaller.requestInstall();
    }

    @JavascriptInterface
    public void notifyContentReady() {
        Handler main = new Handler(Looper.getMainLooper());
        main.post(onContentReady);
    }

    @JavascriptInterface
    public void openExternalUrl(String url) {
        if (url == null) return;
        String raw = url.trim();
        if (raw.isEmpty()) return;
        Uri uri;
        try {
            uri = Uri.parse(raw);
        } catch (Exception e) {
            return;
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if (!"http".equals(scheme) && !"https".equals(scheme)) return;
        Handler main = new Handler(Looper.getMainLooper());
        main.post(() -> {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            appContext.startActivity(intent);
        });
    }

    @JavascriptInterface
    public void vibrate(String patternCsv) {
        if (patternCsv == null || patternCsv.trim().isEmpty()) return;
        String[] parts = patternCsv.split(",");
        long[] webPattern = new long[parts.length];
        int count = 0;
        for (String part : parts) {
            try {
                long value = Long.parseLong(part.trim());
                if (value >= 0L) {
                    webPattern[count++] = value;
                }
            } catch (NumberFormatException ignored) {
                // skip
            }
        }
        if (count == 0) return;
        long[] timings;
        if (count == 1 || webPattern[0] != 0L) {
            timings = new long[count + 1];
            timings[0] = 0L;
            System.arraycopy(webPattern, 0, timings, 1, count);
        } else {
            timings = new long[count];
            System.arraycopy(webPattern, 0, timings, 0, count);
        }

        Vibrator vibrator = resolveVibrator(appContext);
        if (vibrator == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (timings.length == 2 && timings[0] == 0L) {
                    vibrator.vibrate(
                            VibrationEffect.createOneShot(
                                    Math.max(1L, timings[1]),
                                    VibrationEffect.DEFAULT_AMPLITUDE
                            )
                    );
                } else {
                    vibrator.vibrate(VibrationEffect.createWaveform(timings, -1));
                }
            } else {
                vibrator.vibrate(timings, -1);
            }
        } catch (Exception ignored) {
            // device may disallow vibration
        }
    }

    private static Vibrator resolveVibrator(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = context.getSystemService(VibratorManager.class);
            return manager == null ? null : manager.getDefaultVibrator();
        }
        return context.getSystemService(Vibrator.class);
    }
}
