import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { AuthHeroBrand } from "@/components/auth/auth-hero-brand";
import { AwpCrossLink } from "@/components/awp-cross-link";

export default function LoginPage() {
  return (
    <div>
      <AuthHeroBrand
        headline="Twoje centrum treningowe"
        support="Plany, historie, makro i coaching — w czerni żelaza i złocie ciężarów."
      />

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
          <div className="mt-8 border-t border-[var(--neon)]/15 pt-6">
            <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-white/35">
              Siostrzana aplikacja
            </p>
            <AwpCrossLink variant="banner" />
          </div>
        </div>
      </div>
    </div>
  );
}
