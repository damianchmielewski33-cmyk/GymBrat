import { LoginScreen } from "@/components/auth/login-screen";
import {
  isFacebookAuthConfigured,
  isGoogleAuthConfigured,
} from "@/lib/google-auth";

export default function LoginPage() {
  return (
    <LoginScreen
      googleEnabled={isGoogleAuthConfigured()}
      facebookEnabled={isFacebookAuthConfigured()}
    />
  );
}
