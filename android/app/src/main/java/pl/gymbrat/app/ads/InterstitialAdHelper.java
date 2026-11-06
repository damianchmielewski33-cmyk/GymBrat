package pl.gymbrat.app.ads;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.ads.mediation.admob.AdMobAdapter;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;

import pl.gymbrat.app.BuildConfig;

/**
 * Natywny interstitial AdMob — po UMP + zgodzie marketingowej z WebView (CMP).
 */
public final class InterstitialAdHelper {
    private final Activity activity;
    private final WebView webView;
    private boolean sdkReady;
    private boolean umpAllowsAds;
    private boolean marketingConsent;
    @Nullable
    private InterstitialAd loaded;

    public InterstitialAdHelper(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    public boolean isConfigured() {
        String unit = BuildConfig.ADMOB_INTERSTITIAL_UNIT_ID;
        return unit != null && !unit.trim().isEmpty();
    }

    /** Wynik Google UMP — czy wolno prosić o reklamy. */
    public void onUmpReady(boolean canRequestAds) {
        umpAllowsAds = canRequestAds;
        if (canRequestAds) {
            ensureSdkInitialized();
        }
    }

    /**
     * Zgoda z banneru cookies (kategoria marketing) = zgoda na PERSONALIZACJĘ reklam.
     * Reklamy są obowiązkowe w wersji bezpłatnej (regulamin); bez zgody ładujemy
     * reklamy niespersonalizowane (npa=1). Zmiana zgody unieważnia załadowaną reklamę.
     */
    public void setMarketingConsent(boolean allowed) {
        boolean changed = marketingConsent != allowed;
        marketingConsent = allowed;
        if (changed) loaded = null;
        if (umpAllowsAds) {
            ensureSdkInitialized();
            preload();
        }
    }

    public boolean hasMarketingConsent() {
        return marketingConsent;
    }

    public boolean canShowAds() {
        return isConfigured() && umpAllowsAds && sdkReady;
    }

    public void show(@Nullable String placement) {
        Handler main = new Handler(Looper.getMainLooper());
        main.post(() -> {
            if (!canShowAds() || loaded == null) {
                notifyJs(false);
                if (canShowAds()) preload();
                return;
            }
            InterstitialAd ad = loaded;
            loaded = null;
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    notifyJs(true);
                    preload();
                }

                @Override
                public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                    notifyJs(false);
                    preload();
                }
            });
            ad.show(activity);
        });
    }

    private void ensureSdkInitialized() {
        if (!isConfigured() || sdkReady || !umpAllowsAds) return;
        MobileAds.initialize(activity, status -> {
            sdkReady = true;
            preload();
        });
    }

    private void preload() {
        if (!canShowAds()) return;
        String unit = BuildConfig.ADMOB_INTERSTITIAL_UNIT_ID.trim();
        AdRequest.Builder builder = new AdRequest.Builder();
        if (!marketingConsent) {
            Bundle extras = new Bundle();
            extras.putString("npa", "1"); // reklamy niespersonalizowane
            builder.addNetworkExtrasBundle(AdMobAdapter.class, extras);
        }
        AdRequest request = builder.build();
        InterstitialAd.load(activity, unit, request, new InterstitialAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull InterstitialAd interstitialAd) {
                loaded = interstitialAd;
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                loaded = null;
            }
        });
    }

    private void notifyJs(boolean ok) {
        Handler main = new Handler(Looper.getMainLooper());
        main.post(() -> webView.evaluateJavascript(
                "try{if(typeof window.__gymbratOnInterstitial==='function'){window.__gymbratOnInterstitial("
                        + (ok ? "true" : "false")
                        + ");}}catch(e){}",
                null
        ));
    }
}
