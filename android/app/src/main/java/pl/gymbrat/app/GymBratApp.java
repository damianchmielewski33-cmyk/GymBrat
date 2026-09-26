package pl.gymbrat.app;

import android.app.Application;

public final class GymBratApp extends Application {
    private static GymBratApp instance;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
    }

    public static GymBratApp get() {
        return instance;
    }
}
