package pl.gymbrat.app.bridge;

import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.webkit.JavascriptInterface;

import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;

import pl.gymbrat.app.BuildConfig;
import pl.gymbrat.app.MainActivity;
import pl.gymbrat.app.ads.InterstitialAdHelper;
import pl.gymbrat.app.reminders.ReminderScheduler;
import pl.gymbrat.app.security.TrustedOrigins;
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
    @Nullable
    private InterstitialAdHelper interstitialAds;
    @Nullable
    private String torchCameraId;
    private boolean torchEnabled;

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

    /** Podłącz helper reklam po utworzeniu WebView. */
    public void setInterstitialAdHelper(@Nullable InterstitialAdHelper helper) {
        this.interstitialAds = helper;
    }

    /**
     * Defense-in-depth: metody mostu tylko gdy WebView jest na originie GymBrat
     * (most i tak jest zdejmowany poza app, ale sprawdzamy URL).
     */
    private boolean isCallFromAppOrigin() {
        MainActivity act = activity;
        if (act == null || act.getWebView() == null) return false;
        String url = act.getWebView().getUrl();
        if (url == null || url.isEmpty()) return false;
        try {
            return TrustedOrigins.isAppOrigin(Uri.parse(url));
        } catch (Exception e) {
            return false;
        }
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
        if (!isCallFromAppOrigin()) return false;
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
        if (!isCallFromAppOrigin()) {
            notifyCameraPermissionResult(false);
            return;
        }
        MainActivity act = activity;
        if (act == null) {
            notifyCameraPermissionResult(false);
            return;
        }
        act.requestCameraPermissionForWeb();
    }

    /** Czy urządzenie ma latarkę (tył z FLASH_INFO_AVAILABLE). */
    @JavascriptInterface
    public boolean hasTorch() {
        if (!isCallFromAppOrigin()) return false;
        return resolveTorchCameraId() != null;
    }

    /**
     * Włącza/wyłącza latarkę przez CameraManager — WebView często nie honoruje
     * MediaTrackConstraints.torch przy otwartym getUserMedia.
     * Wymaga runtime CAMERA (to samo co skaner).
     * Próbujemy wszystkie ID z fleszem: WebView może trzymać jedną kamerę
     * (CAMERA_IN_USE), a latarka siedzi na innym logical id.
     */
    @JavascriptInterface
    public boolean setTorch(boolean enabled) {
        if (!isCallFromAppOrigin()) return false;
        if (ContextCompat.checkSelfPermission(appContext, android.Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        CameraManager manager = appContext.getSystemService(CameraManager.class);
        if (manager == null) return false;
        String[] candidates = listFlashCameraIds(manager);
        if (candidates.length == 0) return false;

        if (!enabled) {
            boolean any = false;
            for (String id : candidates) {
                try {
                    manager.setTorchMode(id, false);
                    any = true;
                } catch (Exception ignored) {
                    /* ta kamera niedostępna */
                }
            }
            torchEnabled = false;
            return any || torchCameraId != null;
        }

        // Najpierw zapamiętane ID, potem tył, potem reszta.
        String preferred = torchCameraId;
        for (String id : candidates) {
            if (preferred != null && !id.equals(preferred)) continue;
            try {
                manager.setTorchMode(id, true);
                torchCameraId = id;
                torchEnabled = true;
                return true;
            } catch (Exception ignored) {
                /* CAMERA_IN_USE / brak obsługi torch na tym id */
            }
        }
        for (String id : candidates) {
            if (preferred != null && id.equals(preferred)) continue;
            try {
                manager.setTorchMode(id, true);
                torchCameraId = id;
                torchEnabled = true;
                return true;
            } catch (Exception ignored) {
                /* kolejny kandydat */
            }
        }
        return false;
    }

    /** Wyłącz latarkę przy pauzie/zamknięciu Activity (bezpieczeństwo baterii). */
    public void ensureTorchOff() {
        if (!torchEnabled) return;
        String cameraId = torchCameraId != null ? torchCameraId : resolveTorchCameraId();
        if (cameraId == null) {
            torchEnabled = false;
            return;
        }
        CameraManager manager = appContext.getSystemService(CameraManager.class);
        if (manager == null) return;
        try {
            manager.setTorchMode(cameraId, false);
        } catch (Exception ignored) {
            /* kamera niedostępna / już wyłączona */
        }
        torchEnabled = false;
    }

    @Nullable
    private String resolveTorchCameraId() {
        if (torchCameraId != null) return torchCameraId;
        CameraManager manager = appContext.getSystemService(CameraManager.class);
        if (manager == null) return null;
        String[] flashIds = listFlashCameraIds(manager);
        if (flashIds.length == 0) return null;
        torchCameraId = flashIds[0];
        return torchCameraId;
    }

    /** ID z fleszem: najpierw tył, potem pozostałe. */
    private static String[] listFlashCameraIds(CameraManager manager) {
        java.util.ArrayList<String> back = new java.util.ArrayList<>();
        java.util.ArrayList<String> other = new java.util.ArrayList<>();
        try {
            for (String id : manager.getCameraIdList()) {
                CameraCharacteristics chars = manager.getCameraCharacteristics(id);
                Boolean flash = chars.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                if (!Boolean.TRUE.equals(flash)) continue;
                Integer facing = chars.get(CameraCharacteristics.LENS_FACING);
                if (facing != null && facing == CameraCharacteristics.LENS_FACING_BACK) {
                    back.add(id);
                } else {
                    other.add(id);
                }
            }
        } catch (CameraAccessException e) {
            return new String[0];
        } catch (Exception e) {
            return new String[0];
        }
        back.addAll(other);
        return back.toArray(new String[0]);
    }

    /** Otwiera ustawienia aplikacji (gdy użytkownik wcześniej trwale odmówił kamery). */
    @JavascriptInterface
    public void openAppSettings() {
        if (!isCallFromAppOrigin()) return;
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

    /**
     * Zapisuje ustawienia przypomnień (JSON jak w {@code lib/reminders-types.ts}) i planuje
     * alarmy w AlarmManager — działają przy zamkniętej aplikacji. Pusty obiekt je kasuje.
     */
    @JavascriptInterface
    public boolean scheduleReminders(String json) {
        if (!isCallFromAppOrigin()) return false;
        return ReminderScheduler.save(appContext, json);
    }

    /** true = Android pozwala na dokładne alarmy (wymagane, żeby przypomnienie przyszło o godzinie). */
    @JavascriptInterface
    public boolean canScheduleExactAlarms() {
        if (!isCallFromAppOrigin()) return false;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        AlarmManager alarms = appContext.getSystemService(AlarmManager.class);
        return alarms != null && alarms.canScheduleExactAlarms();
    }

    /** Ekran systemowy „Alarms & reminders” / dokładne alarmy dla GymBrat. */
    @JavascriptInterface
    public void openExactAlarmSettings() {
        if (!isCallFromAppOrigin()) return;
        MainActivity act = activity;
        Handler main = new Handler(Looper.getMainLooper());
        main.post(() -> {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                intent = new Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + appContext.getPackageName()));
            } else {
                intent = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + appContext.getPackageName()));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (act != null) {
                act.startActivity(intent);
            } else {
                appContext.startActivity(intent);
            }
        });
    }

    /** true = aplikacja może pokazywać powiadomienia (POST_NOTIFICATIONS + nie wyciszone). */
    @JavascriptInterface
    public boolean hasNotificationPermission() {
        if (!isCallFromAppOrigin()) return false;
        MainActivity act = activity;
        return act != null && act.hasNotificationPermission();
    }

    /** Systemowy dialog zgody (Android 13+); wynik: {@code window.__gymbratOnNotificationPermission(bool)}. */
    @JavascriptInterface
    public void requestNotificationPermission() {
        if (!isCallFromAppOrigin()) {
            notifyNotificationPermissionResult(false);
            return;
        }
        MainActivity act = activity;
        if (act == null) {
            notifyNotificationPermissionResult(false);
            return;
        }
        act.requestNotificationPermissionForWeb();
    }

    public void notifyNotificationPermissionResult(boolean granted) {
        MainActivity act = activity;
        if (act == null) return;
        String js = "window.__gymbratOnNotificationPermission && window.__gymbratOnNotificationPermission("
                + (granted ? "true" : "false") + ");";
        act.runOnUiThread(() -> {
            if (act.getWebView() != null) {
                act.getWebView().evaluateJavascript(js, null);
            }
        });
    }

    @JavascriptInterface
    public void checkUpdate() {
        if (!isCallFromAppOrigin()) return;
        updateInstaller.requestInstall();
    }

    @JavascriptInterface
    public void notifyContentReady() {
        if (!isCallFromAppOrigin()) return;
        Handler main = new Handler(Looper.getMainLooper());
        main.post(onContentReady);
    }

    @JavascriptInterface
    public void openExternalUrl(String url) {
        if (!isCallFromAppOrigin()) return;
        if (url == null) return;
        String raw = url.trim();
        if (raw.isEmpty()) return;
        Uri uri;
        try {
            uri = Uri.parse(raw);
        } catch (Exception e) {
            return;
        }
        if (!TrustedOrigins.isSafeExternalBrowserUrl(uri)) return;
        Handler main = new Handler(Looper.getMainLooper());
        main.post(() -> {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            appContext.startActivity(intent);
        });
    }

    @JavascriptInterface
    public boolean hasInterstitialAds() {
        if (!isCallFromAppOrigin()) return false;
        InterstitialAdHelper helper = interstitialAds;
        return helper != null && helper.canShowAds();
    }

    @JavascriptInterface
    public void setMarketingConsent(boolean allowed) {
        if (!isCallFromAppOrigin()) return;
        InterstitialAdHelper helper = interstitialAds;
        if (helper == null) return;
        Handler main = new Handler(Looper.getMainLooper());
        main.post(() -> helper.setMarketingConsent(allowed));
    }

    @JavascriptInterface
    public boolean hasMarketingConsent() {
        if (!isCallFromAppOrigin()) return false;
        InterstitialAdHelper helper = interstitialAds;
        return helper != null && helper.hasMarketingConsent();
    }

    /**
     * Pokazuje interstitial AdMob; po zamknięciu woła
     * {@code window.__gymbratOnInterstitial(true|false)}.
     */
    @JavascriptInterface
    public void showInterstitialAd(String placement) {
        if (!isCallFromAppOrigin()) {
            Handler main = new Handler(Looper.getMainLooper());
            main.post(() -> {
                MainActivity act = activity;
                if (act == null || act.getWebView() == null) return;
                act.getWebView().evaluateJavascript(
                        "try{if(typeof window.__gymbratOnInterstitial==='function'){window.__gymbratOnInterstitial(false);}}catch(e){}",
                        null
                );
            });
            return;
        }
        InterstitialAdHelper helper = interstitialAds;
        if (helper == null || !helper.canShowAds()) {
            Handler main = new Handler(Looper.getMainLooper());
            main.post(() -> {
                MainActivity act = activity;
                if (act == null || act.getWebView() == null) return;
                act.getWebView().evaluateJavascript(
                        "try{if(typeof window.__gymbratOnInterstitial==='function'){window.__gymbratOnInterstitial(false);}}catch(e){}",
                        null
                );
            });
            return;
        }
        helper.show(placement);
    }

    @JavascriptInterface
    public void vibrate(String patternCsv) {
        if (!isCallFromAppOrigin()) return;
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
