import { LoginScreen } from "@/components/auth/login-screen";
import { isGoogleAuthConfigured } from "@/lib/google-auth";

export default function LoginPage() {
  return <LoginScreen googleEnabled={isGoogleAuthConfigured()} />;
}
