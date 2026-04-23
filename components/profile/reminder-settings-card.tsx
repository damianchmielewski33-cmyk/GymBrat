"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRemindersPrefsAction } from "@/actions/reminders";
import type { RemindersPrefs } from "@/lib/reminders-types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Bell, Mail } from "lucide-react";

const DAYS: { bit: number; label: string }[] = [
  { bit: 1, label: "Pon" },
  { bit: 2, label: "Wt" },
  { bit: 3, label: "Śr" },
  { bit: 4, label: "Czw" },
  { bit: 5, label: "Pt" },
  { bit: 6, label: "Sob" },
  { bit: 0, label: "Nd" },
];

export function ReminderSettingsCard({ initial }: { initial: RemindersPrefs }) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [pending, start] = useTransition();
  const [workoutTime, setWorkoutTime] = useState(initial.workoutTime ?? "");
  const [mealTime, setMealTime] = useState(initial.mealTime ?? "");
  const [checkinTime, setCheckinTime] = useState(initial.checkinTime ?? "");
  const [emailDailyBrief, setEmailDailyBrief] = useState(
    Boolean(initial.emailDailyBrief),
  );
  const [days, setDays] = useState<number[]>(() => initial.daysOfWeek ?? []);

  const payload = useMemo((): RemindersPrefs => {
    const p: RemindersPrefs = {};
    if (/^\d{2}:\d{2}$/.test(workoutTime)) p.workoutTime = workoutTime;
    if (/^\d{2}:\d{2}$/.test(mealTime)) p.mealTime = mealTime;
    if (/^\d{2}:\d{2}$/.test(checkinTime)) p.checkinTime = checkinTime;
    if (days.length) p.daysOfWeek = days;
    if (emailDailyBrief) p.emailDailyBrief = true;
    return p;
  }, [workoutTime, mealTime, checkinTime, days, emailDailyBrief]);

  async function requestNotifPermission() {
    if (typeof Notification === "undefined") {
      notifyError("Ta przeglądarka nie obsługuje powiadomień.");
      return;
    }
    const r = await Notification.requestPermission();
    if (r === "granted") notifySaved("Powiadomienia włączone.");
    else notifyError("Brak zgody na powiadomienia.");
  }

  return (
    <section className="glass-panel relative overflow-hidden p-8">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(700px_280px_at_80%_0%,rgba(255,45,85,0.12),transparent_55%)]" />
      <div className="relative space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
              Nawyki
            </p>
            <h2 className="font-heading mt-2 text-xl font-semibold">
              Przypomnienia (PWA)
            </h2>
            <p className="mt-2 text-sm text-white/60">
              Godziny w strefie kalendarza ({`Europe/Warsaw`} domyślnie). Działa, gdy karta lub
              PWA jest uruchomiona i masz zgodę na powiadomienia.
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--neon)]/35 bg-[var(--neon)]/10">
            <Bell className="h-5 w-5 text-[var(--neon)]" />
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-10 border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]"
          onClick={() => void requestNotifPermission()}
        >
          Poproś o dostęp do powiadomień
        </Button>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-white/70">Trening</Label>
            <input
              type="time"
              value={workoutTime}
              onChange={(e) => setWorkoutTime(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">Posiłek</Label>
            <input
              type="time"
              value={mealTime}
              onChange={(e) => setMealTime(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">Check-in</Label>
            <input
              type="time"
              value={checkinTime}
              onChange={(e) => setCheckinTime(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 text-white"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-white/70">Dni (puste = codziennie)</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map(({ bit, label }) => {
              const on = days.includes(bit);
              return (
                <button
                  key={bit}
                  type="button"
                  onClick={() =>
                    setDays((prev) =>
                      on ? prev.filter((x) => x !== bit) : [...prev, bit].sort(),
                    )
                  }
                  className={`h-9 min-w-[2.75rem] rounded-full px-3 text-xs font-semibold transition ${
                    on
                      ? "bg-[var(--neon)]/90 text-white"
                      : "border border-white/15 bg-white/[0.04] text-white/55"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <input
            type="checkbox"
            checked={emailDailyBrief}
            onChange={(e) => setEmailDailyBrief(e.target.checked)}
            className="h-4 w-4 accent-[var(--neon)]"
          />
          <Mail className="h-5 w-5 shrink-0 text-white/45" aria-hidden />
          <span className="text-sm text-white/75">
            Dzienny skrót e-mail (cron serwera — wymaga SMTP i CRON_SECRET)
          </span>
        </label>

        <Button
          type="button"
          disabled={pending}
          className="h-11 bg-[var(--neon)] text-white hover:bg-[#ff4d6d]"
          onClick={() => {
            start(async () => {
              const r = await saveRemindersPrefsAction(payload);
              if (r.ok) {
                notifySaved("Zapisano przypomnienia.");
                router.refresh();
              } else notifyError(r.error ?? "Nie udało się zapisać.");
            });
          }}
        >
          Zapisz przypomnienia
        </Button>
      </div>
    </section>
  );
}
