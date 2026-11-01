import type { Metadata } from "next";
import { LoginScreen } from "@/components/auth/login-screen";
import {
  isFacebookAuthConfigured,
  isGoogleAuthConfigured,
} from "@/lib/google-auth";

export const metadata: Metadata = {
  title: "Logowanie",
  description: "Zaloguj się do GymBrat — dziennika treningowego i żywieniowego.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    <LoginScreen
      googleEnabled={isGoogleAuthConfigured()}
      facebookEnabled={isFacebookAuthConfigured()}
    />
  );
}
