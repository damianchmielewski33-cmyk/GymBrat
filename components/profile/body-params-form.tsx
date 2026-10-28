"use client";

import { useActionState, useEffect } from "react";
import { updateBodyParamsFormAction } from "@/actions/profile";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { SubmitButton } from "@/components/home/submit-button";
import {
  ProfileChipGroup,
  ProfileField,
  ProfileSelect,
} from "@/components/profile/profile-ui";
import { Input } from "@/components/ui/input";
import { WEIGHT_KG_MAX, WEIGHT_KG_MIN } from "@/lib/kcal-from-macros";
import { useState } from "react";

type BodyParamsInitial = {
  firstName: string | null;
  lastName: string | null;
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex?: string | null;
  activityLevel: string | null;
};

const ACTIVITY_OPTIONS = [
  {
    value: "low",
    label: "Niska",
    description: "Biurko, lekkie spacery",
  },
  {
    value: "medium",
    label: "Średnia",
    description: "3–5 treningów tygodniowo",
  },
  {
    value: "high",
    label: "Wysoka",
    description: "Codziennie lub intensywnie",
  },
] as const;

export function BodyParamsForm({ initial }: { initial: BodyParamsInitial }) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, formAction] = useActionState(updateBodyParamsFormAction, {} as {
    ok?: boolean;
    error?: string;
  });
  const sex =
    initial.sex === "male" || initial.sex === "female" ? initial.sex : "";
  const initialActivity = ACTIVITY_OPTIONS.some(
    (o) => o.value === initial.activityLevel,
  )
    ? (initial.activityLevel as string)
    : "";
  const [activity, setActivity] = useState(initialActivity);

  useEffect(() => {
    setActivity(initialActivity);
  }, [initialActivity]);

  useEffect(() => {
    if (state?.ok === true) notifySaved("Zapisano dane profilu.");
    else if (state?.ok === false && state.error)
      notifyError("Nie udało się zapisać danych — sprawdź pola.");
  }, [state, notifySaved, notifyError]);

  return (
    <form action={formAction} className="space-y-4">
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

      <div className="grid grid-cols-3 gap-3">
        <ProfileField label="Waga (kg)" htmlFor="weightKg">
          <Input
            id="weightKg"
            name="weightKg"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={WEIGHT_KG_MIN}
            max={WEIGHT_KG_MAX}
            placeholder="np. 78"
            defaultValue={
              initial.weightKg != null ? String(initial.weightKg) : ""
            }
          />
        </ProfileField>
        <ProfileField label="Wzrost (cm)" htmlFor="heightCm">
          <Input
            id="heightCm"
            name="heightCm"
            type="number"
            inputMode="numeric"
            min={100}
            max={250}
            placeholder="np. 178"
            defaultValue={
              initial.heightCm != null ? String(initial.heightCm) : ""
            }
          />
        </ProfileField>
        <ProfileField label="Wiek" htmlFor="age">
          <Input
            id="age"
            name="age"
            type="number"
            inputMode="numeric"
            min={13}
            max={120}
            placeholder="np. 28"
            defaultValue={initial.age != null ? String(initial.age) : ""}
          />
        </ProfileField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ProfileField
          label="Płeć"
          htmlFor="sex"
          hint="Do szacowania kcal z tętna. Bez wyboru — wzór uniwersalny."
        >
          <ProfileSelect id="sex" name="sex" defaultValue={sex}>
            <option value="">Nie podano</option>
            <option value="male">Mężczyzna</option>
            <option value="female">Kobieta</option>
          </ProfileSelect>
        </ProfileField>
        <div className="space-y-1.5">
          <p className="block text-[13px] font-medium text-white/75">
            Poziom aktywności
          </p>
          <input type="hidden" name="activityLevel" value={activity} />
          <ProfileChipGroup
            aria-label="Poziom aktywności"
            variant="list"
            value={activity || null}
            onChange={setActivity}
            options={ACTIVITY_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
              description: o.description,
            }))}
          />
          <p className="text-xs leading-snug text-white/40">
            Wpływa na szacunek zapotrzebowania kalorycznego. Nic nie zaznaczaj,
            jeśli nie chcesz zmieniać.
          </p>
        </div>
      </div>

      <SubmitButton>Zapisz parametry ciała</SubmitButton>
    </form>
  );
}
