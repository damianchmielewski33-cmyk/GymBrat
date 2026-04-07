import { changePasswordFormAction } from "@/actions/profile";
import { SubmitButton } from "@/components/home/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  return (
    <form
      className="space-y-5"
      action={async (formData) => {
        await changePasswordFormAction(formData);
      }}
    >
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

