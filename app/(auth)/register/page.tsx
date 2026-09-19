import { RegisterForm } from "@/components/auth/register-form";
import { AuthHeroBrand } from "@/components/auth/auth-hero-brand";
import { Suspense } from "react";

export default function RegisterPage() {
  return (
    <div>
      <AuthHeroBrand
        headline="Dołącz do GymBrat"
        support="Załóż profil zawodnika i prowadź treningi w jasnym stylu Akademii."
      />
      <Suspense fallback={<div className="text-center text-sm text-zinc-500">Ładowanie…</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
