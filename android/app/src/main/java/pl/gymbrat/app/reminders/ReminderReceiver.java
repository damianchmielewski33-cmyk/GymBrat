package pl.gymbrat.app.reminders;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import pl.gymbrat.app.MainActivity;
import pl.gymbrat.app.R;
import pl.gymbrat.app.update.AppUpdater;

/** Odpala się o zaplanowanej godzinie: pokazuje powiadomienie i planuje kolejne. */
public final class ReminderReceiver extends BroadcastReceiver {
    private static final String CHANNEL_ID = "gymbrat_reminders";
    /** Telefon był wyłączony / w głębokim uśpieniu — starsze niż to przypomnienie pomijamy. */
    private static final long MAX_LATE_MS = 2L * 60L * 60L * 1000L;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ReminderScheduler.ACTION_REMINDER.equals(intent.getAction())) {
            return;
        }
        PendingResult pending = goAsync();
        try {
            String kind = intent.getStringExtra(ReminderScheduler.EXTRA_KIND);
            long at = intent.getLongExtra(ReminderScheduler.EXTRA_AT, 0L);
            boolean stale = at > 0L && System.currentTimeMillis() - at > MAX_LATE_MS;
            if (kind != null && !stale) {
                show(context, kind);
            }
            // Następny termin (jutro lub kolejny dozwolony dzień).
            ReminderScheduler.scheduleAll(context);
        } finally {
            pending.finish();
        }
    }

    private static void show(Context context, String kind) {
        String title;
        String body;
        String path;
        int id;
        switch (kind) {
            case "workout":
                title = "GymBrat — trening";
                body = "Czas na sesję. Otwórz plan lub start treningu.";
                path = "/workout-plan";
                id = 1001;
                break;
            case "meal":
                title = "GymBrat — posiłek";
                body = "Zaloguj makro lub dodaj posiłek na Start.";
                path = "/meal-suggestions";
                id = 1002;
                break;
            case "checkin":
                title = "GymBrat — check-in";
                body = "Krótki check-in dnia na stronie Start.";
                path = "/";
                id = 1003;
                break;
            default:
                return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        ensureChannel(context);

        Intent open = new Intent(context, MainActivity.class);
        open.setData(Uri.parse(AppUpdater.siteBase() + path));
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(
                context,
                id,
                open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_splash_dumbbell)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(content);

        try {
            NotificationManagerCompat.from(context).notify(id, builder.build());
        } catch (SecurityException ignored) {
            // Zgoda cofnięta między sprawdzeniem a wysłaniem.
        }
    }

    private static void ensureChannel(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Przypomnienia GymBrat",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Trening, posiłki i check-in o wybranych porach");
        channel.enableVibration(true);
        manager.createNotificationChannel(channel);
    }
}
