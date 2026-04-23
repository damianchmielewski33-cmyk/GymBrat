"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Lock, Moon, Smile, Zap } from "lucide-react";
import type { DailyCheckinDto } from "@/lib/daily-checkin";
import { closeDayAction, upsertDailyCheckinAction } from "@/actions/daily-checkin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/home/submit-button";
import { useSaveFeedback } from "@/components/feedback/save-feedback";

type FormState = { ok?: boolean; error?: string };

function ScoreSelect({
  name,
  label,
  icon,
  value,
  onChange,
}: {
  name: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
}) {
  const options = ["", ...Array.from({ length: 10 }, (_, i) => String(i + 1))];
  return (
    <label className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-black/25 text-[var(--neon)]">
          {icon}
        </span>
        {label}
      </span>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3.5 text-[15px] text-white shadow-inner shadow-black/20 outline-none transition focus-visible:border-[var(--neon)]/40 focus-visible:ring-2 focus-visible:ring-[var(--neon)]/25"
      >
        {options.map((o) => (
          <option key={o || "empty"} value={o} className="bg-zinc-950">
            {o ? `${o}/10` : "—"}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DailyCheckinPanel({
  dateKey,
  existing,
}: {
  dateKey: string;
  existing: DailyCheckinDto | null;
}) {
  const { notifySaved } = useSaveFeedback();
  const [saveState, saveAction] = useActionState(upsertDailyCheckinAction, {} as FormState);
  const [closeState, closeAction] = useActionState(closeDayAction, {} as FormState);

  const initial = useMemo(
    () => ({
      sleepQuality: existing?.sleepQuality != null ? String(existing.sleepQuality) : "",
      dayEnergy: existing?.dayEnergy != null ? String(existing.dayEnergy) : "",
      stress: existing?.stress != null ? String(existing.stress) : "",
      weightKg: existing?.weightKg != null ? String(existing.weightKg) : "",
      notes: existing?.notes ?? "",
    }),
    [existing],
  );

  const [sleepQuality, setSleepQuality] = useState(initial.sleepQuality);
  const [dayEnergy, setDayEnergy] = useState(initial.dayEnergy);
  const [stress, setStress] = useState(initial.stress);
  const [weightKg, setWeightKg] = useState(initial.weightKg);
  const [notes, setNotes] = useState(initial.notes);

  useEffect(() => {
    setSleepQuality(initial.sleepQuality);
    setDayEnergy(initial.dayEnergy);
    setStress(initial.stress);
    setWeightKg(initial.weightKg);
    setNotes(initial.notes);
  }, [initial]);

  useEffect(() => {
    if (saveState?.ok) notifySaved("Check-in zapisany.");
  }, [saveState, notifySaved]);

  useEffect(() => {
    if (closeState?.ok) notifySaved("Dzień zamknięty.");
  }, [closeState, notifySaved]);

  const closed = existing?.dayClosedAtMs != null;
  const inputClass =
    "h-11 rounded-xl border-white/12 bg-white/[0.06] px-3.5 text-[15px] text-white shadow-inner shadow-black/20 outline-none transition placeholder:text-white/25 focus-visible:border-[var(--neon)]/40 focus-visible:ring-2 focus-visible:ring-[var(--neon)]/25";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Codzienny check-in</p>
            <p className="mt-1 text-xs text-white/55">
              Dzień <span className="font-mono text-white/75">{dateKey}</span>. Wypełnij w 30–60 sekund.
            </p>
          </div>
        </div>
      </div>

      <form action={saveAction} className="space-y-4">
        <input type="hidden" name="date" value={dateKey} />
        <div className="grid gap-3 sm:grid-cols-3">
          <ScoreSelect
            name="sleepQuality"
            label="Sen"
            icon={<Moon className="h-4 w-4" />}
            value={sleepQuality}
            onChange={setSleepQuality}
          />
          <ScoreSelect
            name="dayEnergy"
            label="Energia"
            icon={<Zap className="h-4 w-4" />}
            value={dayEnergy}
            onChange={setDayEnergy}
          />
          <ScoreSelect
            name="stress"
            label="Stres"
            icon={<Smile className="h-4 w-4" />}
            value={stress}
            onChange={setStress}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
              Waga (kg) — opcjonalnie
            </label>
            <Input
              name="weightKg"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              inputMode="decimal"
              placeholder="np. 82.4"
              className={inputClass}
            />
          </div>
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
              Notatka (opcjonalnie)
            </label>
            <Textarea
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="np. mało snu, ciężki dzień, jutro cardio…"
              className="min-h-20 rounded-xl border-white/12 bg-white/[0.06] text-white placeholder:text-white/25"
            />
          </div>
        </div>

        {saveState?.error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200/95">
            {saveState.error}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <SubmitButton className="h-11 bg-[var(--neon)] text-white hover:bg-[#ff4d6d] sm:min-w-[12rem]">
            Zapisz check-in
          </SubmitButton>
        </div>
      </form>

      <form action={closeAction} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <input type="hidden" name="date" value={dateKey} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Zamknij dzień</p>
            <p className="mt-1 text-xs text-white/55">
              Zapisze status zamknięcia dnia (podsumowanie rozbudujemy w kolejnym kroku).
            </p>
          </div>
          <Button
            type="submit"
            disabled={closed}
            className="h-11 bg-white/[0.06] text-white hover:bg-white/[0.09]"
          >
            <Lock className="mr-2 h-4 w-4 opacity-90" />
            {closed ? "Dzień zamknięty" : "Zamknij dzień"}
          </Button>
        </div>
        {closeState?.error ? (
          <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200/95">
            {closeState.error}
          </div>
        ) : null}
      </form>
    </div>
  );
}

