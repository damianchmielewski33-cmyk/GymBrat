# GymBrat WebView shell — keep JS bridge names.
-keepclassmembers class pl.gymbrat.app.bridge.GymBratAndroidJsBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# Updater/OkHttp/org.json używane refleksyjnie nie są — domyślne reguły AGP wystarczą.
# AdMob i UMP dostarczają własne consumer-rules.
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
