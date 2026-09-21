import { RegisterForm } from "@/components/auth/register-form";
import { AuthHeroBrand } from "@/components/auth/auth-hero-brand";
import { Suspense } from "react";

export default function RegisterPage() {
  return (
    <div>
      <AuthHeroBrand headline="Dołącz do GymBrat" />
      <Suspense fallback={<div className="text-center text-sm text-white/50">Ładowanie…</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
