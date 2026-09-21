import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { AuthHeroBrand } from "@/components/auth/auth-hero-brand";

export default function LoginPage() {
  return (
    <div>
      <AuthHeroBrand headline="Twoje centrum treningowe" />

      <div className="glass-panel gold-panel relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[var(--neon)]/12 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-16 h-48 w-48 rounded-full bg-[var(--neon)]/8 blur-3xl"
        />
        <div className="relative">
          <Suspense fallback={<div className="text-sm text-white/50">Ładowanie…</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
