"use client";

import { useEffect, useState, useTransition } from "react";
import { saveRemindersPrefsAction } from "@/actions/reminders";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { ProfileBlock, ProfileSwitch } from "@/components/profile/profile-ui";
import { Button } from "@/components/ui/button";
import {
  androidCanScheduleExactAlarms,
  ensureAndroidNotificationPermission,
  hasAndroidNativeReminders,
  isInstalledAndroidAppClient,
  openAndroidAppSettings,
  openAndroidExactAlarmSettings,
  syncAndroidReminders,
} from "@/lib/app-webview";
import {
  disableWebPush,
  enableWebPush,
  hasActivePushSubscription,
  isWebPushSupported,
} from "@/lib/push-client";
import { REMINDERS_CHANGED_EVENT, type RemindersPrefs } from "@/lib/reminders-types";
import { cn } from "@/lib/utils";

type TimeKey = "workoutTime" | "mealTime" | "checkinTime";

const TIME_ROWS: {
  key: TimeKey;
  label: string;
  description: string;
  fallback: string;
}[] = [
  {
    key: "workoutTime",
    label: "Trening",
    description: "Przypomnienie o sesji treningowej.",
    fallback: "18:00",
  },
  {
    key: "mealTime",
    label: "Posiłek",
    description: "Przypomnienie o zalogowaniu makro.",
    fallback: "13:00",
  },
  {
    key: "checkinTime",
    label: "Check-in dnia",
    description: "Krótkie podsumowanie dnia na Start.",
    fallback: "21:00",
  },
];

/** Kolejność od poniedziałku; wartość jak Date.getDay() (niedziela = 0). */
const WEEKDAYS = [
  { value: 1, label: "Pn" },
  { value: 2, label: "Wt" },
  { value: 3, label: "Śr" },
  { value: 4, label: "Cz" },
  { value: 5, label: "Pt" },
  { value: 6, label: "Sb" },
  { value: 0, label: "Nd" },
] as const;

/**
 * Jak ta instalacja dostarcza powiadomienia przy zamkniętej aplikacji:
 * - android: natywne alarmy w APK,
 * - android-outdated: APK bez obsługi alarmów (trzeba zaktualizować),
 * - push: Web Push z serwera,
 * - push-off: przeglądarka umie push, ale serwer nie ma kluczy VAPID,
 * - none: brak wsparcia (np. iPhone w zwykłej karcie Safari).
 */
type Channel = "checking" | "android" | "android-outdated" | "push" | "push-off" | "none";

function detectChannel(vapidPublicKey: string | null): Channel {
  if (hasAndroidNativeReminders()) return "android";
  if (isInstalledAndroidAppClient()) return "android-outdated";
  if (isWebPushSupported()) return vapidPublicKey ? "push" : "push-off";
  return "none";
}

function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export function RemindersCard({
  initial,
  vapidPublicKey,
}: {
  initial: RemindersPrefs;
  vapidPublicKey: string | null;
}) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [pending, start] = useTransition();
  const [times, setTimes] = useState<Record<TimeKey, string>>({
    workoutTime: initial.workoutTime ?? "",
    mealTime: initial.mealTime ?? "",
    checkinTime: initial.checkinTime ?? "",
  });
  const [days, setDays] = useState<number[]>(initial.daysOfWeek ?? []);
  const [email, setEmail] = useState(Boolean(initial.emailDailyBrief));
  const [channel, setChannel] = useState<Channel>("checking");
  const [deviceReady, setDeviceReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [exactOk, setExactOk] = useState(true);

  useEffect(() => {
    const ch = detectChannel(vapidPublicKey);
    setChannel(ch);
    if (ch === "android") {
      setExactOk(androidCanScheduleExactAlarms());
    } else if (ch === "push") {
      void hasActivePushSubscription().then(setDeviceReady);
      setBlocked(typeof Notification !== "undefined" && Notification.permission === "denied");
    }
  }, [vapidPublicKey]);

  const anyTime = Object.values(times).some(Boolean);

  function toggleDay(value: number) {
    setDays((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  }

  function save() {
    start(async () => {
      const prefs: RemindersPrefs = {
        ...(times.workoutTime ? { workoutTime: times.workoutTime } : {}),
        ...(times.mealTime ? { mealTime: times.mealTime } : {}),
        ...(times.checkinTime ? { checkinTime: times.checkinTime } : {}),
        ...(days.length > 0 && days.length < 7 ? { daysOfWeek: days } : {}),
        ...(email ? { emailDailyBrief: true } : {}),
        ...(browserTimeZone() ? { timezone: browserTimeZone() } : {}),
      };
      const r = await saveRemindersPrefsAction(prefs);
      if (!r.ok) {
        notifyError(r.error || "Nie udało się zapisać przypomnień.");
        return;
      }

      // Kanał dostarczania na tym urządzeniu (przy zamkniętej aplikacji).
      let warning: string | null = null;
      if (channel === "android") {
        if (anyTime && !(await ensureAndroidNotificationPermission())) {
          warning =
            "Zapisano, ale Android blokuje powiadomienia GymBrat — włącz je w ustawieniach aplikacji.";
          setBlocked(true);
        } else {
          setBlocked(false);
        }
        syncAndroidReminders(prefs);
        setDeviceReady(anyTime);
        const exact = androidCanScheduleExactAlarms();
        setExactOk(exact);
        if (anyTime && !exact) {
          warning =
            warning ??
            "Zapisano, ale Android blokuje dokładne alarmy — bez tej zgody przypomnienie może przyjść z opóźnieniem przy zamkniętej aplikacji.";
        }
      } else if (channel === "push" && vapidPublicKey) {
        if (anyTime) {
          const res = await enableWebPush(vapidPublicKey);
          setDeviceReady(res.ok);
          setBlocked(!res.ok && res.reason === "denied");
          if (!res.ok) warning = `Zapisano, ale ${res.message}`;
        } else {
          await disableWebPush();
          setDeviceReady(false);
        }
      }

      window.dispatchEvent(new Event(REMINDERS_CHANGED_EVENT));
      if (warning) notifyError(warning);
      else notifySaved("Zapisano przypomnienia.");
    });
  }

  return (
    <div className="space-y-5">
      <ProfileBlock title="Powiadomienia na tym urządzeniu" description={describe(channel)}>
        <div className="space-y-2">
          {TIME_ROWS.map((row) => {
            const on = Boolean(times[row.key]);
            return (
              <div
                key={row.key}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                  on
                    ? "border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/[0.06]"
                    : "border-white/10 bg-black/25",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white/90">{row.label}</p>
                  <p className="mt-0.5 text-xs leading-snug text-white/45">{row.description}</p>
                </div>
                {on ? (
                  <input
                    type="time"
                    aria-label={`Godzina: ${row.label}`}
                    value={times[row.key]}
                    onChange={(e) => setTimes((p) => ({ ...p, [row.key]: e.target.value }))}
                    className="h-10 rounded-lg border border-white/20 bg-black/50 px-2.5 text-sm tabular-nums text-white outline-none focus-visible:border-[var(--gym-gold)]/55 focus-visible:ring-[3px] focus-visible:ring-ring/80"
                  />
                ) : null}
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${row.label}: ${on ? "wyłącz" : "włącz"}`}
                  onClick={() =>
                    setTimes((p) => ({ ...p, [row.key]: on ? "" : row.fallback }))
                  }
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50",
                    on
                      ? "border-[var(--gym-gold)]/60 bg-[var(--gym-gold)]/40"
                      : "border-white/15 bg-white/10",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left]",
                      on ? "left-[1.375rem]" : "left-0.5",
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>

        {anyTime ? (
          <div className="mt-4 space-y-2">
            <p className="text-[13px] font-medium text-white/75">
              Dni tygodnia{" "}
              <span className="font-normal text-white/40">— bez wyboru: codziennie</span>
            </p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dni tygodnia">
              {WEEKDAYS.map((d) => {
                const active = days.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleDay(d.value)}
                    className={cn(
                      "h-10 min-w-10 rounded-full border px-3 text-[13px] font-semibold transition-colors",
                      active
                        ? "border-[var(--gym-gold)]/60 bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]"
                        : "border-white/10 bg-white/[0.04] text-white/55 hover:text-white/85",
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <ChannelStatus
          channel={channel}
          anyTime={anyTime}
          deviceReady={deviceReady}
          blocked={blocked}
          exactOk={exactOk}
        />
      </ProfileBlock>

      <ProfileSwitch
        checked={email}
        onChange={setEmail}
        label="Dzienny skrót e-mail"
        description="Wiadomość z przypomnieniem o treningu i makro rano (po 7:00) — niezależnie od urządzenia."
      />

      <Button
        type="button"
        variant="cta"
        disabled={pending}
        className="w-full"
        onClick={save}
      >
        {pending ? "Zapisywanie…" : "Zapisz przypomnienia"}
      </Button>
    </div>
  );
}

function describe(channel: Channel): string {
  switch (channel) {
    case "android":
      return "Aplikacja ustawia alarmy w telefonie — powiadomienia przychodzą też przy zamkniętej aplikacji.";
    case "push":
      return "Powiadomienia push wysyła serwer — przychodzą też przy zamkniętej karcie lub aplikacji.";
    default:
      return "Wybierz godziny i dni, w które GymBrat ma Ci przypominać.";
  }
}

function ChannelStatus({
  channel,
  anyTime,
  deviceReady,
  blocked,
  exactOk,
}: {
  channel: Channel;
  anyTime: boolean;
  deviceReady: boolean;
  blocked: boolean;
  exactOk: boolean;
}) {
  if (channel === "checking" || !anyTime) return null;

  let tone: "ok" | "warn" = "warn";
  let text: React.ReactNode = null;

  if (channel === "android") {
    if (blocked) {
      text = (
        <>
          Android blokuje powiadomienia GymBrat. Włącz je w ustawieniach aplikacji, żeby
          przypomnienia mogły się pojawiać przy zamkniętej aplikacji.
        </>
      );
    } else if (!exactOk) {
      text =
        "Włącz dokładne alarmy dla GymBrat (Alarms & reminders). Bez tego system może opóźnić powiadomienie, gdy aplikacja jest zamknięta.";
    } else if (deviceReady) {
      tone = "ok";
      text = "Alarmy są ustawione w telefonie — przypomnienia przychodzą też przy zamkniętej aplikacji.";
    } else {
      text = "Po zapisaniu aplikacja poprosi o zgodę na powiadomienia i ustawi alarmy w telefonie.";
    }
  } else if (channel === "android-outdated") {
    text =
      "Ta wersja aplikacji Android nie potrafi ustawiać alarmów. Zaktualizuj GymBrat (sekcja Aplikacja poniżej), aby dostawać przypomnienia przy zamkniętej aplikacji.";
  } else if (channel === "push") {
    if (blocked) {
      text =
        "Powiadomienia są zablokowane w ustawieniach przeglądarki dla tej strony. Odblokuj je i zapisz ponownie.";
    } else if (deviceReady) {
      tone = "ok";
      text = "Push jest włączony na tym urządzeniu — przypomnienia przyjdą także przy zamkniętej karcie.";
    } else {
      text = "Po zapisaniu przeglądarka poprosi o zgodę na powiadomienia.";
    }
  } else if (channel === "push-off") {
    text =
      "Powiadomienia push nie są jeszcze skonfigurowane na serwerze (klucze VAPID). Do tego czasu użyj skrótu e-mail poniżej.";
  } else {
    text =
      "Ta przeglądarka nie obsługuje powiadomień push. Na iPhonie dodaj GymBrat do ekranu początkowego, albo użyj aplikacji Android lub skrótu e-mail.";
  }

  return (
    <div
      className={cn(
        "mt-4 flex flex-col gap-2.5 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        tone === "ok"
          ? "border-emerald-300/25 bg-emerald-300/[0.07]"
          : "border-amber-300/25 bg-amber-300/[0.07]",
      )}
    >
      <p
        className={cn(
          "text-[13px] leading-snug",
          tone === "ok" ? "text-emerald-100/90" : "text-amber-100/85",
        )}
      >
        {text}
      </p>
      {channel === "android" && (blocked || !exactOk) ? (
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          onClick={() =>
            blocked ? openAndroidAppSettings() : openAndroidExactAlarmSettings()
          }
        >
          Otwórz ustawienia
        </Button>
      ) : null}
    </div>
  );
}
