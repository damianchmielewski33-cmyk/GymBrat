# GymBrat WebView shell — keep JS bridge names.
-keepclassmembers class pl.gymbrat.app.bridge.GymBratAndroidJsBridge {
    @android.webkit.JavascriptInterface <methods>;
}
