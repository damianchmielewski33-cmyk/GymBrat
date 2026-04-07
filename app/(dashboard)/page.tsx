import { auth } from "@/auth";
import { TodaysMacrosSection } from "@/components/home/todays-macros";
import { WeeklyCardioBar } from "@/components/home/weekly-cardio-bar";
import { getWeeklyCardioProgress } from "@/lib/cardio";
import { getTodaysMacrosCached } from "@/services/fitatu";
import Link from "next/link";
import { Zap } from "lucide-react";

export default async function HomePage() {
  const session = await auth();
  const userId = session!.user!.id;

  const [cardio, macros] = await Promise.all([
    getWeeklyCardioProgress(userId),
    getTodaysMacrosCached(userId),
  ]);

  return (
    <div className="space-y-8">
      <section className="glass-panel neon-glow relative overflow-hidden px-6 py-8 sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--neon)]/10 via-transparent to-transparent" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[var(--neon)]/18 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
              Start
            </p>
            <h1 className="font-heading metallic-text mt-2 text-3xl font-semibold sm:text-4xl">
              Gotowy na trening?
            </h1>
          </div>

          <Link
            href="/active-workout"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--neon)] px-5 text-sm font-medium text-white transition hover:bg-[#ff4d6d]"
          >
            <Zap className="mr-2 h-4 w-4" />
            Rozpocznij trening
          </Link>
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
      </section>
    </div>
  );
}
