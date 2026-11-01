import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import {
  getRegisterEmailMode,
  TEST_REGISTER_CODE,
} from "@/lib/register-email-mode";

export const metadata: Metadata = {
  title: "Zmiana hasła — GymBrat",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  const mode = getRegisterEmailMode();
  return (
    <ForgotPasswordForm
      available={mode !== "disabled"}
      testCode={mode === "test" ? TEST_REGISTER_CODE : null}
    />
  );
}
