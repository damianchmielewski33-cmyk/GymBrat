import { RegisterForm } from "@/components/auth/register-form";
import { isGoogleAuthConfigured } from "@/lib/google-auth";
import { Suspense } from "react";

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center text-sm text-white/50">Ładowanie…</div>
      }
    >
      <RegisterForm googleEnabled={isGoogleAuthConfigured()} />
    </Suspense>
  );
}
