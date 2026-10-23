"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveNutritionPlanAction } from "@/actions/nutrition-settings";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import type { NutritionGoalsPayload } from "@/lib/nutrition-goals";
import { kcalFromMacros } from "@/lib/kcal-from-macros";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProfileField } from "@/components/profile/profile-ui";
import {
  calendarDateKey,
  formatPlCalendarRange,
  weekDateKeysMondayFirst,
} from "@/lib/local-date";

type DayMap = Record<string, "training" | "rest">;

/** Atwater: białko i węgle 4 kcal/g, tłuszcz 9 kcal/g. */
function gramsForKcal(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function kcalStringFromMacros(
  proteinG: string,
  carbsG: string,
  fatG: string,
): string {
  const any =
    proteinG.trim() !== "" ||
    carbsG.trim() !== "" ||
    fatG.trim() !== "";
  if (!any) return "";
  return String(
    kcalFromMacros(
      gramsForKcal(proteinG),
      gramsForKcal(fatG),
      gramsForKcal(carbsG),
    ),
  );
}

function parseGoalsPayload(
  g: NutritionGoalsPayload | null,
): {
  calories: string;
  proteinG: string;
  fatG: string;
  carbsG: string;
} {
  if (!g) {
    return { calories: "", proteinG: "", fatG: "", carbsG: "" };
  }
  return {
    calories: String(kcalFromMacros(g.proteinG, g.fatG, g.carbsG)),
    proteinG: String(g.proteinG),
    fatG: String(g.fatG),
    carbsG: String(g.carbsG),
  };
}

function readGoalsFromFields(f: {
  calories: string;
  proteinG: string;
  fatG: string;
  carbsG: string;
}): NutritionGoalsPayload | null {
  const proteinG = gramsForKcal(f.proteinG);
  const fatG = gramsForKcal(f.fatG);
  const carbsG = gramsForKcal(f.carbsG);
  const empty =
    !f.proteinG.trim() && !f.fatG.trim() && !f.carbsG.trim();
  if (empty) return null;
  if (
    proteinG < 0 ||
    fatG < 0 ||
    carbsG < 0 ||
    !Number.isFinite(proteinG) ||
    !Number.isFinite(fatG) ||
    !Number.isFinite(carbsG)
  ) {
    return null;
  }
  const calories = kcalFromMacros(proteinG, fatG, carbsG);
  if (calories <= 0) return null;
  return { calories, proteinG, fatG, carbsG };
}

export function NutritionPlanSection({
  initialTraining,
  initialRest,
  initialDayTypes,
}: {
  initialTraining: NutritionGoalsPayload | null;
  initialRest: NutritionGoalsPayload | null;
  initialDayTypes: DayMap;
}) {
  const [trainingFields, setTrainingFields] = useState(() =>
    parseGoalsPayload(initialTraining),
  );
  const [restFields, setRestFields] = useState(() =>
    parseGoalsPayload(initialRest),
  );
  const [dayTypes, setDayTypes] = useState<DayMap>(() => ({
    ...initialDayTypes,
  }));
  const [clientError, setClientError] = useState<string | null>(null);

  const [state, formAction, isPending] = useActionState(saveNutritionPlanAction, {
    ok: true,
  });
  const { notifySaved } = useSaveFeedback();
  const saveCycleRef = useRef(false);

  useEffect(() => {
    if (isPending) {
      saveCycleRef.current = true;
      return;
    }
    if (saveCycleRef.current) {
      saveCycleRef.current = false;
      if (state?.ok === true) {
        notifySaved("Zapisano cele żywieniowe i kalendarz.");
      }
    }
  }, [isPending, state?.ok, notifySaved]);

  function toggleDay(dateKey: string) {
    setDayTypes((prev) => {
      const next = { ...prev };
      const cur = next[dateKey] ?? "rest";
      next[dateKey] = cur === "training" ? "rest" : "training";
      return next;
    });
  }

  function buildFormData(): FormData | null {
    setClientError(null);
    const training = readGoalsFromFields(trainingFields);
    const rest = readGoalsFromFields(restFields);
    if (
      (trainingFields.proteinG.trim() ||
        trainingFields.fatG.trim() ||
        trainingFields.carbsG.trim()) &&
      !training
    ) {
      setClientError(
        "Sprawdź cele na dzień treningowy (makroskładniki ≥ 0, kcal z gramów > 0).",
      );
      return null;
    }
    if (
      (restFields.proteinG.trim() ||
        restFields.fatG.trim() ||
        restFields.carbsG.trim()) &&
      !rest
    ) {
      setClientError(
        "Sprawdź cele na dzień nietreningowy (makroskładniki ≥ 0, kcal z gramów > 0).",
      );
      return null;
    }
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({
        training,
        rest,
        dayTypes,
      }),
    );
    return fd;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = buildFormData();
    if (!fd) return;
    formAction(fd);
  }

  const todayKey = calendarDateKey();
  const weekKeys = weekDateKeysMondayFirst(todayKey);
  const weekLabel = formatPlCalendarRange(weekKeys[0]!, weekKeys[6]!);

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="space-y-4">
        <fieldset className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
          <legend className="px-1 text-[13px] font-semibold text-[var(--gym-gold)]">
            Dzień treningowy
          </legend>
          <GoalFields
            prefix="training"
            values={trainingFields}
            onChange={setTrainingFields}
          />
        </fieldset>
        <fieldset className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
          <legend className="px-1 text-[13px] font-semibold text-white/80">
            Dzień nietreningowy
          </legend>
          <GoalFields prefix="rest" values={restFields} onChange={setRestFields} />
        </fieldset>
      </div>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] leading-relaxed text-white/50">
            Kliknij dzień, aby przełączyć trening / odpoczynek. Dni bez
            oznaczenia liczą się jako nietreningowe.
          </p>
          <span className="shrink-0 text-[13px] font-medium text-white/75">
            {weekLabel}
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-white/45">
          <span>Pon</span>
          <span>Wt</span>
          <span>Śr</span>
          <span>Czw</span>
          <span>Pt</span>
          <span>Sob</span>
          <span>Ndz</span>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {weekKeys.map((dateKey) => {
            const kind = dayTypes[dateKey] ?? "rest";
            const isTraining = kind === "training";
            const isToday = dateKey === todayKey;
            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => toggleDay(dateKey)}
                aria-pressed={isTraining}
                aria-label={`${dateKey}: ${isTraining ? "trening" : "odpoczynek"}`}
                className={`aspect-square rounded-xl border text-sm font-medium transition hover:border-white/25 ${
                  isTraining
                    ? "border-[var(--neon)]/55 bg-[var(--neon)]/18 text-white"
                    : "border-white/12 bg-white/[0.04] text-white/70"
                } ${isToday ? "ring-2 ring-[var(--neon)]/35 ring-offset-0" : ""}`}
              >
                {Number(dateKey.slice(8))}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-white/50">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-[var(--neon)]/35 ring-1 ring-[var(--neon)]/45" />{" "}
            Trening
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-white/10 ring-1 ring-white/15" />{" "}
            Odpoczynek
          </span>
        </div>
      </div>

      {clientError ? (
        <p className="text-sm text-rose-300">{clientError}</p>
      ) : null}
      {state.ok === false ? (
        <p className="text-sm text-rose-300">{state.error}</p>
      ) : null}

      <Button type="submit" variant="cta" disabled={isPending} className="w-full">
        {isPending ? "Zapisywanie…" : "Zapisz cele i kalendarz"}
      </Button>
    </form>
  );
}

function GoalFields({
  prefix,
  values,
  onChange,
}: {
  prefix: string;
  values: ReturnType<typeof parseGoalsPayload>;
  onChange: (v: ReturnType<typeof parseGoalsPayload>) => void;
}) {
  function patchMacro(
    key: "proteinG" | "carbsG" | "fatG",
    val: string,
  ) {
    const next = { ...values, [key]: val };
    onChange({
      ...next,
      calories: kcalStringFromMacros(
        next.proteinG,
        next.carbsG,
        next.fatG,
      ),
    });
  }

  const displayKcal = kcalStringFromMacros(
    values.proteinG,
    values.carbsG,
    values.fatG,
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2.5">
        <ProfileField label="Białko (g)" htmlFor={`${prefix}-p`}>
          <Input
            id={`${prefix}-p`}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={values.proteinG}
            onChange={(e) => patchMacro("proteinG", e.target.value)}
          />
        </ProfileField>
        <ProfileField label="Węgle (g)" htmlFor={`${prefix}-c`}>
          <Input
            id={`${prefix}-c`}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={values.carbsG}
            onChange={(e) => patchMacro("carbsG", e.target.value)}
          />
        </ProfileField>
        <ProfileField label="Tłuszcz (g)" htmlFor={`${prefix}-f`}>
          <Input
            id={`${prefix}-f`}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={values.fatG}
            onChange={(e) => patchMacro("fatG", e.target.value)}
          />
        </ProfileField>
      </div>
      <p className="flex items-baseline justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2 text-[13px] text-white/50">
        <span>Kalorie z makroskładników</span>
        <span className="font-heading text-lg font-semibold tabular-nums text-white">
          {displayKcal ? `${displayKcal} kcal` : "—"}
        </span>
      </p>
    </div>
  );
}
