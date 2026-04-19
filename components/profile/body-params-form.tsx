"use client";

import { updateBodyParamsFormActionVoid } from "@/actions/profile";
import { BodyParamsFormFields } from "@/components/profile/body-params-form-fields";

export function BodyParamsForm({
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
    <form className="space-y-5" action={updateBodyParamsFormActionVoid}>
      <BodyParamsFormFields initial={initial} />
    </form>
  );
}

