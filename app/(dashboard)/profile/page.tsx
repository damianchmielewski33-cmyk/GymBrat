import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings, users } from "@/db/schema";
import { ProfileGoalForm } from "@/components/profile/profile-goal-form";
import { BodyParamsForm } from "@/components/profile/body-params-form";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { LogoutButton } from "@/components/profile/logout-button";
import { Shield, User as UserIcon, UtensilsCrossed } from "lucide-react";
import { FitatuConnectForm } from "@/components/profile/fitatu-connect-form";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session!.user!.id;
  const db = getDb();

  const [u] = await db
    .select({
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      weightKg: users.weightKg,
      heightCm: users.heightCm,
      age: users.age,
      activityLevel: users.activityLevel,
      fitatuAccessToken: users.fitatuAccessToken,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [s] = await db
    .select({ goal: userSettings.weeklyCardioGoalMinutes })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
          Zawodnik
        </p>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-heading metallic-text mt-2 text-3xl font-semibold">
              Profil
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/65">
              Twoje dane i ustawienia treningowe są w Turso — możesz w każdej chwili
              zaktualizować parametry ciała, cel i hasło.
            </p>
          </div>
          <LogoutButton className="h-11" />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-panel relative overflow-hidden p-8">
          <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(120deg,rgba(255,255,255,0.10),transparent_55%),radial-gradient(700px_320px_at_10%_10%,rgba(255,45,85,0.16),transparent_60%)]" />
          <div className="relative space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
                  Dane
                </p>
                <h2 className="font-heading mt-2 text-xl font-semibold">
                  Konto
                </h2>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--neon)]/35 bg-[var(--neon)]/10">
                <UserIcon className="h-5 w-5 text-[var(--neon)]" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs text-white/45">Email</p>
                <p className="mt-1 text-sm font-medium text-white/85">
                  {u?.email}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs text-white/45">Nazwa wyświetlana</p>
                <p className="mt-1 text-sm font-medium text-white/85">
                  {u?.name ?? "—"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
                Cel tygodniowy
              </p>
              <h3 className="font-heading mt-2 text-lg font-semibold">
                Minuty cardio
              </h3>
              <p className="mt-1 text-sm text-white/60">
                Zapisane w Turso. Postęp na stronie Start korzysta z kroczącej sumy 7 dni.
              </p>
              <div className="mt-4">
                <ProfileGoalForm initialGoal={s?.goal ?? 150} />
              </div>
            </div>
          </div>
        </section>

        <section className="glass-panel relative overflow-hidden p-8">
          <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(200deg,rgba(255,255,255,0.06),transparent_50%),radial-gradient(640px_280px_at_50%_0%,rgba(255,45,85,0.12),transparent_55%)]" />
          <div className="relative space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
                  Dieta
                </p>
                <h2 className="font-heading mt-2 text-xl font-semibold">
                  Fitatu
                </h2>
                <p className="mt-2 text-sm text-white/60">
                  Połącz konto Fitatu przez proxy (email i hasło lub token). Na stronie Start
                  zobaczysz dzienne makra i to, ile zostało do wykorzystania względem celu.
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--neon)]/35 bg-[var(--neon)]/10">
                <UtensilsCrossed className="h-5 w-5 text-[var(--neon)]" />
              </div>
            </div>
            <FitatuConnectForm connected={Boolean(u?.fitatuAccessToken)} />
          </div>
        </section>

        <section className="glass-panel relative overflow-hidden p-8 lg:col-span-2">
          <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(300deg,rgba(255,255,255,0.08),transparent_55%),radial-gradient(700px_320px_at_90%_0%,rgba(120,120,140,0.16),transparent_60%)]" />
          <div className="relative space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
                  Parametry ciała
                </p>
                <h2 className="font-heading mt-2 text-xl font-semibold">
                  Pomiary
                </h2>
                <p className="mt-2 text-sm text-white/60">
                  Wykorzystywane do przyszłych prognoz energii, regeneracji i postępów.
                </p>
              </div>
            </div>

            <BodyParamsForm
              initial={{
                firstName: u?.firstName ?? "",
                lastName: u?.lastName ?? "",
                weightKg: u?.weightKg ?? null,
                heightCm: u?.heightCm ?? null,
                age: u?.age ?? null,
                activityLevel: u?.activityLevel ?? "medium",
              }}
            />
          </div>
        </section>

        <section className="glass-panel relative overflow-hidden p-8 lg:col-span-2">
          <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(900px_420px_at_15%_0%,rgba(255,45,85,0.16),transparent_60%)]" />
          <div className="relative space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
                  Bezpieczeństwo
                </p>
                <h2 className="font-heading mt-2 text-xl font-semibold">
                  Zmień hasło
                </h2>
                <p className="mt-2 text-sm text-white/60">
                  Twoje hasło jest zapisane w Turso jako hash bcrypt.
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--neon)]/35 bg-[var(--neon)]/10">
                <Shield className="h-5 w-5 text-[var(--neon)]" />
              </div>
            </div>
            <ChangePasswordForm />
          </div>
        </section>
      </div>
    </div>
  );
}
