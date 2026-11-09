"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import {
  Armchair,
  Cake,
  Dumbbell,
  Flame,
  Ruler,
  Scale,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import { updateBodyParamsFormAction } from "@/actions/profile";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { SubmitButton } from "@/components/home/submit-button";
import { ProfileField } from "@/components/profile/profile-ui";
import { Input } from "@/components/ui/input";
import { WEIGHT_KG_MAX, WEIGHT_KG_MIN } from "@/lib/kcal-from-macros";
import { MIN_USER_AGE } from "@/lib/min-age";
import { cn } from "@/lib/utils";

type BodyParamsInitial = {
  firstName: string | null;
  lastName: string | null;
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex?: string | null;
  activityLevel: string | null;
};

const ACTIVITY_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  { value: "low", label: "Niska", description: "Biurko, lekkie spacery", icon: Armchair },
  { value: "medium", label: "Średnia", description: "3–5 treningów tygodniowo", icon: Dumbbell },
  { value: "high", label: "Wysoka", description: "Codziennie lub intensywnie", icon: Flame },
];

const SEX_OPTIONS = [
  { value: "male", label: "Mężczyzna" },
  { value: "female", label: "Kobieta" },
  { value: "", label: "Nie podano" },
] as const;

function FormCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="app-card p-5">
      <header className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10 text-[var(--gym-gold)]"
          aria-hidden
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-base font-semibold leading-tight text-white">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs text-white/50">{description}</p>
          ) : null}
        </div>
      </header>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** Pole liczbowe z jednostką wewnątrz kontrolki. */
function UnitInput({
  unit,
  className,
  ...props
}: { unit: string } & React.ComponentProps<"input">) {
  return (
    <div className="relative">
      <Input
        type="number"
        className={cn("pr-11 tabular-nums", className)}
        {...props}
      />
      <span
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] font-medium text-white/45"
        aria-hidden
      >
        {unit}
      </span>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: LucideIcon;
  label: string;
  value: number | null;
  unit: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/50">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </div>
      <p className="mt-1.5 font-metric text-xl font-semibold tabular-nums text-white">
        {value != null ? value : "—"}
        {value != null ? (
          <span className="ml-1 text-xs font-medium text-white/50">{unit}</span>
        ) : null}
      </p>
    </div>
  );
}

export function BodyParamsForm({ initial }: { initial: BodyParamsInitial }) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, formAction] = useActionState(updateBodyParamsFormAction, {} as {
    ok?: boolean;
    error?: string;
  });
  const initialSex =
    initial.sex === "male" || initial.sex === "female" ? initial.sex : "";
  const initialActivity = ACTIVITY_OPTIONS.some(
    (o) => o.value === initial.activityLevel,
  )
    ? (initial.activityLevel as string)
    : "";
  const [activity, setActivity] = useState(initialActivity);
  const [sex, setSex] = useState<string>(initialSex);

  useEffect(() => setActivity(initialActivity), [initialActivity]);
  useEffect(() => setSex(initialSex), [initialSex]);

  useEffect(() => {
    if (state?.ok === true) notifySaved("Zapisano dane profilu.");
    else if (state?.ok === false && state.error)
      notifyError("Nie udało się zapisać danych — sprawdź pola.");
  }, [state, notifySaved, notifyError]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5">
        <SummaryTile icon={Scale} label="Waga" value={initial.weightKg} unit="kg" />
        <SummaryTile icon={Ruler} label="Wzrost" value={initial.heightCm} unit="cm" />
        <SummaryTile icon={Cake} label="Wiek" value={initial.age} unit="lat" />
      </div>

      <FormCard icon={UserIcon} title="Dane osobowe">
        <div className="grid gap-4 sm:grid-cols-2">
          <ProfileField label="Imię" htmlFor="firstName">
            <Input
              id="firstName"
              name="firstName"
              autoComplete="given-name"
              defaultValue={initial.firstName ?? ""}
            />
          </ProfileField>
          <ProfileField label="Nazwisko" htmlFor="lastName">
            <Input
              id="lastName"
              name="lastName"
              autoComplete="family-name"
              defaultValue={initial.lastName ?? ""}
            />
          </ProfileField>
        </div>

        <input type="hidden" name="sex" value={sex} />
        <div className="space-y-1.5">
          <p id="sex-label" className="text-[13px] font-medium text-white/75">
            Płeć
          </p>
          <div
            role="radiogroup"
            aria-labelledby="sex-label"
            className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-black/40 p-1"
          >
            {SEX_OPTIONS.map((o) => {
              const selected = sex === o.value;
              return (
                <button
                  key={o.label}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSex(o.value)}
                  className={cn(
                    "min-h-11 rounded-lg px-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50",
                    selected
                      ? "bg-[var(--gym-gold)]/20 text-[var(--gym-gold)]"
                      : "text-white/65 hover:bg-white/[0.05]",
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs leading-snug text-white/50">
            Używamy do szacowania kcal z tętna. Bez wyboru — wzór uniwersalny.
          </p>
        </div>
      </FormCard>

      <FormCard
        icon={Ruler}
        title="Pomiary"
        description="Baza do raportów i zapotrzebowania."
      >
        <div className="grid grid-cols-2 gap-3">
          <ProfileField label="Waga" htmlFor="weightKg">
            <UnitInput
              unit="kg"
              id="weightKg"
              name="weightKg"
              inputMode="decimal"
              step="0.1"
              min={WEIGHT_KG_MIN}
              max={WEIGHT_KG_MAX}
              placeholder="78"
              defaultValue={
                initial.weightKg != null ? String(initial.weightKg) : ""
              }
            />
          </ProfileField>
          <ProfileField label="Wzrost" htmlFor="heightCm">
            <UnitInput
              unit="cm"
              id="heightCm"
              name="heightCm"
              inputMode="numeric"
              min={100}
              max={250}
              placeholder="178"
              defaultValue={
                initial.heightCm != null ? String(initial.heightCm) : ""
              }
            />
          </ProfileField>
          <ProfileField label="Wiek" htmlFor="age">
            <UnitInput
              unit="lat"
              id="age"
              name="age"
              inputMode="numeric"
              min={MIN_USER_AGE}
              max={120}
              placeholder="28"
              defaultValue={initial.age != null ? String(initial.age) : ""}
            />
          </ProfileField>
        </div>
      </FormCard>

      <FormCard
        icon={Flame}
        title="Poziom aktywności"
        description="Wpływa na szacunek zapotrzebowania kalorycznego."
      >
        <input type="hidden" name="activityLevel" value={activity} />
        <div
          role="radiogroup"
          aria-label="Poziom aktywności"
          className="space-y-2"
        >
          {ACTIVITY_OPTIONS.map((o) => {
            const selected = activity === o.value;
            const Icon = o.icon;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setActivity(o.value)}
                className={cn(
                  "flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50",
                  selected
                    ? "border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/12"
                    : "border-white/10 bg-black/25 hover:bg-white/[0.04]",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    selected
                      ? "bg-[var(--gym-gold)]/20 text-[var(--gym-gold)]"
                      : "bg-white/[0.06] text-white/55",
                  )}
                  aria-hidden
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white/90">
                    {o.label}
                  </span>
                  <span className="block text-xs text-white/50">
                    {o.description}
                  </span>
                </span>
                <span
                  className={cn(
                    "h-5 w-5 shrink-0 rounded-full border-2",
                    selected
                      ? "border-[var(--gym-gold)] bg-[var(--gym-gold)] shadow-[inset_0_0_0_3px_#0b0b0c]"
                      : "border-white/25",
                  )}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </FormCard>

      <SubmitButton>Zapisz zmiany</SubmitButton>
    </form>
  );
}
