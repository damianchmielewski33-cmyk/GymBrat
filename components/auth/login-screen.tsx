import { Suspense } from "react";
import { Dumbbell, TrendingUp, Utensils } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthHeroBrand } from "@/components/auth/auth-hero-brand";
import { LoginForm } from "@/components/auth/login-form";

const BENEFITS = [
  {
    icon: Dumbbell,
    title: "Trening bez notatnika",
    text: "Plany, serie i ciężary zapisane w jednym miejscu.",
  },
  {
    icon: TrendingUp,
    title: "Widoczny postęp",
    text: "Historia, rekordy i cel tygodniowy w Postępach.",
  },
  {
    icon: Utensils,
    title: "Makro pod kontrolą",
    text: "Dieta liczona od Twojej wagi i aktywności.",
  },
] as const;

/** Ekran logowania — ten sam na /login i na / bez sesji. Desktop: marka po lewej, formularz po prawej. */
export function LoginScreen({
  googleEnabled = false,
  facebookEnabled = false,
}: {
  googleEnabled?: boolean;
  facebookEnabled?: boolean;
}) {
  return (
    <div className="mx-auto grid w-full max-w-md gap-8 lg:max-w-none lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16">
      <div className="lg:hidden">
        <AuthHeroBrand
          compact
          headline="Witaj z powrotem"
          support="Zaloguj się i wróć do treningu."
        />
      </div>

      <section
        aria-label="O GymBrat"
        className="hidden lg:block"
      >
        <p className="font-display text-7xl uppercase leading-none tracking-[0.08em] text-white">
          Gym<span className="text-[var(--neon)]">Brat</span>
        </p>
        <h1 className="mt-6 max-w-md font-heading text-3xl font-semibold leading-tight tracking-tight text-white/95">
          Twoje centrum treningowe.
        </h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-white/60">
          Plany, historia, makro i coaching — wszystko, czego potrzebujesz po
          drodze do formy.
        </p>
        <ul className="mt-10 space-y-5">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-4">
              <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--neon)]/30 bg-[var(--neon)]/10 text-[var(--neon)]">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-white">
                  {title}
                </span>
                <span className="block text-sm text-white/55">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

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
