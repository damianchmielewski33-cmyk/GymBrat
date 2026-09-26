package pl.gymbrat.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import pl.gymbrat.app.bridge.GymBratAndroidJsBridge;
import pl.gymbrat.app.update.AppUpdater;
import pl.gymbrat.app.update.UpdateInstaller;

/**
 * Pełnoekranowy WebView — UI GymBrat 1:1 jak w przeglądarce.
 */
public final class MainActivity extends AppCompatActivity {
    private WebView webView;
    private ProgressBar progressBar;
    private View splash;
    private UpdateInstaller updateInstaller;
    private GymBratAndroidJsBridge jsBridge;
    private boolean contentReady;

    /** Callback WebView dla input type=file — bez tego wybór zdjęć w APK milczy. */
    private ValueCallback<Uri[]> filePathCallback;

    /** Oczekujące żądanie getUserMedia (skan etykiety) — po runtime CAMERA. */
    private PermissionRequest pendingWebPermissionRequest;

    /** true = JS czeka na wynik dialogu CAMERA (przed getUserMedia). */
    private boolean pendingJsCameraRequest;

    private final ActivityResultLauncher<String> cameraPermissionLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.RequestPermission(),
                    granted -> {
                        PermissionRequest req = pendingWebPermissionRequest;
                        pendingWebPermissionRequest = null;
                        boolean jsWaiting = pendingJsCameraRequest;
                        pendingJsCameraRequest = false;

                        if (req != null) {
                            if (granted) {
                                grantCameraToWeb(req);
                            } else {
                                req.deny();
                            }
                        }
                        if (jsWaiting && jsBridge != null) {
                            jsBridge.notifyCameraPermissionResult(granted);
                        }
                    }
            );

    private final ActivityResultLauncher<Intent> fileChooserLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.StartActivityForResult(),
                    result -> {
                        ValueCallback<Uri[]> callback = filePathCallback;
                        filePathCallback = null;
                        if (callback == null) return;

                        Uri[] uris = null;
                        if (result.getResultCode() == Activity.RESULT_OK) {
                            Intent data = result.getData();
                            uris = WebChromeClient.FileChooserParams.parseResult(
                                    result.getResultCode(),
                                    data
                            );
                            if ((uris == null || uris.length == 0) && data != null) {
                                uris = extractUrisFromIntent(data);
                            }
                            if (uris != null) {
                                persistAndCopyUris(data, uris);
                            }
                        }
                        callback.onReceiveValue(uris);
                    }
            );

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        progressBar = findViewById(R.id.progress);
        splash = findViewById(R.id.splash);
        updateInstaller = new UpdateInstaller(this);

        setupWebView();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });

        String startUrl = resolveStartUrl();
        if (getIntent() != null && getIntent().getData() != null) {
            startUrl = getIntent().getData().toString();
        }
        webView.loadUrl(startUrl);
    }

    /**
     * Bez ciasteczka sesji NextAuth od razu otwieramy /login — unikamy zbędnego
     * GET / → 307 → /login w logach Vercel. Z sesją idziemy na /.
     */
    private String resolveStartUrl() {
        String base = AppUpdater.siteBase();
        String withSlash = AppUpdater.siteBaseWithSlash();
        String cookies = CookieManager.getInstance().getCookie(base);
        if (cookies != null
                && (cookies.contains("__Secure-authjs.session-token")
                || cookies.contains("authjs.session-token"))) {
            return withSlash;
        }
        return base + "/login";
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void setupWebView() {
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);
        // Zapis na dysk — bez flush sesja NextAuth często znika po zabiciu aplikacji.
        cookieManager.flush();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        String ua = settings.getUserAgentString()
                + " GymBratAndroidApp/" + BuildConfig.VERSION_NAME
                + " GymBratAndroidCode/" + BuildConfig.VERSION_CODE;
        settings.setUserAgentString(ua);

        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        jsBridge = new GymBratAndroidJsBridge(this, updateInstaller, this::markContentReady);
        webView.addJavascriptInterface(jsBridge, "GymBratAndroid");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request == null || request.getUrl() == null) return false;
                String host = request.getUrl().getHost();
                String siteHost = android.net.Uri.parse(AppUpdater.siteBase()).getHost();
                if (host != null && siteHost != null && host.equalsIgnoreCase(siteHost)) {
                    return false;
                }
                android.content.Intent intent = new android.content.Intent(
                        android.content.Intent.ACTION_VIEW,
                        request.getUrl()
                );
                startActivity(intent);
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                progressBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                CookieManager.getInstance().flush();
                view.postDelayed(() -> {
                    if (!contentReady) markContentReady();
                }, 2500);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                if (request == null) return;
                String[] resources = request.getResources();
                boolean wantsCamera = false;
                if (resources != null) {
                    for (String r : resources) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) {
                            wantsCamera = true;
                            break;
                        }
                    }
                }
                if (!wantsCamera) {
                    request.deny();
                    return;
                }

                runOnUiThread(() -> {
                    if (!hasCameraPermission()) {
                        pendingWebPermissionRequest = request;
                        cameraPermissionLauncher.launch(Manifest.permission.CAMERA);
                        return;
                    }
                    grantCameraToWeb(request);
                });
            }

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams
            ) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent;
                try {
                    intent = fileChooserParams.createIntent();
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }

                if (shouldPreferOpenDocument(fileChooserParams)) {
                    intent = buildOpenDocumentIntent(fileChooserParams);
                }

                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                if (fileChooserParams.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }

                try {
                    // Bez zbędnego createChooser — część launcherów gubi ClipData w wyniku.
                    fileChooserLauncher.launch(intent);
                } catch (ActivityNotFoundException e) {
                    try {
                        fileChooserLauncher.launch(Intent.createChooser(intent, "Wybierz plik"));
                    } catch (ActivityNotFoundException e2) {
                        MainActivity.this.filePathCallback.onReceiveValue(null);
                        MainActivity.this.filePathCallback = null;
                        return false;
                    }
                }
                return true;
            }
        });
    }

    /** Używane przez most JS przed getUserMedia. */
    public boolean hasCameraPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Prośba o CAMERA z JS (przed getUserMedia). Wynik idzie przez
     * {@link GymBratAndroidJsBridge#notifyCameraPermissionResult(boolean)}.
     */
    public void requestCameraPermissionForWeb() {
        runOnUiThread(() -> {
            if (hasCameraPermission()) {
                if (jsBridge != null) jsBridge.notifyCameraPermissionResult(true);
                return;
            }
            pendingJsCameraRequest = true;
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA);
        });
    }

    public WebView getWebView() {
        return webView;
    }

    /** Przyznaj WebView tylko kamerę (nie mikrofon). */
    private static void grantCameraToWeb(PermissionRequest request) {
        String[] resources = request.getResources();
        if (resources == null || resources.length == 0) {
            request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            return;
        }
        java.util.ArrayList<String> granted = new java.util.ArrayList<>();
        for (String r : resources) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) {
                granted.add(r);
            }
        }
        if (granted.isEmpty()) {
            request.deny();
            return;
        }
        request.grant(granted.toArray(new String[0]));
    }

    /**
     * Excel/Word z Pobranych: ACTION_OPEN_DOCUMENT daje trwały odczyt URI.
     * createIntent() WebView często idzie w GET_CONTENT i WebView dostaje pusty File.
     */
    private static boolean shouldPreferOpenDocument(WebChromeClient.FileChooserParams params) {
        String[] types = params.getAcceptTypes();
        if (types == null || types.length == 0) return true;
        for (String raw : types) {
            if (raw == null) continue;
            String t = raw.toLowerCase();
            if (t.contains("spreadsheet")
                    || t.contains("excel")
                    || t.contains("msword")
                    || t.contains("wordprocessing")
                    || t.contains(".xlsx")
                    || t.contains(".xls")
                    || t.contains(".doc")
                    || t.contains(".docx")
                    || t.contains("pdf")
                    || t.contains(".pdf")
                    || t.equals("*/*")
                    || t.equals("application/octet-stream")) {
                return true;
            }
        }
        return false;
    }

    private static Intent buildOpenDocumentIntent(WebChromeClient.FileChooserParams params) {
        Intent open = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        open.addCategory(Intent.CATEGORY_OPENABLE);
        // Bez EXTRA_MIME_TYPES: Samsung/DocumentsUI wyszarzza PDF, gdy HTML
        // podaje „.pdf” / „.doc” zamiast prawdziwych MIME.
        open.setType("*/*");
        return open;
    }

    private void persistAndCopyUris(@Nullable Intent data, Uri[] uris) {
        int flags = Intent.FLAG_GRANT_READ_URI_PERMISSION;
        if (data != null) {
            flags |= data.getFlags();
        }
        for (int i = 0; i < uris.length; i++) {
            Uri uri = uris[i];
            if (uri == null) continue;
            try {
                getContentResolver().takePersistableUriPermission(
                        uri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION
                );
            } catch (Exception ignored) {
                /* GET_CONTENT nie wspiera persistable */
            }
            try {
                grantUriPermission(
                        getPackageName(),
                        uri,
                        flags | Intent.FLAG_GRANT_READ_URI_PERMISSION
                );
            } catch (Exception ignored) {
                /* niektóre URI nie przyjmują grantUriPermission */
            }
            Uri cached = copyUriToCache(uri);
            if (cached != null) {
                uris[i] = cached;
            }
        }
    }

    /** Kopia do cache — WebView wtedy czyta prawdziwe bajty, nie pusty content://. */
    @Nullable
    private Uri copyUriToCache(Uri src) {
        String name = queryDisplayName(src);
        File dir = new File(getCacheDir(), "uploads");
        if (!dir.exists() && !dir.mkdirs()) return null;
        File dest = new File(dir, System.currentTimeMillis() + "-" + sanitizeFileName(name));
        try (InputStream in = getContentResolver().openInputStream(src);
             OutputStream out = new FileOutputStream(dest)) {
            if (in == null) return null;
            byte[] buf = new byte[16 * 1024];
            int n;
            long total = 0;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
                total += n;
            }
            if (total <= 0) return null;
        } catch (Exception e) {
            return null;
        }
        return Uri.fromFile(dest);
    }

    private String queryDisplayName(Uri uri) {
        try (Cursor c = getContentResolver().query(
                uri,
                new String[]{OpenableColumns.DISPLAY_NAME},
                null,
                null,
                null
        )) {
            if (c != null && c.moveToFirst()) {
                String n = c.getString(0);
                if (n != null && !n.trim().isEmpty()) return n.trim();
            }
        } catch (Exception ignored) {
            /* fallback poniżej */
        }
        String last = uri.getLastPathSegment();
        return last != null && !last.isEmpty() ? last : "plik.bin";
    }

    private static String sanitizeFileName(String name) {
        String cleaned = name.replaceAll("[^a-zA-Z0-9._\\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]", "_");
        if (cleaned.length() > 80) cleaned = cleaned.substring(cleaned.length() - 80);
        return cleaned.isEmpty() ? "plik.bin" : cleaned;
    }

    /** Fallback, gdy parseResult zwróci null (częste na OEM galeriach). */
    private static Uri[] extractUrisFromIntent(Intent data) {
        ClipData clip = data.getClipData();
        if (clip != null && clip.getItemCount() > 0) {
            Uri[] uris = new Uri[clip.getItemCount()];
            for (int i = 0; i < clip.getItemCount(); i++) {
                uris[i] = clip.getItemAt(i).getUri();
            }
            return uris;
        }
        if (data.getData() != null) {
            return new Uri[]{data.getData()};
        }
        return null;
    }

    private void markContentReady() {
        if (contentReady) return;
        contentReady = true;
        if (splash != null) {
            splash.animate()
                    .alpha(0f)
                    .setDuration(280)
                    .withEndAction(() -> splash.setVisibility(View.GONE))
                    .start();
        }
    }

    @Override
    protected void onPause() {
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        // Nie kasuj callbacka przy rotacji / odtworzeniu pod galerią — tylko przy prawdziwym zamknięciu.
        if (isFinishing() && filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
            filePathCallback = null;
        }
        CookieManager.getInstance().flush();
        if (updateInstaller != null) {
            updateInstaller.shutdown();
        }
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
