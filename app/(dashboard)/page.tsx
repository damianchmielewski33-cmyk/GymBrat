import { auth } from "@/auth";
import { QuickLogCardio } from "@/components/home/quick-log-cardio";
import { TodaysMacrosSection } from "@/components/home/todays-macros";
import { WeeklyCardioBar } from "@/components/home/weekly-cardio-bar";
import { getWeeklyCardioProgress } from "@/lib/cardio";
import { getTodaysMacrosCached } from "@/services/fitatu";
import { Sparkles } from "lucide-react";

export default async function HomePage() {
  const session = await auth();
  const userId = session!.user!.id;

  const [cardio, macros] = await Promise.all([
    getWeeklyCardioProgress(userId),
    getTodaysMacrosCached(userId),
  ]);

  return (
    <div className="space-y-8">
      <section className="glass-panel neon-glow relative overflow-hidden px-6 py-10 sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--neon)]/10 via-transparent to-transparent" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[var(--neon)]/18 blur-3xl" />

        <div className="relative">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-white/60">
            <Sparkles className="h-3.5 w-3.5 text-[var(--neon)]" />
            Premium · Szkło · Metal
          </p>

          <div className="mt-6">
            <h1 className="font-heading metallic-text text-5xl font-semibold tracking-tight sm:text-6xl">
              GymBrat
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/65">
              Twój premium system treningowy: dzisiejsze makra, tygodniowe tempo cardio
              i fundament pod przyszłego trenera.
            </p>
          </div>
        </div>
      </section>

      <section>
        <TodaysMacrosSection data={macros} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <WeeklyCardioBar
          percent={cardio.percent}
          minutesCompleted={cardio.minutesCompleted}
          weeklyGoal={cardio.weeklyGoal}
        />
        <QuickLogCardio />
      </section>
    </div>
  );
}
