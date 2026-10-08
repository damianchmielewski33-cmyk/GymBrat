"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { updateBodyParamsFormAction } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineBanner } from "@/components/ui/inline-banner";
import { cn } from "@/lib/utils";
import { activityLevels } from "@/lib/validations/register";

const activityCopy: Record<
  (typeof activityLevels)[number],
  { label: string; hint: string }
> = {
  low: { label: "Niska", hint: "Biurko / lekkie spacery" },
  medium: { label: "Średnia", hint: "3–5 treningów / tydzień" },
  high: { label: "Wysoka", hint: "Codziennie lub intensywnie" },
};

type Initial = {
  firstName: string | null;
  lastName: string | null;
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  activityLevel: string | null;
};

export function CompleteProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const { update } = useSession();
  const [activityLevel, setActivityLevel] = useState<
    (typeof activityLevels)[number]
  >(
    initial.activityLevel === "low" ||
      initial.activityLevel === "high" ||
      initial.activityLevel === "medium"
      ? initial.activityLevel
      : "medium",
  );
  const [weeklySessionsTarget, setWeeklySessionsTarget] = useState(4);
  const [state, formAction, pending] = useActionState(
    updateBodyParamsFormAction,
    {} as { ok?: boolean; error?: string },
  );

  useEffect(() => {
    if (state?.ok !== true) return;
    void (async () => {
      await update();
      router.replace("/");
      router.refresh();
    })();
  }, [state, update, router]);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="activityLevel" value={activityLevel} />
      <input
        type="hidden"
        name="weeklySessionsTarget"
        value={weeklySessionsTarget}
      />

      {state?.ok === false && state.error ? (
        <InlineBanner role="alert" variant="error">
          {state.error}
        </InlineBanner>
      ) : null}

      <section className="space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
          Dane podstawowe
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">Imię</Label>
            <Input
              id="firstName"
              name="firstName"
              required
              autoComplete="given-name"
              defaultValue={initial.firstName ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Nazwisko</Label>
            <Input
              id="lastName"
              name="lastName"
              required
              autoComplete="family-name"
              defaultValue={initial.lastName ?? ""}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
          Parametry ciała
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="weightKg">Waga (kg)</Label>
            <Input
              id="weightKg"
              name="weightKg"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={30}
              max={400}
              required
              defaultValue={initial.weightKg ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="heightCm">Wzrost (cm)</Label>
            <Input
              id="heightCm"
              name="heightCm"
              type="number"
              inputMode="numeric"
              min={100}
              max={250}
              required
              defaultValue={initial.heightCm ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="age">Wiek</Label>
            <Input
              id="age"
              name="age"
              type="number"
              inputMode="numeric"
              min={13}
              max={120}
              required
              defaultValue={initial.age ?? ""}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
          Poziom aktywności
        </p>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
          {activityLevels.map((level) => {
            const active = activityLevel === level;
            const { label, hint } = activityCopy[level];
            return (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setActivityLevel(level)}
                className={cn(
                  "min-h-[3.25rem] rounded-xl border px-3 py-3 text-left outline-none transition-all",
                  "focus-visible:ring-[3px] focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708]",
                  active
                    ? "border-[var(--neon)]/60 bg-[var(--neon)]/15"
                    : "border-white/10 bg-black/30 hover:border-white/20",
                )}
              >
                <span className="block text-sm font-semibold text-white">
                  {label}
                </span>
                <span className="mt-0.5 block text-[11px] text-white/45">
                  {hint}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
          Cel na tydzień
        </p>
        <p className="text-center font-metric text-4xl tabular-nums text-[var(--gym-gold)]">
          {weeklySessionsTarget}
        </p>
        <p className="text-center text-sm text-white/50">
          dni treningowe / tydzień
        </p>
        <input
          type="range"
          min={1}
          max={7}
          step={1}
          value={weeklySessionsTarget}
          onChange={(e) => setWeeklySessionsTarget(Number(e.target.value))}
          className="w-full accent-[var(--gym-gold)]"
          aria-label="Dni treningowe w tygodniu"
        />
      </section>

      <Button
        type="submit"
        variant="cta"
        className="w-full"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "Zapisywanie…" : "Zapisz i wejdź do GymBrat"}
      </Button>
    </form>
  );
}
