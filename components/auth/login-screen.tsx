import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthHeroBrand } from "@/components/auth/auth-hero-brand";
import { LoginForm } from "@/components/auth/login-form";

/** Ekran logowania — ten sam na /login i na / bez sesji. */
export function LoginScreen({
  googleEnabled = false,
  facebookEnabled = false,
}: {
  googleEnabled?: boolean;
  facebookEnabled?: boolean;
}) {
  return (
    <div>
      <AuthHeroBrand
        headline="Twoje centrum treningowe"
        support="Plany, historie, makro i coaching — w czerni żelaza i złocie ciężarów."
      />

      <AuthCard>
        <Suspense fallback={<div className="text-sm text-white/50">Ładowanie…</div>}>
          <LoginForm
            googleEnabled={googleEnabled}
            facebookEnabled={facebookEnabled}
          />
        </Suspense>
      </AuthCard>
    </div>
  );
}
