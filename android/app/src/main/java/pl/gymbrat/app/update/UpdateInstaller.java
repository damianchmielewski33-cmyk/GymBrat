package pl.gymbrat.app.update;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import java.io.File;
import java.lang.ref.WeakReference;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Pobiera i instaluje APK po wywołaniu mostu JS {@code GymBratAndroid.checkUpdate()}.
 */
public final class UpdateInstaller {
    private final WeakReference<Activity> activityRef;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicBoolean busy = new AtomicBoolean(false);

    public UpdateInstaller(Activity activity) {
        this.activityRef = new WeakReference<>(activity);
    }

    public void requestInstall() {
        if (!busy.compareAndSet(false, true)) {
            toast("Aktualizacja już trwa…");
            return;
        }
        executor.execute(() -> {
            Activity activity = activityRef.get();
            if (activity == null || activity.isFinishing()) {
                busy.set(false);
                return;
            }
            try {
                toast("Sprawdzam aktualizację…");
                AppUpdater.AppUpdateInfo info = AppUpdater.checkForUpdate();
                if (info == null) {
                    toast("Masz najnowszą wersję aplikacji.");
                    return;
                }
                if (!AppUpdater.canRequestPackageInstalls(activity)) {
                    toast("Zezwól na instalację z tego źródła, potem spróbuj ponownie.");
                    main.post(() -> AppUpdater.openUnknownSourcesSettings(activity));
                    return;
                }
                toast("Pobieram GymBrat " + info.versionName + "…");
                File apk = AppUpdater.downloadApk(activity, info);
                main.post(() -> AppUpdater.installApk(activity, apk));
            } catch (Exception e) {
                toast("Nie udało się zaktualizować: " + e.getMessage());
            } finally {
                busy.set(false);
            }
        });
    }

    public void shutdown() {
        executor.shutdownNow();
    }

    private void toast(String message) {
        main.post(() -> {
            Activity activity = activityRef.get();
            if (activity == null || activity.isFinishing()) return;
            Toast.makeText(activity, message, Toast.LENGTH_SHORT).show();
        });
    }
}
