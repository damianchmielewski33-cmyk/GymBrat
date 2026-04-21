"use client";

import { useActionState, useEffect } from "react";
import { updateBodyParamsFormAction } from "@/actions/profile";
import { BodyParamsFormFields } from "@/components/profile/body-params-form-fields";
import { useSaveFeedback } from "@/components/feedback/save-feedback";

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

  return (
    <form action={formAction} className="space-y-5">
      <BodyParamsFormFields initial={initial} />
    </form>
  );
}
