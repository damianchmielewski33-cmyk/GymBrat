package pl.gymbrat.app;

import android.app.Application;

import pl.gymbrat.app.reminders.ReminderScheduler;

public final class GymBratApp extends Application {
    private static GymBratApp instance;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        // Alarmy znikają po śmierci procesu — odtwarzamy je zanim WebView się załaduje.
        ReminderScheduler.scheduleAll(this);
    }

    public static GymBratApp get() {
        return instance;
    }
}
