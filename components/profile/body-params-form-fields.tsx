"use client";

import { SubmitButton } from "@/components/home/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { activityLevels } from "@/lib/validations/register";

export function BodyParamsFormFields({
  initial,
}: {
  initial: {
    firstName: string | null;
    lastName: string | null;
    weightKg: number | null;
    heightCm: number | null;
    age: number | null;
    activityLevel: string | null;
  };
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">Imię</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={initial.firstName ?? ""}
            className="h-11 rounded-xl border-white/15 bg-black/30 px-4"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Nazwisko</Label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={initial.lastName ?? ""}
            className="h-11 rounded-xl border-white/15 bg-black/30 px-4"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="weightKg">Waga (kg)</Label>
          <Input
            id="weightKg"
            name="weightKg"
            type="number"
            step="0.1"
            min={30}
            max={400}
            defaultValue={initial.weightKg ?? 80}
            className="h-11 rounded-xl border-white/15 bg-black/30 px-4"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="heightCm">Wzrost (cm)</Label>
          <Input
            id="heightCm"
            name="heightCm"
            type="number"
            min={100}
            max={250}
            defaultValue={initial.heightCm ?? 180}
            className="h-11 rounded-xl border-white/15 bg-black/30 px-4"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="age">Wiek</Label>
          <Input
            id="age"
            name="age"
            type="number"
            min={13}
            max={120}
            defaultValue={initial.age ?? 25}
            className="h-11 rounded-xl border-white/15 bg-black/30 px-4"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="activityLevel">Poziom aktywności</Label>
        <select
          id="activityLevel"
          name="activityLevel"
          defaultValue={initial.activityLevel ?? "medium"}
          className="h-11 w-full rounded-xl border border-white/15 bg-black/30 px-4 text-sm text-white/90 outline-none ring-[var(--neon)]/30 focus:ring-2"
        >
          {activityLevels.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <p className="text-xs text-white/45">
          Używane do przyszłych prognoz obciążenia/regeneracji i szacowania kalorii.
        </p>
      </div>

      <SubmitButton className="bg-[var(--neon)] text-white hover:bg-[#ff4d6d]">
        Zapisz parametry ciała
      </SubmitButton>
    </>
  );
}

