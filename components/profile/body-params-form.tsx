"use client";

import { useActionState, useEffect } from "react";
import { updateBodyParamsFormAction } from "@/actions/profile";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { SubmitButton } from "@/components/home/submit-button";
import { ProfileField, ProfileSelect } from "@/components/profile/profile-ui";
import { Input } from "@/components/ui/input";

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
  { value: "low", label: "Niska — biurko, lekkie spacery" },
  { value: "medium", label: "Średnia — 3–5 treningów tygodniowo" },
  { value: "high", label: "Wysoka — codziennie lub intensywnie" },
] as const;

export function BodyParamsForm({ initial }: { initial: BodyParamsInitial }) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, formAction] = useActionState(updateBodyParamsFormAction, {} as {
    ok?: boolean;
    error?: string;
  });

  useEffect(() => {
    if (state?.ok === true) notifySaved("Zapisano dane profilu.");
    else if (state?.ok === false && state.error)
      notifyError("Nie udało się zapisać danych — sprawdź pola.");
  }, [state, notifySaved, notifyError]);

  const sex = initial.sex === "male" || initial.sex === "female" ? initial.sex : "";
  const activity = ACTIVITY_OPTIONS.some((o) => o.value === initial.activityLevel)
    ? (initial.activityLevel as string)
    : "medium";

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
            min={30}
            max={400}
            defaultValue={initial.weightKg ?? 80}
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
            defaultValue={initial.heightCm ?? 180}
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
            defaultValue={initial.age ?? 25}
          />
        </ProfileField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ProfileField
          label="Płeć"
          htmlFor="sex"
          hint="Do szacowania kcal z tętna (Keytel). Bez wyboru — wzór uniwersalny."
        >
          <ProfileSelect id="sex" name="sex" defaultValue={sex}>
            <option value="">Nie podano</option>
            <option value="male">Mężczyzna</option>
            <option value="female">Kobieta</option>
          </ProfileSelect>
        </ProfileField>
        <ProfileField
          label="Poziom aktywności"
          htmlFor="activityLevel"
          hint="Wpływa na szacunek zapotrzebowania kalorycznego."
        >
          <ProfileSelect id="activityLevel" name="activityLevel" defaultValue={activity}>
            {ACTIVITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </ProfileSelect>
        </ProfileField>
      </div>

      <SubmitButton>Zapisz parametry ciała</SubmitButton>
    </form>
  );
}
