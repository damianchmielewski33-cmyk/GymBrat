package pl.gymbrat.app;

import android.annotation.SuppressLint;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

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
    private boolean contentReady;

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
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        String ua = settings.getUserAgentString()
                + " GymBratAndroidApp/" + BuildConfig.VERSION_NAME
                + " GymBratAndroidCode/" + BuildConfig.VERSION_CODE;
        settings.setUserAgentString(ua);

        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.addJavascriptInterface(
                new GymBratAndroidJsBridge(this, updateInstaller, this::markContentReady),
                "GymBratAndroid"
        );

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
        });
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
