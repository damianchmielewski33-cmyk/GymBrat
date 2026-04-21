"use client";

import { useActionState, useEffect } from "react";
import { changePasswordFormAction } from "@/actions/profile";
import { SubmitButton } from "@/components/home/submit-button";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, formAction] = useActionState(changePasswordFormAction, {} as {
    ok?: boolean;
    error?: string;
  });

  useEffect(() => {
    if (state?.ok === true) notifySaved("Hasło zostało zmienione.");
    else if (state?.ok === false && state.error) {
      const msg =
        state.error === "Current password is incorrect"
          ? "Obecne hasło jest nieprawidłowe."
          : state.error === "Invalid form data"
            ? "Sprawdź poprawność pól."
            : "Nie udało się zmienić hasła.";
      notifyError(msg);
    }
  }, [state, notifySaved, notifyError]);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Obecne hasło</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          className="h-11 rounded-xl border-white/15 bg-black/30 px-4"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">Nowe hasło</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          className="h-11 rounded-xl border-white/15 bg-black/30 px-4"
        />
        <p className="text-xs text-white/45">Minimum 8 znaków.</p>
      </div>

      <SubmitButton className="bg-[var(--neon)] text-white hover:bg-[#ff4d6d]">
        Zmień hasło
      </SubmitButton>
    </form>
  );
}
