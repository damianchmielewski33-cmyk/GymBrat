package pl.gymbrat.app.update;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import pl.gymbrat.app.BuildConfig;

public final class AppUpdater {
    public static final class AppUpdateInfo {
        public final int versionCode;
        public final String versionName;
        public final String apkUrl;
        public final String notes;

        public AppUpdateInfo(int versionCode, String versionName, String apkUrl, String notes) {
            this.versionCode = versionCode;
            this.versionName = versionName;
            this.apkUrl = apkUrl;
            this.notes = notes;
        }
    }

    private static final OkHttpClient HTTP = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build();

    private AppUpdater() {
    }

    public static String siteBase() {
        String raw = BuildConfig.API_BASE_URL.trim();
        return raw.endsWith("/") ? raw.substring(0, raw.length() - 1) : raw;
    }

    public static String siteBaseWithSlash() {
        String raw = BuildConfig.API_BASE_URL.trim();
        return raw.endsWith("/") ? raw : raw + "/";
    }

    public static AppUpdateInfo checkForUpdate() throws Exception {
        String base = siteBaseWithSlash();
        Request req = new Request.Builder()
                .url(base + "api/android/version")
                .header("Accept", "application/json")
                .header("User-Agent", "GymBrat-Android-Updater/" + BuildConfig.VERSION_NAME)
                .get()
                .build();
        try (Response res = HTTP.newCall(req).execute()) {
            if (!res.isSuccessful() || res.body() == null) return null;
            String body = res.body().string();
            JSONObject json = new JSONObject(body);
            int code = json.optInt("versionCode", 0);
            if (code <= BuildConfig.VERSION_CODE) return null;
            String name = json.optString("versionName", String.valueOf(code));
            String apkUrl = json.optString("apkUrl", base + "api/android/download?source=in-app-update");
            String notes = json.has("notes") && !json.isNull("notes") ? json.optString("notes") : null;
            return new AppUpdateInfo(code, name, apkUrl, notes);
        }
    }

    public static boolean canRequestPackageInstalls(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return context.getPackageManager().canRequestPackageInstalls();
        }
        return true;
    }

    public static void openUnknownSourcesSettings(Activity activity) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.getPackageName())
            );
            activity.startActivity(intent);
        }
    }

    public static File downloadApk(Context context, AppUpdateInfo info) throws Exception {
        File dir = new File(context.getExternalFilesDir(null), "updates");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("Nie udało się utworzyć katalogu aktualizacji");
        }
        File out = new File(dir, "gymbrat-" + info.versionCode + ".apk");
        if (out.exists() && !out.delete()) {
            throw new IllegalStateException("Nie udało się usunąć starego APK");
        }
        Request req = new Request.Builder()
                .url(info.apkUrl)
                .header("User-Agent", "GymBrat-Android-Updater/" + BuildConfig.VERSION_NAME)
                .get()
                .build();
        try (Response res = HTTP.newCall(req).execute()) {
            if (!res.isSuccessful()) {
                throw new IllegalStateException("Pobieranie APK nieudane (" + res.code() + ")");
            }
            ResponseBody body = res.body();
            if (body == null) {
                throw new IllegalStateException("Pusta odpowiedź APK");
            }
            try (InputStream in = body.byteStream();
                 FileOutputStream sink = new FileOutputStream(out)) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) >= 0) {
                    sink.write(buf, 0, n);
                }
            }
        }
        if (out.length() < 50_000L) {
            //noinspection ResultOfMethodCallIgnored
            out.delete();
            throw new IllegalStateException("Pobrany plik wygląda na uszkodzony");
        }
        return out;
    }

    public static void installApk(Activity activity, File apkFile) {
        Uri uri = FileProvider.getUriForFile(
                activity,
                activity.getPackageName() + ".fileprovider",
                apkFile
        );
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(intent);
    }
}
