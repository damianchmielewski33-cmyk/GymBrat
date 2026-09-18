"use client";

import { SubmitButton } from "@/components/home/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordFormFields() {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Obecne hasło</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">Nowe hasło</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
        />
        <p className="text-xs text-white/45">Minimum 8 znaków.</p>
      </div>

      <SubmitButton>Zmień hasło</SubmitButton>
    </>
  );
}
