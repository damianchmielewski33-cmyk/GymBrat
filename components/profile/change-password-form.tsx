import { changePasswordFormActionVoid } from "@/actions/profile";
import { ChangePasswordFormFields } from "@/components/profile/change-password-form-fields";

export function ChangePasswordForm() {
  return (
    <form className="space-y-5" action={changePasswordFormActionVoid}>
      <ChangePasswordFormFields />
    </form>
  );
}

