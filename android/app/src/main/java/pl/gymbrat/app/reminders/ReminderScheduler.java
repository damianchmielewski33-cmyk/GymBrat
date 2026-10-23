package pl.gymbrat.app.reminders;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;

/**
 * Lokalne przypomnienia (trening / posiłek / check-in) planowane przez AlarmManager —
 * działają przy zamkniętej aplikacji i po restarcie telefonu (BootReceiver).
 *
 * Ustawienia przychodzą z WebView jako JSON jak w {@code lib/reminders-types.ts}:
 * {@code {"workoutTime":"18:00","mealTime":"13:00","checkinTime":"21:00","daysOfWeek":[1,2,3]}}
 * (dni jak Date.getDay(): 0 = niedziela). Godziny to czas lokalny telefonu.
 */
public final class ReminderScheduler {
    private static final String PREFS = "gymbrat_reminders";
    private static final String KEY_JSON = "json";

    static final String ACTION_REMINDER = "pl.gymbrat.app.REMINDER";
    static final String EXTRA_KIND = "kind";
    static final String EXTRA_AT = "at";

    static final String[] KINDS = {"workout", "meal", "checkin"};
    private static final String[] TIME_KEYS = {"workoutTime", "mealTime", "checkinTime"};

    private ReminderScheduler() {}

    /** Zapisuje ustawienia i przelicza alarmy. Pusty obiekt kasuje wszystkie. */
    public static boolean save(Context context, String json) {
        JSONObject parsed;
        try {
            parsed = new JSONObject(json == null || json.trim().isEmpty() ? "{}" : json);
        } catch (JSONException e) {
            return false;
        }
        prefs(context).edit().putString(KEY_JSON, parsed.toString()).apply();
        scheduleAll(context);
        return true;
    }

    /** Planuje (lub kasuje) najbliższy alarm dla każdego rodzaju przypomnienia. */
    public static void scheduleAll(Context context) {
        Context app = context.getApplicationContext();
        AlarmManager alarms = app.getSystemService(AlarmManager.class);
        if (alarms == null) return;

        JSONObject prefs = readPrefs(app);
        long now = System.currentTimeMillis();

        for (int i = 0; i < KINDS.length; i++) {
            long triggerAt = nextTrigger(prefs, TIME_KEYS[i], now);
            PendingIntent pi = pendingIntent(app, i, KINDS[i], triggerAt);
            if (triggerAt < 0) {
                alarms.cancel(pi);
                continue;
            }
            setAlarm(alarms, triggerAt, pi);
        }
    }

    private static void setAlarm(AlarmManager alarms, long triggerAt, PendingIntent pi) {
        try {
            boolean exactAllowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.S
                    || alarms.canScheduleExactAlarms();
            if (exactAllowed) {
                alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
            } else {
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
            }
        } catch (SecurityException e) {
            // Brak zgody na dokładne alarmy — nieprecyzyjny, ale nadal budzi w Doze.
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
        }
    }

    private static PendingIntent pendingIntent(Context app, int requestCode, String kind, long at) {
        Intent intent = new Intent(app, ReminderReceiver.class);
        intent.setAction(ACTION_REMINDER);
        intent.putExtra(EXTRA_KIND, kind);
        intent.putExtra(EXTRA_AT, at);
        return PendingIntent.getBroadcast(
                app,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    /** Najbliższy moment (ms) po {@code now} zgodny z godziną i dniami; -1 gdy brak. */
    static long nextTrigger(JSONObject prefs, String timeKey, long now) {
        String hm = prefs.optString(timeKey, "");
        int[] parsed = parseHm(hm);
        if (parsed == null) return -1L;

        boolean[] allowed = allowedDays(prefs.optJSONArray("daysOfWeek"));
        for (int offset = 0; offset <= 7; offset++) {
            Calendar cand = Calendar.getInstance();
            cand.setTimeInMillis(now);
            cand.add(Calendar.DAY_OF_YEAR, offset);
            cand.set(Calendar.HOUR_OF_DAY, parsed[0]);
            cand.set(Calendar.MINUTE, parsed[1]);
            cand.set(Calendar.SECOND, 0);
            cand.set(Calendar.MILLISECOND, 0);
            int weekday = cand.get(Calendar.DAY_OF_WEEK) - 1; // Calendar.SUNDAY = 1 -> 0
            if (cand.getTimeInMillis() > now + 1000L && allowed[weekday]) {
                return cand.getTimeInMillis();
            }
        }
        return -1L;
    }

    /** Puste / brak tablicy = każdy dzień. */
    private static boolean[] allowedDays(JSONArray days) {
        boolean[] allowed = new boolean[7];
        if (days == null || days.length() == 0) {
            java.util.Arrays.fill(allowed, true);
            return allowed;
        }
        for (int i = 0; i < days.length(); i++) {
            int d = days.optInt(i, -1);
            if (d >= 0 && d <= 6) allowed[d] = true;
        }
        return allowed;
    }

    private static int[] parseHm(String hm) {
        if (hm == null || hm.length() != 5 || hm.charAt(2) != ':') return null;
        try {
            int h = Integer.parseInt(hm.substring(0, 2));
            int m = Integer.parseInt(hm.substring(3, 5));
            if (h < 0 || h > 23 || m < 0 || m > 59) return null;
            return new int[]{h, m};
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static JSONObject readPrefs(Context app) {
        try {
            return new JSONObject(prefs(app).getString(KEY_JSON, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
