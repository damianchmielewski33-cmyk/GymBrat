package pl.gymbrat.app.update;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import pl.gymbrat.app.BuildConfig;

public final class AppUpdater {
    private static final String TAG = "GymBratUpdater";

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

    /** Wynik sprawdzenia, czy da się zainstalować APK nad istniejącą aplikacją. */
    public static final class InstallCheck {
        public final boolean canInstall;
        public final String message;

        private InstallCheck(boolean canInstall, String message) {
            this.canInstall = canInstall;
            this.message = message;
        }

        public static InstallCheck ok() {
            return new InstallCheck(true, null);
        }

        public static InstallCheck block(String message) {
            return new InstallCheck(false, message);
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

    /**
     * Sprawdza podpis APK vs zainstalowaną GymBrat.
     * Inny klucz → instalator często „wisi” po pełnym pasku zamiast pokazać błąd.
     */
    public static InstallCheck canInstallOverExisting(Context context, File apkFile) {
        PackageManager pm = context.getPackageManager();
        String packageName = context.getPackageName();
        try {
            pm.getPackageInfo(packageName, 0);
        } catch (PackageManager.NameNotFoundException e) {
            return InstallCheck.ok();
        }

        PackageInfo archive = readArchiveInfo(pm, apkFile.getAbsolutePath());
        if (archive == null) {
            return InstallCheck.block(
                    "Plik APK jest uszkodzony albo niekompletny. Pobierz ponownie."
            );
        }
        if (archive.packageName != null
                && !packageName.equals(archive.packageName)) {
            return InstallCheck.block(
                    "Ten APK ma inny identyfikator pakietu (" + archive.packageName + ")."
            );
        }

        byte[][] installed = signingDigests(pm, packageName, false);
        byte[][] incoming = signingDigestsFromArchive(archive);
        if (installed == null || installed.length == 0) {
            return InstallCheck.ok();
        }
        if (incoming == null || incoming.length == 0) {
            return InstallCheck.block(
                    "Nie da się zweryfikować podpisu APK. Pobierz plik ponownie."
            );
        }
        if (!digestsMatch(installed, incoming)) {
            return InstallCheck.block(
                    "Konflikt podpisu z zainstalowaną GymBrat. "
                            + "Odinstaluj obecną aplikację, potem zainstaluj ten APK ponownie."
            );
        }
        return InstallCheck.ok();
    }

    public static void installApk(Activity activity, File apkFile) {
        InstallCheck check = canInstallOverExisting(activity, apkFile);
        if (!check.canInstall) {
            throw new IllegalStateException(
                    check.message != null
                            ? check.message
                            : "Nie można zainstalować tej aktualizacji."
            );
        }
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

    @SuppressWarnings("deprecation")
    private static PackageInfo readArchiveInfo(PackageManager pm, String path) {
        try {
            if (Build.VERSION.SDK_INT >= 28) {
                return pm.getPackageArchiveInfo(
                        path,
                        PackageManager.GET_SIGNING_CERTIFICATES
                                | PackageManager.GET_SIGNATURES
                );
            }
            return pm.getPackageArchiveInfo(path, PackageManager.GET_SIGNATURES);
        } catch (Exception e) {
            Log.w(TAG, "getPackageArchiveInfo failed", e);
            return null;
        }
    }

    @SuppressWarnings("deprecation")
    private static byte[][] signingDigests(
            PackageManager pm,
            String packageName,
            boolean archive
    ) {
        try {
            PackageInfo info;
            if (Build.VERSION.SDK_INT >= 28) {
                info = pm.getPackageInfo(
                        packageName,
                        PackageManager.GET_SIGNING_CERTIFICATES
                );
            } else {
                info = pm.getPackageInfo(packageName, PackageManager.GET_SIGNATURES);
            }
            return digestsFromPackageInfo(info);
        } catch (Exception e) {
            Log.w(TAG, "signingDigests failed archive=" + archive, e);
            return null;
        }
    }

    private static byte[][] signingDigestsFromArchive(PackageInfo archive) {
        return digestsFromPackageInfo(archive);
    }

    @SuppressWarnings("deprecation")
    private static byte[][] digestsFromPackageInfo(PackageInfo info) {
        if (info == null) return null;
        if (Build.VERSION.SDK_INT >= 28) {
            SigningInfo si = info.signingInfo;
            if (si != null) {
                Signature[] sigs = si.hasMultipleSigners()
                        ? si.getApkContentsSigners()
                        : si.getSigningCertificateHistory();
                return digestsOf(sigs);
            }
        }
        return digestsOf(info.signatures);
    }

    private static byte[][] digestsOf(Signature[] signatures) {
        if (signatures == null || signatures.length == 0) return null;
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[][] out = new byte[signatures.length][];
            for (int i = 0; i < signatures.length; i++) {
                md.reset();
                out[i] = md.digest(signatures[i].toByteArray());
            }
            Arrays.sort(out, (a, b) -> {
                int n = Math.min(a.length, b.length);
                for (int i = 0; i < n; i++) {
                    int d = (a[i] & 0xff) - (b[i] & 0xff);
                    if (d != 0) return d;
                }
                return a.length - b.length;
            });
            return out;
        } catch (Exception e) {
            Log.w(TAG, "digest failed", e);
            return null;
        }
    }

    private static boolean digestsMatch(byte[][] a, byte[][] b) {
        if (a.length != b.length) return false;
        for (int i = 0; i < a.length; i++) {
            if (!Arrays.equals(a[i], b[i])) return false;
        }
        return true;
    }
}
