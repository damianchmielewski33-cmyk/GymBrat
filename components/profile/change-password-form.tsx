"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePasswordFormAction } from "@/actions/profile";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { SubmitButton } from "@/components/home/submit-button";
import { ProfileField } from "@/components/profile/profile-ui";
import { Input } from "@/components/ui/input";

export function ChangePasswordForm() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(changePasswordFormAction, {} as {
    ok?: boolean;
    error?: string;
  });

  useEffect(() => {
    if (state?.ok === true) {
      notifySaved("Hasło zostało zmienione.");
      formRef.current?.reset();
    } else if (state?.ok === false && state.error) {
      const msg =
        state.error === "Current password is incorrect"
          ? "Obecne hasło jest nieprawidłowe."
          : state.error === "Account has no password"
            ? "To konto loguje się przez Google — nie ma hasła do zmiany."
            : "Nie udało się zmienić hasła. Sprawdź pola.";
      notifyError(msg);
    }
  }, [state, notifySaved, notifyError]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <ProfileField label="Obecne hasło" htmlFor="currentPassword">
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </ProfileField>
        <ProfileField label="Nowe hasło" htmlFor="newPassword" hint="Minimum 8 znaków.">
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
        </ProfileField>
      </div>
      <SubmitButton>Zmień hasło</SubmitButton>
    </form>
  );
}
